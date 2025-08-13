"""
CSS Selector Tool API endpoints for visual element selection and testing
Supports CSS selector validation, element inspection, and data extraction
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional, Union
import logging
import httpx
import json
from datetime import datetime
from bs4 import BeautifulSoup
import re
from urllib.parse import urljoin, urlparse

from ..auth import get_current_user, AuthUser
from ..database import get_db

router = APIRouter(prefix="/api/v1/css-selector", tags=["css-selector"])
logger = logging.getLogger(__name__)

def validate_css_selector(selector: str) -> Dict[str, Any]:
    """Validate CSS selector syntax"""
    try:
        # Use BeautifulSoup to validate selector
        soup = BeautifulSoup('<div></div>', 'html.parser')
        soup.select(selector)
        return {'valid': True, 'error': None}
    except Exception as e:
        return {'valid': False, 'error': str(e)}

def extract_elements_data(html: str, selector: str, extract_attributes: List[str] = None) -> List[Dict[str, Any]]:
    """Extract data from elements matching CSS selector"""
    try:
        soup = BeautifulSoup(html, 'html.parser')
        elements = soup.select(selector)
        
        results = []
        for i, element in enumerate(elements):
            element_data = {
                'index': i,
                'tag_name': element.name,
                'text': element.get_text(strip=True),
                'html': str(element),
                'attributes': dict(element.attrs)
            }
            
            # Extract specific attributes if requested
            if extract_attributes:
                extracted_attrs = {}
                for attr in extract_attributes:
                    if attr in element.attrs:
                        extracted_attrs[attr] = element.attrs[attr]
                    elif attr == 'text':
                        extracted_attrs['text'] = element.get_text(strip=True)
                    elif attr == 'href' and element.name == 'a':
                        extracted_attrs['href'] = element.get('href', '')
                    elif attr == 'src' and element.name in ['img', 'script', 'iframe']:
                        extracted_attrs['src'] = element.get('src', '')
                element_data['extracted_attributes'] = extracted_attrs
            
            results.append(element_data)
        
        return results
    except Exception as e:
        logger.error(f"Error extracting elements with selector '{selector}': {e}")
        return []

def analyze_page_structure(html: str) -> Dict[str, Any]:
    """Analyze page structure for better selector suggestions"""
    try:
        soup = BeautifulSoup(html, 'html.parser')
        
        # Find common elements
        structure = {
            'title': soup.title.get_text() if soup.title else '',
            'headings': {
                'h1': len(soup.find_all('h1')),
                'h2': len(soup.find_all('h2')),
                'h3': len(soup.find_all('h3')),
                'h4': len(soup.find_all('h4')),
                'h5': len(soup.find_all('h5')),
                'h6': len(soup.find_all('h6'))
            },
            'content_elements': {
                'paragraphs': len(soup.find_all('p')),
                'articles': len(soup.find_all('article')),
                'sections': len(soup.find_all('section')),
                'divs': len(soup.find_all('div')),
                'spans': len(soup.find_all('span'))
            },
            'interactive_elements': {
                'links': len(soup.find_all('a')),
                'buttons': len(soup.find_all('button')),
                'forms': len(soup.find_all('form')),
                'inputs': len(soup.find_all('input'))
            },
            'media_elements': {
                'images': len(soup.find_all('img')),
                'videos': len(soup.find_all('video')),
                'iframes': len(soup.find_all('iframe'))
            },
            'data_elements': {
                'tables': len(soup.find_all('table')),
                'lists': len(soup.find_all(['ul', 'ol'])),
                'list_items': len(soup.find_all('li'))
            }
        }
        
        # Find elements with common class patterns
        common_classes = []
        for element in soup.find_all(class_=True):
            for class_name in element['class']:
                if any(keyword in class_name.lower() for keyword in 
                      ['content', 'main', 'header', 'footer', 'nav', 'menu', 
                       'article', 'post', 'title', 'price', 'button']):
                    common_classes.append(class_name)
        
        # Get unique common classes
        structure['common_classes'] = list(set(common_classes))[:10]  # Limit to top 10
        
        # Find elements with IDs
        ids = []
        for element in soup.find_all(id=True):
            ids.append(element['id'])
        
        structure['ids'] = ids[:10]  # Limit to top 10
        
        return structure
    except Exception as e:
        logger.error(f"Error analyzing page structure: {e}")
        return {}

async def fetch_page_for_analysis(url: str, headers: Dict[str, str] = None, timeout: int = 30) -> Dict[str, Any]:
    """Fetch page content for CSS selector analysis"""
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            response = await client.get(url, headers=headers or {})
            
            return {
                'success': True,
                'content': response.text,
                'status_code': response.status_code,
                'headers': dict(response.headers),
                'url': str(response.url),
                'base_url': f"{urlparse(str(response.url)).scheme}://{urlparse(str(response.url)).netloc}"
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

@router.post("/test-selector")
async def test_css_selector(
    request_data: dict,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Test CSS selector against a webpage or HTML content
    """
    try:
        logger.info(f"CSS selector test called with data keys: {list(request_data.keys())}")
        
        selector = request_data.get('selector', '').strip()
        if not selector:
            raise HTTPException(status_code=400, detail="CSS selector is required")
        
        # Validate selector syntax
        validation = validate_css_selector(selector)
        if not validation['valid']:
            raise HTTPException(status_code=400, detail=f"Invalid CSS selector: {validation['error']}")
        
        # Get HTML content (either from URL or direct HTML)
        html_content = ''
        if 'url' in request_data and request_data['url']:
            url = request_data['url'].strip()
            headers = request_data.get('headers', {})
            timeout = request_data.get('timeout', 30)
            
            page_result = await fetch_page_for_analysis(url, headers, timeout)
            if not page_result['success']:
                raise HTTPException(status_code=400, detail=f"Failed to fetch page: {page_result['error']}")
            
            html_content = page_result['content']
        elif 'html' in request_data:
            html_content = request_data['html']
        else:
            raise HTTPException(status_code=400, detail="Either 'url' or 'html' is required")
        
        # Extract elements using selector
        extract_attributes = request_data.get('extractAttributes', [])
        elements = extract_elements_data(html_content, selector, extract_attributes)
        
        # Analyze page structure if requested
        structure_analysis = None
        if request_data.get('analyzeStructure', False):
            structure_analysis = analyze_page_structure(html_content)
        
        logger.info(f"User {current_user.user_id} tested CSS selector '{selector}' - found {len(elements)} elements")
        
        return {
            'success': True,
            'selector': selector,
            'elements_found': len(elements),
            'elements': elements,
            'structure_analysis': structure_analysis,
            'tested_at': datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CSS selector test failed for user {current_user.user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Test failed: {str(e)}")

@router.post("/extract-data")
async def extract_data_with_selector(
    request_data: dict,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Extract data from webpage using CSS selector
    """
    try:
        # Get input data and configuration
        input_data = request_data.get('inputData', {})
        config = request_data.get('config', request_data)
        
        selector = config.get('selector', '').strip()
        if not selector:
            raise HTTPException(status_code=400, detail="CSS selector is required")
        
        # Validate selector syntax
        validation = validate_css_selector(selector)
        if not validation['valid']:
            raise HTTPException(status_code=400, detail=f"Invalid CSS selector: {validation['error']}")
        
        # Get HTML content
        html_content = ''
        source_url = ''
        
        if 'url' in config and config['url']:
            url = config['url'].strip()
            headers = config.get('headers', {})
            timeout = config.get('timeout', 30)
            
            page_result = await fetch_page_for_analysis(url, headers, timeout)
            if not page_result['success']:
                return {
                    'success': False,
                    'error': f"Failed to fetch page: {page_result['error']}",
                    'error_type': page_result['error_type'],
                    'executed_at': datetime.now().isoformat()
                }
            
            html_content = page_result['content']
            source_url = page_result['url']
        elif isinstance(input_data, dict) and 'html' in input_data:
            html_content = input_data['html']
        elif isinstance(input_data, dict) and 'content' in input_data:
            html_content = input_data['content']
        elif isinstance(input_data, str):
            html_content = input_data
        else:
            raise HTTPException(status_code=400, detail="No HTML content found in input data")
        
        # Extract elements using selector
        extract_attributes = config.get('extractAttributes', [])
        elements = extract_elements_data(html_content, selector, extract_attributes)
        
        # Format output based on configuration
        output_format = config.get('outputFormat', 'full')
        
        if output_format == 'text_only':
            output_data = [element['text'] for element in elements]
        elif output_format == 'attributes_only':
            output_data = [element.get('extracted_attributes', element['attributes']) for element in elements]
        elif output_format == 'first_element':
            output_data = elements[0] if elements else None
        elif output_format == 'count':
            output_data = len(elements)
        else:  # 'full' or default
            output_data = elements
        
        logger.info(f"User {current_user.user_id} extracted data with selector '{selector}' - found {len(elements)} elements")
        
        return {
            'success': True,
            'output': output_data,
            'metadata': {
                'selector': selector,
                'elements_found': len(elements),
                'output_format': output_format,
                'source_url': source_url,
                'has_extracted_attributes': bool(extract_attributes)
            },
            'executed_at': datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CSS selector extraction failed for user {current_user.user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")

@router.post("/analyze-page")
async def analyze_page_structure_endpoint(
    request_data: dict,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Analyze webpage structure to suggest CSS selectors
    """
    try:
        url = request_data.get('url', '').strip()
        if not url:
            raise HTTPException(status_code=400, detail="URL is required")
        
        headers = request_data.get('headers', {})
        timeout = request_data.get('timeout', 30)
        
        # Fetch page content
        page_result = await fetch_page_for_analysis(url, headers, timeout)
        if not page_result['success']:
            raise HTTPException(status_code=400, detail=f"Failed to fetch page: {page_result['error']}")
        
        # Analyze structure
        structure = analyze_page_structure(page_result['content'])
        
        # Generate selector suggestions based on structure
        suggestions = []
        
        # Suggest selectors for headings
        for heading, count in structure.get('headings', {}).items():
            if count > 0:
                suggestions.append({
                    'selector': heading,
                    'description': f'All {heading.upper()} headings ({count} found)',
                    'category': 'headings'
                })
        
        # Suggest selectors for common classes
        for class_name in structure.get('common_classes', []):
            suggestions.append({
                'selector': f'.{class_name}',
                'description': f'Elements with class "{class_name}"',
                'category': 'classes'
            })
        
        # Suggest selectors for IDs
        for id_name in structure.get('ids', []):
            suggestions.append({
                'selector': f'#{id_name}',
                'description': f'Element with ID "{id_name}"',
                'category': 'ids'
            })
        
        # Suggest common content selectors
        if structure.get('content_elements', {}).get('articles', 0) > 0:
            suggestions.append({
                'selector': 'article',
                'description': 'Article content elements',
                'category': 'content'
            })
        
        if structure.get('data_elements', {}).get('tables', 0) > 0:
            suggestions.append({
                'selector': 'table',
                'description': 'Table data',
                'category': 'data'
            })
        
        logger.info(f"User {current_user.user_id} analyzed page structure for {url}")
        
        return {
            'success': True,
            'url': url,
            'structure': structure,
            'suggestions': suggestions[:20],  # Limit suggestions
            'analyzed_at': datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Page analysis failed for user {current_user.user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@router.get("/common-selectors")
async def get_common_css_selectors(
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Get list of commonly used CSS selectors
    """
    return {
        'success': True,
        'selectors': [
            {
                'category': 'Basic Elements',
                'selectors': [
                    {'selector': 'h1, h2, h3', 'description': 'All headings'},
                    {'selector': 'p', 'description': 'All paragraphs'},
                    {'selector': 'a', 'description': 'All links'},
                    {'selector': 'img', 'description': 'All images'},
                    {'selector': 'button', 'description': 'All buttons'}
                ]
            },
            {
                'category': 'Content Areas',
                'selectors': [
                    {'selector': 'main', 'description': 'Main content area'},
                    {'selector': 'article', 'description': 'Article content'},
                    {'selector': 'section', 'description': 'Section elements'},
                    {'selector': 'header', 'description': 'Header area'},
                    {'selector': 'footer', 'description': 'Footer area'},
                    {'selector': 'nav', 'description': 'Navigation area'}
                ]
            },
            {
                'category': 'Common Classes',
                'selectors': [
                    {'selector': '.content', 'description': 'Content class'},
                    {'selector': '.title', 'description': 'Title class'},
                    {'selector': '.price', 'description': 'Price class'},
                    {'selector': '.description', 'description': 'Description class'},
                    {'selector': '.button', 'description': 'Button class'},
                    {'selector': '.menu', 'description': 'Menu class'}
                ]
            },
            {
                'category': 'Data Extraction',
                'selectors': [
                    {'selector': 'table tr td', 'description': 'Table cell data'},
                    {'selector': 'ul li', 'description': 'List items'},
                    {'selector': '[data-*]', 'description': 'Data attributes'},
                    {'selector': '.price, [class*="price"]', 'description': 'Price information'},
                    {'selector': 'time, .date', 'description': 'Date/time information'}
                ]
            },
            {
                'category': 'Form Elements',
                'selectors': [
                    {'selector': 'input[type="text"]', 'description': 'Text inputs'},
                    {'selector': 'input[type="email"]', 'description': 'Email inputs'},
                    {'selector': 'textarea', 'description': 'Text areas'},
                    {'selector': 'select', 'description': 'Select dropdowns'},
                    {'selector': 'input[type="submit"]', 'description': 'Submit buttons'}
                ]
            }
        ]
    }

@router.get("/selector-tips")
async def get_css_selector_tips(
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Get tips and best practices for CSS selectors
    """
    return {
        'success': True,
        'tips': [
            {
                'category': 'Selector Syntax',
                'tips': [
                    'Use # for IDs: #main-content',
                    'Use . for classes: .highlight',
                    'Combine selectors: h1.title',
                    'Use descendant selectors: article p',
                    'Use child selectors: ul > li'
                ]
            },
            {
                'category': 'Best Practices',
                'tips': [
                    'Be as specific as needed, but not more',
                    'Prefer semantic HTML elements when available',
                    'Use data attributes for stable selection',
                    'Avoid deep nesting when possible',
                    'Test selectors on different page states'
                ]
            },
            {
                'category': 'Common Patterns',
                'tips': [
                    'First element: selector:first-child',
                    'Last element: selector:last-child',
                    'Contains text: selector:contains("text")',
                    'Has attribute: selector[attribute]',
                    'Attribute value: selector[attribute="value"]'
                ]
            },
            {
                'category': 'Troubleshooting',
                'tips': [
                    'Check if content loads dynamically',
                    'Verify selector syntax is correct',
                    'Use browser dev tools to test',
                    'Consider multiple selectors for fallbacks',
                    'Test with different content states'
                ]
            }
        ]
    }