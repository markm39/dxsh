"""
HTTP Request API endpoints for making external API calls
"""
from flask import request, jsonify
from app.api import api_bp
from app.auth import auth_required, get_current_user
from typing import Dict, Any, Optional
import logging
import requests
import json
from urllib.parse import urlencode

logger = logging.getLogger(__name__)


@api_bp.route('/http-request/test', methods=['POST'])
@auth_required
def test_http_request():
    """Test HTTP request configuration"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        data = request.get_json()
        
        # Validate required fields
        if not data.get('url'):
            return jsonify({
                'success': False,
                'error': 'URL is required'
            }), 400
        
        # Extract configuration
        config = {
            'url': data.get('url'),
            'method': data.get('method', 'GET').upper(),
            'headers': data.get('headers', {}),
            'queryParams': data.get('queryParams', {}),
            'body': data.get('body'),
            'authentication': data.get('authentication', {}),
            'timeout': data.get('timeout', 30)
        }
        
        # Execute the HTTP request
        result = execute_http_request(config)
        
        if result['success']:
            logger.info(f"User {user.user_id} successfully tested HTTP request to {config['url']}")
            return jsonify(result)
        else:
            logger.warning(f"User {user.user_id} failed HTTP request test: {result.get('error')}")
            return jsonify(result), 400
            
    except Exception as e:
        logger.error(f"HTTP request test error: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'HTTP request test failed: {str(e)}'
        }), 500


@api_bp.route('/http-request/execute', methods=['POST'])
@auth_required
def execute_http_request_endpoint():
    """Execute HTTP request for workflow execution"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        data = request.get_json()
        
        # Validate required fields
        if not data.get('url'):
            return jsonify({
                'success': False,
                'error': 'URL is required'
            }), 400
        
        # Extract configuration - similar to test but may include input data
        config = {
            'url': data.get('url'),
            'method': data.get('method', 'GET').upper(),
            'headers': data.get('headers', {}),
            'queryParams': data.get('queryParams', {}),
            'body': data.get('body'),
            'authentication': data.get('authentication', {}),
            'timeout': data.get('timeout', 30),
            'inputData': data.get('inputData')  # For variable substitution
        }
        
        # Execute the HTTP request
        result = execute_http_request(config)
        
        if result['success']:
            logger.info(f"User {user.user_id} successfully executed HTTP request to {config['url']}")
            return jsonify(result)
        else:
            logger.warning(f"User {user.user_id} failed HTTP request execution: {result.get('error')}")
            return jsonify(result), 400
            
    except Exception as e:
        logger.error(f"HTTP request execution error: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'HTTP request execution failed: {str(e)}'
        }), 500


def execute_http_request(config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute an HTTP request with the given configuration
    
    Args:
        config: Dictionary containing request configuration
        
    Returns:
        Dictionary with success status and response data
    """
    try:
        # Apply variable substitution if input data is provided
        processed_config = apply_variable_substitution(config)
        
        # Build authentication headers
        auth_headers = build_auth_headers(processed_config.get('authentication', {}))
        
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
                request_args['data'] = body
            else:
                request_args['json'] = body
        
        logger.info(f"Making HTTP request: {method} {final_url}")
        
        # Make the HTTP request
        response = requests.request(**request_args)
        
        # Parse response
        response_data = parse_response(response)
        
        return {
            'success': True,
            'data': {
                'status': response.status_code,
                'statusText': response.reason,
                'data': response_data,
                'headers': dict(response.headers),
                'url': final_url,
                'method': method,
                'success': response.ok
            }
        }
        
    except requests.exceptions.Timeout:
        return {
            'success': False,
            'error': f'Request timeout after {config.get("timeout", 30)} seconds'
        }
    except requests.exceptions.ConnectionError as e:
        return {
            'success': False,
            'error': f'Connection error: {str(e)}'
        }
    except requests.exceptions.RequestException as e:
        return {
            'success': False,
            'error': f'Request failed: {str(e)}'
        }
    except Exception as e:
        return {
            'success': False,
            'error': f'Unexpected error: {str(e)}'
        }


def apply_variable_substitution(config: Dict[str, Any]) -> Dict[str, Any]:
    """Apply variable substitution using input data"""
    input_data = config.get('inputData')
    if not input_data:
        return config
    
    processed_config = config.copy()
    
    def substitute_variables(text: str) -> str:
        """Replace {{variable}} patterns with values from input data"""
        if not isinstance(text, str):
            return text
            
        import re
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


def build_auth_headers(auth_config: Dict[str, Any]) -> Dict[str, str]:
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
            import base64
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


def parse_response(response: requests.Response) -> Any:
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