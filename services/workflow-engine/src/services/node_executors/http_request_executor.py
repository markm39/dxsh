"""
HTTP Request Executor

Makes external HTTP API calls with authentication and variable substitution
Extracted from backend/app/api/http_request.py
"""

import json
import logging
import re
import base64
from typing import Dict, Any, Optional
from urllib.parse import urlencode
import httpx
from .base_executor import BaseNodeExecutor, NodeExecutionResult

logger = logging.getLogger(__name__)


class HttpRequestExecutor(BaseNodeExecutor):
    """Execute HTTP request nodes for external API calls"""
    
    def __init__(self, node_config: Dict[str, Any]):
        super().__init__(node_config)
        self.node_type = 'httpRequest'
    
    def validate_config(self) -> bool:
        """Validate HTTP request node configuration"""
        try:
            node_data = self.node_config.get('data', {})
            
            # Handle nested httpRequest configuration from frontend
            if 'httpRequest' in node_data:
                data = node_data['httpRequest']
            else:
                data = node_data
            
            # Required fields
            if not data.get('url'):
                logger.error("HTTP request node requires 'url' field")
                return False
            
            # Validate method
            method = data.get('method', 'GET').upper()
            valid_methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
            if method not in valid_methods:
                logger.error(f"Invalid HTTP method: {method}. Must be one of: {valid_methods}")
                return False
            
            # Validate timeout
            timeout = data.get('timeout', 30)
            if not isinstance(timeout, (int, float)) or timeout <= 0:
                logger.error(f"Invalid timeout: {timeout}. Must be a positive number")
                return False
            
            # Validate authentication configuration if present
            auth_config = data.get('authentication', {})
            if auth_config.get('enabled'):
                auth_type = auth_config.get('type')
                valid_auth_types = ['apiKey', 'bearer', 'basic', 'oauth2', 'custom']
                if auth_type not in valid_auth_types:
                    logger.error(f"Invalid auth type: {auth_type}. Must be one of: {valid_auth_types}")
                    return False
                
                # Validate specific auth configurations
                if auth_type == 'apiKey':
                    api_key_config = auth_config.get('apiKey', {})
                    if not api_key_config.get('key') or not api_key_config.get('value'):
                        logger.error("API key authentication requires 'key' and 'value' fields")
                        return False
                    if api_key_config.get('location') not in ['header', 'query']:
                        logger.error("API key location must be 'header' or 'query'")
                        return False
                
                elif auth_type == 'bearer':
                    if not auth_config.get('bearerToken', {}).get('token'):
                        logger.error("Bearer token authentication requires 'token' field")
                        return False
                
                elif auth_type == 'basic':
                    basic_config = auth_config.get('basicAuth', {})
                    if not basic_config.get('username') or not basic_config.get('password'):
                        logger.error("Basic authentication requires 'username' and 'password' fields")
                        return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating HTTP request config: {e}")
            return False
    
    async def execute(self, input_data: Optional[Any] = None) -> NodeExecutionResult:
        """Execute HTTP request node"""
        try:
            # Get configuration
            logger.info(f"HTTP Request node config: {self.node_config}")
            node_data = self.node_config.get('data', {})
            
            # Handle nested httpRequest configuration from frontend
            if 'httpRequest' in node_data:
                data = node_data['httpRequest']
            else:
                data = node_data
            config = {
                'url': data.get('url', '').strip(),
                'method': data.get('method', 'GET').upper(),
                'headers': data.get('headers', {}),
                'queryParams': data.get('queryParams', {}),
                'body': data.get('body'),
                'authentication': data.get('authentication', {}),
                'timeout': data.get('timeout', 30),
                'inputData': input_data
            }
            
            # Apply variable substitution if input data is provided
            processed_config = self._apply_variable_substitution(config)
            
            # Build authentication headers
            auth_headers = self._build_auth_headers(processed_config.get('authentication', {}))
            
            # Build final headers
            final_headers = {
                **processed_config.get('headers', {}),
                **auth_headers
            }
            
            # Build query parameters
            query_params = processed_config.get('queryParams', {})
            
            # Add API key to query params if configured
            auth = processed_config.get('authentication', {})
            if (auth.get('enabled') and 
                auth.get('type') == 'apiKey' and 
                auth.get('apiKey', {}).get('location') == 'query'):
                api_key_config = auth.get('apiKey', {})
                if api_key_config.get('key') and api_key_config.get('value'):
                    query_params[api_key_config['key']] = api_key_config['value']
            
            # Build final URL
            final_url = processed_config['url']
            if query_params:
                separator = '&' if '?' in final_url else '?'
                final_url = f"{final_url}{separator}{urlencode(query_params)}"
            
            # Set content type for requests with body
            method = processed_config['method']
            body = processed_config.get('body')
            
            if method in ['POST', 'PUT', 'PATCH'] and body:
                if 'Content-Type' not in final_headers and 'content-type' not in final_headers:
                    final_headers['Content-Type'] = 'application/json'
            
            logger.info(f"Making HTTP request: {method} {final_url}")
            
            # Make the HTTP request using httpx for async support
            async with httpx.AsyncClient() as client:
                try:
                    # Prepare request arguments
                    request_args = {
                        'method': method,
                        'url': final_url,
                        'headers': final_headers,
                        'timeout': processed_config.get('timeout', 30)
                    }
                    
                    # Add body for methods that support it
                    if method in ['POST', 'PUT', 'PATCH'] and body:
                        if isinstance(body, str):
                            request_args['content'] = body
                        else:
                            request_args['json'] = body
                    
                    response = await client.request(**request_args)
                    
                    # Parse response
                    response_data = self._parse_response(response)
                    
                    result_data = {
                        'status': response.status_code,
                        'statusText': response.reason_phrase or '',
                        'data': response_data,
                        'headers': dict(response.headers),
                        'url': final_url,
                        'method': method,
                        'success': response.is_success
                    }
                    
                    return NodeExecutionResult(
                        node_id=self.node_id,
                        success=True,
                        data=result_data,
                        error=None,
                        metadata={
                            'status_code': response.status_code,
                            'response_size': len(response.content) if response.content else 0,
                            'content_type': response.headers.get('content-type', ''),
                            'request_method': method,
                            'request_url': final_url,
                            'has_auth': bool(auth.get('enabled')),
                            'variable_substituted': bool(input_data)
                        }
                    )
                    
                except httpx.TimeoutException:
                    return NodeExecutionResult(
                        node_id=self.node_id,
                        success=False,
                        data=None,
                        error=f"Request timeout after {config.get('timeout', 30)} seconds",
                        metadata={'error_type': 'timeout', 'timeout': config.get('timeout', 30)}
                    )
                    
                except httpx.ConnectError as e:
                    return NodeExecutionResult(
                        node_id=self.node_id,
                        success=False,
                        data=None,
                        error=f"Connection error: {str(e)}",
                        metadata={'error_type': 'connection', 'error_details': str(e)}
                    )
                    
                except httpx.RequestError as e:
                    return NodeExecutionResult(
                        node_id=self.node_id,
                        success=False,
                        data=None,
                        error=f"Request failed: {str(e)}",
                        metadata={'error_type': 'request', 'error_details': str(e)}
                    )
        
        except Exception as e:
            logger.error(f"Error in HTTP request execution: {e}")
            return NodeExecutionResult(
                node_id=self.node_id,
                success=False,
                data=None,
                error=f"HTTP request execution failed: {str(e)}",
                metadata={'error_type': 'general_error'}
            )
    
    def _apply_variable_substitution(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Apply variable substitution using input data"""
        input_data = config.get('inputData')
        if not input_data:
            return config
        
        processed_config = config.copy()
        
        def substitute_variables(text: str) -> str:
            """Replace {{variable}} patterns with values from input data"""
            if not isinstance(text, str):
                return text
                
            def replace_var(match):
                var_name = match.group(1).strip()
                if isinstance(input_data, dict) and var_name in input_data:
                    return str(input_data[var_name])
                return match.group(0)  # Return original if not found
            
            return re.sub(r'\{\{([^}]+)\}\}', replace_var, text)
        
        # Apply substitution to URL
        processed_config['url'] = substitute_variables(processed_config['url'])
        
        # Apply substitution to headers
        if processed_config.get('headers'):
            processed_headers = {}
            for key, value in processed_config['headers'].items():
                processed_headers[key] = substitute_variables(str(value))
            processed_config['headers'] = processed_headers
        
        # Apply substitution to query parameters
        if processed_config.get('queryParams'):
            processed_params = {}
            for key, value in processed_config['queryParams'].items():
                processed_params[key] = substitute_variables(str(value))
            processed_config['queryParams'] = processed_params
        
        # Apply substitution to body if it's a string
        if isinstance(processed_config.get('body'), str):
            processed_config['body'] = substitute_variables(processed_config['body'])
        
        return processed_config
    
    def _build_auth_headers(self, auth_config: Dict[str, Any]) -> Dict[str, str]:
        """Build authentication headers based on configuration"""
        headers = {}
        
        if not auth_config.get('enabled'):
            return headers
        
        auth_type = auth_config.get('type')
        
        if auth_type == 'apiKey':
            api_key_config = auth_config.get('apiKey', {})
            if (api_key_config.get('location') == 'header' and 
                api_key_config.get('key') and 
                api_key_config.get('value')):
                headers[api_key_config['key']] = api_key_config['value']
        
        elif auth_type == 'bearer':
            bearer_config = auth_config.get('bearerToken', {})
            if bearer_config.get('token'):
                headers['Authorization'] = f"Bearer {bearer_config['token']}"
        
        elif auth_type == 'basic':
            basic_config = auth_config.get('basicAuth', {})
            if basic_config.get('username') and basic_config.get('password'):
                credentials = f"{basic_config['username']}:{basic_config['password']}"
                encoded = base64.b64encode(credentials.encode()).decode()
                headers['Authorization'] = f"Basic {encoded}"
        
        elif auth_type == 'oauth2':
            oauth_config = auth_config.get('oauth2', {})
            if oauth_config.get('accessToken'):
                headers['Authorization'] = f"Bearer {oauth_config['accessToken']}"
        
        elif auth_type == 'custom':
            custom_headers = auth_config.get('customHeaders', {})
            for key, value in custom_headers.items():
                if key and value:
                    headers[key] = str(value)
        
        return headers
    
    def _parse_response(self, response: httpx.Response) -> Any:
        """Parse HTTP response based on content type"""
        try:
            content_type = response.headers.get('content-type', '').lower()
            
            if 'application/json' in content_type:
                return response.json()
            elif content_type.startswith('text/'):
                return response.text
            else:
                # For binary content, return basic info
                return {
                    'content_type': content_type,
                    'content_length': len(response.content),
                    'data': response.text if response.text else f"Binary content ({len(response.content)} bytes)"
                }
        except Exception:
            # Fallback to text if JSON parsing fails
            return response.text