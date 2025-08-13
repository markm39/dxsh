"""
HTTP Request API endpoints for testing and executing HTTP requests
Supports various authentication methods, variable substitution, and parameter looping
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional, Union
import logging
import httpx
import json
import re
import base64
from datetime import datetime
from urllib.parse import urlencode, urlparse

from ..auth import get_current_user, AuthUser
from ..database import get_db

router = APIRouter(prefix="/api/v1/http-request", tags=["http-request"])
logger = logging.getLogger(__name__)

# Constants
DEFAULT_TIMEOUT = 30
MAX_REDIRECTS = 10
SUPPORTED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]

def apply_variable_substitution(text: str, variables: Dict[str, Any]) -> str:
    """
    Apply variable substitution to text using {{variable}} syntax
    """
    if not isinstance(text, str) or not variables:
        return text
    
    def replace_var(match):
        var_name = match.group(1).strip()
        if var_name in variables:
            return str(variables[var_name])
        return match.group(0)  # Return original if not found
    
    return re.sub(r'\{\{([^}]+)\}\}', replace_var, text)

def apply_auth_to_request(config: Dict[str, Any], auth_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Apply authentication configuration to request
    """
    auth_type = auth_config.get('type', 'none').lower()
    
    if auth_type == 'api_key':
        location = auth_config.get('location', 'header').lower()
        key_name = auth_config.get('keyName', 'X-API-Key')
        api_key = auth_config.get('apiKey', '')
        
        if location == 'header':
            config['headers'][key_name] = api_key
        elif location == 'query':
            config['queryParams'][key_name] = api_key
            
    elif auth_type == 'bearer':
        token = auth_config.get('token', '')
        config['headers']['Authorization'] = f'Bearer {token}'
        
    elif auth_type == 'basic':
        username = auth_config.get('username', '')
        password = auth_config.get('password', '')
        credentials = base64.b64encode(f"{username}:{password}".encode()).decode()
        config['headers']['Authorization'] = f'Basic {credentials}'
        
    elif auth_type == 'oauth2':
        access_token = auth_config.get('accessToken', '')
        config['headers']['Authorization'] = f'Bearer {access_token}'
        
    elif auth_type == 'custom':
        custom_headers = auth_config.get('customHeaders', [])
        for header in custom_headers:
            if header.get('key') and header.get('value'):
                config['headers'][header['key']] = header['value']
    
    return config

def parse_response(response: httpx.Response) -> Dict[str, Any]:
    """
    Parse HTTP response and extract relevant data
    """
    content_type = response.headers.get('content-type', '').lower()
    
    try:
        if 'application/json' in content_type:
            data = response.json()
        elif 'text/' in content_type or 'application/xml' in content_type:
            data = response.text
        else:
            data = f"Binary content ({len(response.content)} bytes)"
            
        return {
            'status_code': response.status_code,
            'headers': dict(response.headers),
            'content_type': content_type,
            'data': data,
            'url': str(response.url),
            'elapsed_ms': int(response.elapsed.total_seconds() * 1000)
        }
    except Exception as e:
        logger.warning(f"Error parsing response: {e}")
        return {
            'status_code': response.status_code,
            'headers': dict(response.headers),
            'content_type': content_type,
            'data': response.text if hasattr(response, 'text') else str(response.content),
            'url': str(response.url),
            'elapsed_ms': int(response.elapsed.total_seconds() * 1000),
            'parse_error': str(e)
        }

async def execute_single_request(config: Dict[str, Any], variables: Dict[str, Any] = None, use_proxy: bool = False) -> Dict[str, Any]:
    """
    Execute a single HTTP request with the given configuration
    """
    if variables is None:
        variables = {}
    
    try:
        # Apply variable substitution
        raw_url = config.get('url', '').strip()
        logger.info(f"Raw URL from config: '{raw_url}'")
        url = apply_variable_substitution(raw_url, variables).strip()
        logger.info(f"URL after variable substitution: '{url}'")
        method = config.get('method', 'GET').upper()
        timeout = config.get('timeout', DEFAULT_TIMEOUT)
        
        # Validate method
        if method not in SUPPORTED_METHODS:
            raise ValueError(f"Unsupported HTTP method: {method}")
        
        # Prepare headers
        headers = {}
        if 'headers' in config:
            for key, value in config['headers'].items():
                headers[apply_variable_substitution(key, variables)] = apply_variable_substitution(value, variables)
        
        # Prepare query parameters
        query_params = {}
        if 'queryParams' in config:
            for key, value in config['queryParams'].items():
                query_params[apply_variable_substitution(key, variables)] = apply_variable_substitution(str(value), variables)
        
        # Apply authentication
        request_config = {
            'headers': headers,
            'queryParams': query_params
        }
        
        if 'authentication' in config:
            auth_config = config['authentication']
            # Apply variable substitution to auth config
            auth_with_vars = {}
            for key, value in auth_config.items():
                if isinstance(value, str):
                    auth_with_vars[key] = apply_variable_substitution(value, variables)
                else:
                    auth_with_vars[key] = value
            
            request_config = apply_auth_to_request(request_config, auth_with_vars)
        
        # Prepare request body
        request_body = None
        if method in ['POST', 'PUT', 'PATCH'] and 'body' in config:
            body = config['body']
            if isinstance(body, str):
                request_body = apply_variable_substitution(body, variables)
                # Try to parse as JSON if it looks like JSON
                if request_body.strip().startswith(('{', '[')):
                    try:
                        request_body = json.loads(request_body)
                    except json.JSONDecodeError:
                        pass  # Keep as string
            elif isinstance(body, dict):
                # Apply variable substitution to dict values
                request_body = {}
                for key, value in body.items():
                    if isinstance(value, str):
                        request_body[key] = apply_variable_substitution(value, variables)
                    else:
                        request_body[key] = value
        
        # Build final URL with query parameters
        if query_params:
            separator = '&' if '?' in url else '?'
            url = f"{url}{separator}{urlencode(query_params)}"
        
        # Execute request either directly or through proxy
        if use_proxy:
            # Use internal CORS proxy for external requests
            proxy_data = {
                'url': url,
                'method': method,
                'headers': request_config['headers'],
                'params': query_params,
                'timeout': timeout
            }
            
            if method in ['POST', 'PUT', 'PATCH'] and request_body:
                proxy_data['data'] = request_body
            
            # Create a mock user object for internal proxy call
            class MockUser:
                def __init__(self):
                    self.user_id = "system"
            
            try:
                # Call the proxy function directly (import at function level to avoid circular imports)
                import sys
                from .cors_proxy import proxy_request as cors_proxy_request
                mock_user = MockUser()
                proxy_result = await cors_proxy_request(proxy_data, mock_user)
                
                return {
                    'success': proxy_result.get('success', True),
                    'response': {
                        'status_code': proxy_result.get('status_code'),
                        'headers': proxy_result.get('headers', {}),
                        'content_type': proxy_result.get('content_type', ''),
                        'data': proxy_result.get('data'),
                        'url': proxy_result.get('url'),
                        'elapsed_ms': proxy_result.get('elapsed_ms', 0)
                    },
                    'request': {
                        'url': url,
                        'method': method,
                        'headers': request_config['headers'],
                        'body': request_body
                    }
                }
            except Exception as e:
                return {
                    'success': False,
                    'error': f'Proxy request failed: {str(e)}',
                    'error_type': 'proxy_error'
                }
        
        # Direct request (original code)
        async with httpx.AsyncClient(follow_redirects=True, timeout=timeout) as client:
            if method == 'GET':
                response = await client.get(url, headers=request_config['headers'])
            elif method == 'POST':
                if isinstance(request_body, dict):
                    response = await client.post(url, json=request_body, headers=request_config['headers'])
                else:
                    response = await client.post(url, content=request_body, headers=request_config['headers'])
            elif method == 'PUT':
                if isinstance(request_body, dict):
                    response = await client.put(url, json=request_body, headers=request_config['headers'])
                else:
                    response = await client.put(url, content=request_body, headers=request_config['headers'])
            elif method == 'PATCH':
                if isinstance(request_body, dict):
                    response = await client.patch(url, json=request_body, headers=request_config['headers'])
                else:
                    response = await client.patch(url, content=request_body, headers=request_config['headers'])
            elif method == 'DELETE':
                response = await client.delete(url, headers=request_config['headers'])
            elif method == 'HEAD':
                response = await client.head(url, headers=request_config['headers'])
            elif method == 'OPTIONS':
                response = await client.options(url, headers=request_config['headers'])
        
        return {
            'success': True,
            'response': parse_response(response),
            'request': {
                'url': url,
                'method': method,
                'headers': request_config['headers'],
                'body': request_body
            }
        }
        
    except httpx.TimeoutException:
        return {
            'success': False,
            'error': 'Request timed out',
            'error_type': 'timeout'
        }
    except httpx.ConnectError as e:
        return {
            'success': False,
            'error': f'Connection error: {str(e)}',
            'error_type': 'connection'
        }
    except Exception as e:
        logger.error(f"HTTP request execution failed: {e}")
        return {
            'success': False,
            'error': str(e),
            'error_type': 'general'
        }

@router.post("/test")
async def test_http_request(
    request_data: dict,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Test HTTP request configuration without saving to database
    """
    try:
        logger.info(f"HTTP request test called with data: {request_data}")
        
        # Handle nested config structure from frontend
        config_data = request_data.get('config', request_data)
        
        # Validate required fields
        if 'url' not in config_data:
            logger.error("HTTP request test failed: URL is required")
            raise HTTPException(status_code=400, detail="URL is required")
        
        # Extract input data for variable substitution
        input_data = request_data.get('inputData', {})
        
        # Check if proxy should be used
        use_proxy = config_data.get('useProxy', False)
        
        # Execute the request
        result = await execute_single_request(config_data, input_data, use_proxy)
        
        logger.info(f"User {current_user.user_id} tested HTTP request to {request_data.get('url')}")
        
        return {
            'success': result['success'],
            'result': result,
            'tested_at': datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"HTTP request test failed for user {current_user.user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Test failed: {str(e)}")

@router.post("/execute")
async def execute_http_request_endpoint(
    request_data: dict,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Execute HTTP request for workflow execution
    """
    try:
        # Validate required fields
        if 'url' not in request_data:
            raise HTTPException(status_code=400, detail="URL is required")
        
        # Extract input data and loop configuration
        input_data = request_data.get('inputData', {})
        loop_config = request_data.get('loopConfig', {})
        use_proxy = request_data.get('useProxy', False)
        
        results = []
        
        # Check if this is a loop execution
        if loop_config.get('enabled', False):
            loop_params = loop_config.get('parameters', [])
            
            for param in loop_params:
                param_name = param.get('name')
                param_values = param.get('values', [])
                
                for value in param_values:
                    # Create variables for this iteration
                    iteration_vars = input_data.copy()
                    iteration_vars[param_name] = value
                    
                    # Execute request with iteration variables
                    result = await execute_single_request(request_data, iteration_vars, use_proxy)
                    result['loop_iteration'] = {
                        'parameter': param_name,
                        'value': value
                    }
                    results.append(result)
        else:
            # Single execution
            result = await execute_single_request(request_data, input_data, use_proxy)
            results.append(result)
        
        # Aggregate results
        successful_requests = [r for r in results if r.get('success', False)]
        failed_requests = [r for r in results if not r.get('success', False)]
        
        logger.info(f"User {current_user.user_id} executed {len(results)} HTTP request(s) to {request_data.get('url')}")
        
        return {
            'success': len(failed_requests) == 0,
            'total_requests': len(results),
            'successful_requests': len(successful_requests),
            'failed_requests': len(failed_requests),
            'results': results,
            'summary': {
                'success_rate': len(successful_requests) / len(results) if results else 0,
                'avg_response_time': sum(r.get('response', {}).get('elapsed_ms', 0) for r in successful_requests) / len(successful_requests) if successful_requests else 0
            },
            'executed_at': datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"HTTP request execution failed for user {current_user.user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Execution failed: {str(e)}")

@router.get("/methods")
async def get_supported_methods(
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Get list of supported HTTP methods
    """
    return {
        'success': True,
        'methods': SUPPORTED_METHODS,
        'default_method': 'GET'
    }

@router.get("/auth-types")
async def get_auth_types(
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Get list of supported authentication types
    """
    return {
        'success': True,
        'auth_types': [
            {
                'type': 'none',
                'name': 'No Authentication',
                'description': 'No authentication required'
            },
            {
                'type': 'api_key',
                'name': 'API Key',
                'description': 'API key in header or query parameter'
            },
            {
                'type': 'bearer',
                'name': 'Bearer Token',
                'description': 'Bearer token in Authorization header'
            },
            {
                'type': 'basic',
                'name': 'Basic Auth',
                'description': 'Username and password authentication'
            },
            {
                'type': 'oauth2',
                'name': 'OAuth 2.0',
                'description': 'OAuth 2.0 access token'
            },
            {
                'type': 'custom',
                'name': 'Custom Headers',
                'description': 'Custom authentication headers'
            }
        ]
    }