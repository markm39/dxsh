"""
Monitoring API endpoints for web page changes and alerts
Supports URL monitoring, change detection, and notification triggers
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional, Union
import logging
import httpx
import hashlib
import json
from datetime import datetime, timedelta
from bs4 import BeautifulSoup
import re

from ..auth import get_current_user, AuthUser
from ..database import get_db

router = APIRouter(prefix="/api/v1/monitoring", tags=["monitoring"])
logger = logging.getLogger(__name__)

def calculate_content_hash(content: str) -> str:
    """Calculate hash of content for change detection"""
    return hashlib.md5(content.encode()).hexdigest()

def extract_content_by_selector(html: str, selector: str) -> str:
    """Extract content using CSS selector"""
    try:
        soup = BeautifulSoup(html, 'html.parser')
        elements = soup.select(selector)
        
        if not elements:
            return ""
        
        # Return text content of all matching elements
        return "\n".join(element.get_text(strip=True) for element in elements)
    except Exception as e:
        logger.warning(f"Error extracting content with selector '{selector}': {e}")
        return ""

def detect_changes(old_content: str, new_content: str, sensitivity: str = 'medium') -> Dict[str, Any]:
    """Detect changes between old and new content"""
    if not old_content or not new_content:
        return {
            'has_changes': bool(new_content != old_content),
            'change_type': 'content_missing',
            'similarity_score': 0.0
        }
    
    # Calculate similarity score
    old_lines = set(old_content.split('\n'))
    new_lines = set(new_content.split('\n'))
    
    if not old_lines and not new_lines:
        similarity_score = 1.0
    elif not old_lines or not new_lines:
        similarity_score = 0.0
    else:
        intersection = old_lines.intersection(new_lines)
        union = old_lines.union(new_lines)
        similarity_score = len(intersection) / len(union) if union else 1.0
    
    # Determine if changes are significant based on sensitivity
    sensitivity_thresholds = {
        'low': 0.9,      # Only detect major changes
        'medium': 0.95,   # Detect moderate changes
        'high': 0.99     # Detect minor changes
    }
    
    threshold = sensitivity_thresholds.get(sensitivity, 0.95)
    has_changes = similarity_score < threshold
    
    # Determine change type
    change_type = 'no_change'
    if has_changes:
        if similarity_score < 0.5:
            change_type = 'major_change'
        elif similarity_score < 0.8:
            change_type = 'moderate_change'
        else:
            change_type = 'minor_change'
    
    return {
        'has_changes': has_changes,
        'change_type': change_type,
        'similarity_score': similarity_score,
        'old_hash': calculate_content_hash(old_content),
        'new_hash': calculate_content_hash(new_content)
    }

async def fetch_page_content(url: str, headers: Dict[str, str] = None, timeout: int = 30) -> Dict[str, Any]:
    """Fetch page content with error handling"""
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            response = await client.get(url, headers=headers or {})
            
            return {
                'success': True,
                'content': response.text,
                'status_code': response.status_code,
                'headers': dict(response.headers),
                'url': str(response.url),
                'elapsed_ms': int(response.elapsed.total_seconds() * 1000)
            }
    except httpx.TimeoutException:
        return {
            'success': False,
            'error': 'Request timeout',
            'error_type': 'timeout'
        }
    except httpx.ConnectError as e:
        return {
            'success': False,
            'error': f'Connection error: {str(e)}',
            'error_type': 'connection'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'error_type': 'general'
        }

@router.post("/test")
async def test_monitoring(
    request_data: dict,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Test monitoring configuration without saving to database
    """
    try:
        logger.info(f"Monitoring test called with data: {request_data}")
        
        # Get configuration
        config = request_data.get('config', request_data)
        url = config.get('url', '').strip()
        
        if not url:
            raise HTTPException(status_code=400, detail="URL is required")
        
        # Fetch current content
        headers = {}
        if config.get('headers'):
            headers = config['headers']
        
        timeout = config.get('timeout', 30)
        page_result = await fetch_page_content(url, headers, timeout)
        
        if not page_result['success']:
            raise HTTPException(status_code=400, detail=f"Failed to fetch page: {page_result['error']}")
        
        # Extract content using selector if provided
        selector = config.get('selector', '')
        if selector:
            extracted_content = extract_content_by_selector(page_result['content'], selector)
            page_result['extracted_content'] = extracted_content
            page_result['content_length'] = len(extracted_content)
        else:
            page_result['content_length'] = len(page_result['content'])
        
        # Calculate content hash
        content_to_monitor = page_result.get('extracted_content', page_result['content'])
        content_hash = calculate_content_hash(content_to_monitor)
        
        logger.info(f"User {current_user.user_id} tested monitoring for {url}")
        
        return {
            'success': True,
            'result': {
                'url': url,
                'status_code': page_result['status_code'],
                'content_hash': content_hash,
                'content_length': page_result['content_length'],
                'has_selector': bool(selector),
                'selector': selector,
                'response_time_ms': page_result.get('elapsed_ms', 0),
                'headers': page_result['headers']
            },
            'tested_at': datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Monitoring test failed for user {current_user.user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Test failed: {str(e)}")

@router.post("/check-changes")
async def check_for_changes(
    request_data: dict,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Check for changes between current content and previous content
    """
    try:
        # Get configuration and previous content
        config = request_data.get('config', {})
        previous_content = request_data.get('previousContent', '')
        url = config.get('url', '').strip()
        
        if not url:
            raise HTTPException(status_code=400, detail="URL is required")
        
        # Fetch current content
        headers = {}
        if config.get('headers'):
            headers = config['headers']
        
        timeout = config.get('timeout', 30)
        page_result = await fetch_page_content(url, headers, timeout)
        
        if not page_result['success']:
            raise HTTPException(status_code=400, detail=f"Failed to fetch page: {page_result['error']}")
        
        # Extract content using selector if provided
        selector = config.get('selector', '')
        current_content = page_result['content']
        if selector:
            current_content = extract_content_by_selector(page_result['content'], selector)
        
        # Detect changes
        sensitivity = config.get('sensitivity', 'medium')
        change_detection = detect_changes(previous_content, current_content, sensitivity)
        
        logger.info(f"User {current_user.user_id} checked changes for {url}: {change_detection['change_type']}")
        
        return {
            'success': True,
            'url': url,
            'has_changes': change_detection['has_changes'],
            'change_type': change_detection['change_type'],
            'similarity_score': change_detection['similarity_score'],
            'current_content': current_content,
            'content_hash': change_detection['new_hash'],
            'response_info': {
                'status_code': page_result['status_code'],
                'response_time_ms': page_result.get('elapsed_ms', 0)
            },
            'checked_at': datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Change detection failed for user {current_user.user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Change detection failed: {str(e)}")

@router.post("/execute")
async def execute_monitoring(
    request_data: dict,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Execute monitoring for workflow execution
    """
    try:
        # Get input data and configuration
        input_data = request_data.get('inputData', {})
        config = request_data.get('config', request_data)
        
        url = config.get('url', '').strip()
        if not url:
            raise HTTPException(status_code=400, detail="URL is required")
        
        # Fetch current content
        headers = {}
        if config.get('headers'):
            headers = config['headers']
        
        timeout = config.get('timeout', 30)
        page_result = await fetch_page_content(url, headers, timeout)
        
        if not page_result['success']:
            return {
                'success': False,
                'error': f"Failed to fetch page: {page_result['error']}",
                'error_type': page_result['error_type'],
                'url': url,
                'executed_at': datetime.now().isoformat()
            }
        
        # Extract content using selector if provided
        selector = config.get('selector', '')
        monitored_content = page_result['content']
        if selector:
            monitored_content = extract_content_by_selector(page_result['content'], selector)
        
        # Check for changes if previous content is provided
        change_detection = None
        if input_data and 'previous_content' in input_data:
            sensitivity = config.get('sensitivity', 'medium')
            change_detection = detect_changes(input_data['previous_content'], monitored_content, sensitivity)
        
        # Prepare output data
        output_data = {
            'url': url,
            'content': monitored_content,
            'content_hash': calculate_content_hash(monitored_content),
            'content_length': len(monitored_content),
            'status_code': page_result['status_code'],
            'response_time_ms': page_result.get('elapsed_ms', 0),
            'has_selector': bool(selector),
            'selector': selector
        }
        
        if change_detection:
            output_data.update({
                'has_changes': change_detection['has_changes'],
                'change_type': change_detection['change_type'],
                'similarity_score': change_detection['similarity_score']
            })
        
        logger.info(f"User {current_user.user_id} executed monitoring for {url}")
        
        return {
            'success': True,
            'output': output_data,
            'metadata': {
                'url': url,
                'status_code': page_result['status_code'],
                'has_changes': change_detection['has_changes'] if change_detection else None,
                'response_time_ms': page_result.get('elapsed_ms', 0),
                'content_type': page_result['headers'].get('content-type', '')
            },
            'executed_at': datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Monitoring execution failed for user {current_user.user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Execution failed: {str(e)}")

@router.get("/selectors")
async def get_common_selectors(
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Get list of common CSS selectors for monitoring
    """
    return {
        'success': True,
        'selectors': [
            {
                'name': 'Page Title',
                'selector': 'title',
                'description': 'Monitor page title changes'
            },
            {
                'name': 'Main Content',
                'selector': 'main, .main-content, #main',
                'description': 'Monitor main content area'
            },
            {
                'name': 'Article Body',
                'selector': 'article, .article-body, .post-content',
                'description': 'Monitor article or post content'
            },
            {
                'name': 'Price Information',
                'selector': '.price, .cost, .amount, [class*="price"]',
                'description': 'Monitor price or cost information'
            },
            {
                'name': 'Stock Status',
                'selector': '.stock, .availability, .in-stock, .out-of-stock',
                'description': 'Monitor stock or availability status'
            },
            {
                'name': 'News Headlines',
                'selector': 'h1, h2, .headline, .title',
                'description': 'Monitor headlines and titles'
            },
            {
                'name': 'Table Data',
                'selector': 'table, .data-table, .table',
                'description': 'Monitor tabular data'
            },
            {
                'name': 'List Items',
                'selector': 'ul li, ol li, .list-item',
                'description': 'Monitor list content'
            },
            {
                'name': 'Footer Information',
                'selector': 'footer, .footer',
                'description': 'Monitor footer content'
            },
            {
                'name': 'Navigation Menu',
                'selector': 'nav, .navigation, .menu',
                'description': 'Monitor navigation changes'
            }
        ]
    }

@router.get("/sensitivity-levels")
async def get_sensitivity_levels(
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Get list of available sensitivity levels for change detection
    """
    return {
        'success': True,
        'sensitivity_levels': [
            {
                'id': 'low',
                'name': 'Low Sensitivity',
                'description': 'Only detect major changes (>10% difference)',
                'threshold': 0.9
            },
            {
                'id': 'medium',
                'name': 'Medium Sensitivity',
                'description': 'Detect moderate changes (>5% difference)',
                'threshold': 0.95
            },
            {
                'id': 'high',
                'name': 'High Sensitivity',
                'description': 'Detect minor changes (>1% difference)',
                'threshold': 0.99
            }
        ]
    }