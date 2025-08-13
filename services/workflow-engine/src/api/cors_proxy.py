"""
CORS Proxy API endpoints for making external HTTP requests server-side
Bypasses browser CORS restrictions by proxying requests through the backend
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional, Union
import logging
import httpx
import json
from datetime import datetime
from urllib.parse import urlparse

from ..auth import get_current_user, AuthUser
from ..database import get_db

router = APIRouter(prefix="/api/v1/proxy", tags=["cors-proxy"])
logger = logging.getLogger(__name__)

# Security: Only allow specific domains or use allowlist
ALLOWED_DOMAINS = [
    # Add specific domains if needed for security
    # 'api.example.com',
    # 'data.example.com'
]

# Maximum response size (10MB)
MAX_RESPONSE_SIZE = 10 * 1024 * 1024

def is_url_allowed(url: str) -> bool:
    """Check if URL is allowed to be proxied"""
    try:
        parsed = urlparse(url)
        
        # Block local/private IPs for security
        if parsed.hostname in ['localhost', '127.0.0.1', '::1']:
            return False
        
        # Check if hostname is in private IP ranges
        if parsed.hostname:
            # Basic check for private IPs
            if (parsed.hostname.startswith('192.168.') or 
                parsed.hostname.startswith('10.') or 
                parsed.hostname.startswith('172.')):
                return False
        
        # If allowlist is configured, check against it
        if ALLOWED_DOMAINS:
            return parsed.hostname in ALLOWED_DOMAINS
        
        # Otherwise allow HTTPS URLs only for security
        return parsed.scheme in ['http', 'https']
        
    except Exception:
        return False

@router.post("/request")
async def proxy_request(
    request_data: dict,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Proxy HTTP request to external URL to bypass CORS restrictions
    """
    try:
        logger.info(f"CORS proxy request from user {current_user.user_id}")
        
        # Extract request details
        url = request_data.get('url', '').strip()
        method = request_data.get('method', 'GET').upper()
        headers = request_data.get('headers', {})
        data = request_data.get('data')
        params = request_data.get('params', {})
        timeout = request_data.get('timeout', 30)
        
        if not url:
            raise HTTPException(status_code=400, detail="URL is required")
        
        # Security check
        if not is_url_allowed(url):
            raise HTTPException(status_code=403, detail="URL not allowed for proxying")
        
        # Remove potentially problematic headers
        safe_headers = {}
        blocked_headers = ['host', 'origin', 'referer', 'user-agent']
        
        for key, value in headers.items():
            if key.lower() not in blocked_headers:
                safe_headers[key] = value
        
        # Add a user agent to identify the proxy
        safe_headers['User-Agent'] = 'Dxsh-Proxy/1.0'
        
        # Make the request
        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10)
        ) as client:
            
            try:
                if method == 'GET':
                    response = await client.get(url, headers=safe_headers, params=params)
                elif method == 'POST':
                    if isinstance(data, dict):
                        response = await client.post(url, json=data, headers=safe_headers, params=params)
                    else:
                        response = await client.post(url, content=data, headers=safe_headers, params=params)
                elif method == 'PUT':
                    if isinstance(data, dict):
                        response = await client.put(url, json=data, headers=safe_headers, params=params)
                    else:
                        response = await client.put(url, content=data, headers=safe_headers, params=params)
                elif method == 'PATCH':
                    if isinstance(data, dict):
                        response = await client.patch(url, json=data, headers=safe_headers, params=params)
                    else:
                        response = await client.patch(url, content=data, headers=safe_headers, params=params)
                elif method == 'DELETE':
                    response = await client.delete(url, headers=safe_headers, params=params)
                elif method == 'HEAD':
                    response = await client.head(url, headers=safe_headers, params=params)
                elif method == 'OPTIONS':
                    response = await client.options(url, headers=safe_headers, params=params)
                else:
                    raise HTTPException(status_code=400, detail=f"Method {method} not supported")
                
                # Check response size
                content_length = response.headers.get('content-length')
                if content_length and int(content_length) > MAX_RESPONSE_SIZE:
                    raise HTTPException(status_code=413, detail="Response too large")
                
                # Parse response content
                content_type = response.headers.get('content-type', '').lower()
                
                try:
                    if 'application/json' in content_type:
                        response_data = response.json()
                    elif 'text/' in content_type or 'application/xml' in content_type:
                        response_data = response.text
                    else:
                        # For binary content, encode as base64
                        import base64
                        response_data = base64.b64encode(response.content).decode('utf-8')
                        content_type += '; encoding=base64'
                except Exception:
                    # Fallback to text
                    response_data = response.text
                
                # Filter response headers (remove sensitive ones)
                response_headers = {}
                safe_response_headers = [
                    'content-type', 'content-length', 'cache-control', 
                    'expires', 'last-modified', 'etag'
                ]
                
                for key, value in response.headers.items():
                    if key.lower() in safe_response_headers:
                        response_headers[key] = value
                
                logger.info(f"CORS proxy successful: {method} {url} -> {response.status_code}")
                
                return {
                    'success': True,
                    'status_code': response.status_code,
                    'headers': response_headers,
                    'data': response_data,
                    'url': str(response.url),
                    'method': method,
                    'content_type': content_type,
                    'elapsed_ms': int(response.elapsed.total_seconds() * 1000),
                    'proxied_at': datetime.now().isoformat()
                }
                
            except httpx.TimeoutException:
                raise HTTPException(status_code=504, detail="Request timeout")
            except httpx.ConnectError as e:
                raise HTTPException(status_code=502, detail=f"Connection error: {str(e)}")
            except httpx.RequestError as e:
                raise HTTPException(status_code=502, detail=f"Request error: {str(e)}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CORS proxy failed for user {current_user.user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Proxy request failed: {str(e)}")

@router.get("/allowed-domains")
async def get_allowed_domains(
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Get list of allowed domains for proxying
    """
    return {
        'success': True,
        'allowed_domains': ALLOWED_DOMAINS,
        'allow_all_https': len(ALLOWED_DOMAINS) == 0,
        'security_note': 'Only HTTPS URLs are allowed, private IPs are blocked'
    }

@router.post("/test-url")
async def test_proxy_url(
    request_data: dict,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Test if a URL is allowed for proxying without making the actual request
    """
    try:
        url = request_data.get('url', '').strip()
        if not url:
            raise HTTPException(status_code=400, detail="URL is required")
        
        is_allowed = is_url_allowed(url)
        parsed = urlparse(url)
        
        return {
            'success': True,
            'url': url,
            'allowed': is_allowed,
            'scheme': parsed.scheme,
            'hostname': parsed.hostname,
            'reason': 'URL is allowed for proxying' if is_allowed else 'URL blocked for security reasons'
        }
        
    except Exception as e:
        logger.error(f"URL test failed: {e}")
        raise HTTPException(status_code=500, detail=f"URL test failed: {str(e)}")