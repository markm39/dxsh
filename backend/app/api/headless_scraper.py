"""
Headless Browser Scraping API

Provides production-ready web scraping using Playwright instead of HTTP proxies.
Handles JavaScript execution, anti-bot detection, and structured data extraction.
"""

import logging
import asyncio
from typing import List, Dict, Optional
from flask import request, jsonify
from flask_cors import cross_origin
from app.api import api_bp
from app.auth import auth_required
from app.services.playwright_service import PlaywrightService
import json

logger = logging.getLogger(__name__)

@api_bp.route('/scrape', methods=['POST'])
@cross_origin(origins='*')
@auth_required
def scrape_headless():
    """
    Scrape a website using headless browser with visual selector configurations
    
    Request Body:
        {
            "url": "https://example.com",
            "selectors": [
                {
                    "name": "title",
                    "selector": "h1",
                    "attribute": "textContent",
                    "type": "all|table|repeating"
                }
            ],
            "options": {
                "wait_for_load": true,
                "timeout": 30000
            }
        }
        
    Returns:
        {
            "success": true,
            "url": "https://example.com",
            "data": {...},
            "page_info": {...}
        }
    """
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'Request body must be JSON'
            }), 400
        
        url = data.get('url')
        selectors = data.get('selectors', [])
        options = data.get('options', {})
        
        if not url:
            return jsonify({
                'success': False,
                'error': 'Missing required parameter: url'
            }), 400
        
        if not selectors:
            return jsonify({
                'success': False,
                'error': 'Missing required parameter: selectors'
            }), 400
        
        # Set default options
        wait_for_load = options.get('wait_for_load', True)
        timeout = options.get('timeout', 30000)
        
        logger.info(f"Starting headless scrape of: {url}")
        logger.info(f"Selectors to process: {len(selectors)}")
        
        # Run the scraping operation
        result = asyncio.run(scrape_with_playwright(url, selectors, wait_for_load, timeout))
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error in headless scraper: {e}")
        return jsonify({
            'success': False,
            'error': f'Internal server error: {str(e)}'
        }), 500

async def scrape_with_playwright(url: str, selectors: List[Dict], wait_for_load: bool = True, timeout: int = 30000) -> Dict:
    """
    Perform the actual scraping using PlaywrightService
    """
    async with PlaywrightService() as service:
        try:
            # Load the page
            logger.info(f"Loading page: {url}")
            await service.load_page(url, wait_for_load)
            
            # Get page info
            page_info = await service.get_page_info()
            logger.info(f"Page loaded successfully: {page_info.get('title', 'Unknown')}")
            
            # Extract data using the enhanced extraction method
            extracted_data = await service.extract_all_content(selectors)
            
            logger.info(f"Extraction completed. Results: {len(extracted_data) if extracted_data else 0} items")
            
            return {
                'success': True,
                'url': url,
                'data': extracted_data[0] if extracted_data else {},
                'page_info': page_info,
                'selectors_processed': len(selectors),
                'extraction_method': 'headless_browser'
            }
            
        except Exception as e:
            logger.error(f"Error scraping {url}: {e}")
            return {
                'success': False,
                'url': url,
                'error': str(e),
                'data': {},
                'page_info': {},
                'selectors_processed': 0,
                'extraction_method': 'headless_browser'
            }

@api_bp.route('/scrape/test-selector', methods=['POST'])
@cross_origin(origins='*')
@auth_required
def test_selector_headless():
    """
    Test a CSS selector on a page using headless browser
    
    Request Body:
        {
            "url": "https://example.com",
            "selector": "h1"
        }
        
    Returns:
        Information about what the selector matches
    """
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'Request body must be JSON'
            }), 400
        
        url = data.get('url')
        selector = data.get('selector')
        
        if not url or not selector:
            return jsonify({
                'success': False,
                'error': 'Missing required parameters: url and selector'
            }), 400
        
        logger.info(f"Testing selector '{selector}' on: {url}")
        
        # Run the selector test
        result = asyncio.run(test_selector_with_playwright(url, selector))
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error testing selector: {e}")
        return jsonify({
            'success': False,
            'error': f'Internal server error: {str(e)}'
        }), 500

async def test_selector_with_playwright(url: str, selector: str) -> Dict:
    """
    Test a selector using PlaywrightService
    """
    async with PlaywrightService() as service:
        try:
            # Load the page
            await service.load_page(url, wait_for_load=True)
            
            # Test the selector
            test_result = await service.test_selector(selector)
            
            return {
                'success': True,
                'url': url,
                'selector': selector,
                'result': test_result
            }
            
        except Exception as e:
            logger.error(f"Error testing selector {selector} on {url}: {e}")
            return {
                'success': False,
                'url': url,
                'selector': selector,
                'error': str(e),
                'result': {}
            }

@api_bp.route('/scrape/load-for-selection', methods=['GET'])
@cross_origin(origins='*')
@auth_required
def load_page_for_visual_selection():
    """
    Load a page using headless browser and return HTML for visual selection
    This replaces the CORS proxy for sites that block HTTP requests
    """
    try:
        url = request.args.get('url')
        if not url:
            return jsonify({
                'success': False,
                'error': 'Missing required parameter: url'
            }), 400
        
        logger.info(f"Loading page for visual selection: {url}")
        
        # Run the page loading
        result = asyncio.run(load_page_with_browser(url))
        
        if result['success']:
            # Return the HTML with CORS headers for iframe embedding
            from flask import Response
            
            # Inject the visual selector script into the HTML
            html_content = result['html']
            selector_script = get_visual_selector_script()
            
            # Insert before closing head tag if it exists
            if '</head>' in html_content:
                html_content = html_content.replace('</head>', selector_script + '</head>')
            elif '<body>' in html_content:
                html_content = html_content.replace('<body>', '<body>' + selector_script)
            else:
                html_content = selector_script + html_content
            
            response = Response(
                html_content,
                status=200,
                headers={
                    'Content-Type': 'text/html; charset=utf-8',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'X-Frame-Options': 'ALLOWALL'
                }
            )
            
            logger.info(f"Successfully loaded page for visual selection: {url}")
            return response
        else:
            return jsonify({
                'success': False,
                'error': result.get('error', 'Failed to load page'),
                'suggestion': 'Try using manual CSS selector'
            }), 502
            
    except Exception as e:
        logger.error(f"Error loading page for visual selection: {e}")
        return jsonify({
            'success': False,
            'error': f'Internal server error: {str(e)}'
        }), 500

async def load_page_with_browser(url: str) -> Dict:
    """Load a page using headless browser and return the HTML"""
    async with PlaywrightService() as service:
        try:
            # Load the page
            await service.load_page(url, wait_for_load=True)
            
            # Get the HTML content
            html_content = await service.page.content()
            page_info = await service.get_page_info()
            
            return {
                'success': True,
                'html': html_content,
                'page_info': page_info
            }
            
        except Exception as e:
            logger.error(f"Error loading page with browser {url}: {e}")
            return {
                'success': False,
                'error': str(e)
            }

def get_visual_selector_script():
    """Get the visual selector script to inject into pages"""
    return '''
    <style>
    /* Disable all interactions by default */
    body {
        pointer-events: none !important;
        user-select: none !important;
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
    }
    
    /* Re-enable interactions only for our selector system */
    .element-selector-active {
        pointer-events: auto !important;
    }
    
    /* Disable specific interactive elements */
    a, button, input, textarea, select, form,
    [onclick], [onmousedown], [onmouseup], [role="button"] {
        pointer-events: none !important;
        cursor: default !important;
    }
    
    /* Visual element highlights - High specificity */
    html body .temp-multi-hover,
    html body .temp-multi-hover * {
        background-color: rgba(0, 212, 255, 0.2) !important;
        outline: 2px solid #00d4ff !important;
        outline-offset: -2px !important;
        position: relative !important;
        z-index: 999998 !important;
    }
    
    html body .temp-field-hover,
    html body .temp-field-hover * {
        background-color: rgba(245, 158, 11, 0.2) !important;
        outline: 2px solid #f59e0b !important;
        outline-offset: -2px !important;
        position: relative !important;
        z-index: 999998 !important;
    }
    </style>
    
    <script>
    console.log('🎯 Visual Element Selector script injected by headless browser');
    
    // Visual Element Selector Integration
    window.addEventListener('message', function(event) {
        if (event.data.type === 'ENABLE_SELECTOR_MODE') {
            console.log('✅ Enabling selector mode');
            document.body.classList.add('element-selector-active');
            document.body.style.cursor = 'crosshair';
        } else if (event.data.type === 'DISABLE_SELECTOR_MODE') {
            console.log('❌ Disabling selector mode');
            document.body.classList.remove('element-selector-active');
            document.body.style.cursor = '';
            document.querySelectorAll('.temp-multi-hover, .temp-field-hover').forEach(el => {
                el.classList.remove('temp-multi-hover', 'temp-field-hover');
            });
        } else if (event.data.type === 'GET_ELEMENT_AT_POINT') {
            const { x, y, action } = event.data;
            const element = document.elementFromPoint(x, y);
            
            if (element) {
                const rect = element.getBoundingClientRect();
                const selector = generateOptimalSelector(element);
                
                if (action === 'HOVER') {
                    // Clear previous highlights
                    document.querySelectorAll('.temp-multi-hover').forEach(el => {
                        el.classList.remove('temp-multi-hover');
                    });
                    
                    // Highlight matching elements
                    document.querySelectorAll(selector).forEach(match => {
                        match.classList.add('temp-multi-hover');
                    });
                } else if (action === 'SELECT') {
                    event.source.postMessage({
                        type: 'ELEMENT_SELECTED',
                        element: {
                            tagName: element.tagName,
                            id: element.id,
                            className: element.className,
                            textContent: element.textContent ? element.textContent.trim().slice(0, 100) : ''
                        },
                        selector: selector
                    }, event.origin);
                }
            }
        }
    });
    
    function generateOptimalSelector(element) {
        const tagName = element.tagName.toLowerCase();
        
        // Try ID first
        if (element.id && /^[a-zA-Z]/.test(element.id)) {
            return '#' + element.id;
        }
        
        // Try class-based selectors
        if (element.className && typeof element.className === 'string') {
            const classes = element.className.split(' ').filter(c => c.trim()).slice(0, 2);
            if (classes.length > 0) {
                const classSelector = tagName + '.' + classes.join('.');
                if (document.querySelectorAll(classSelector).length <= 5) {
                    return classSelector;
                }
            }
        }
        
        // Fallback to tag name
        return tagName;
    }
    
    // Disable default interactions
    document.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }, true);
    
    document.addEventListener('submit', function(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }, true);
    </script>
    '''

@api_bp.route('/scrape/health', methods=['GET'])
@cross_origin(origins='*')
def headless_scraper_health():
    """Health check for headless scraper service"""
    try:
        # Test that we can import and initialize Playwright
        from playwright.async_api import async_playwright
        
        return jsonify({
            'status': 'healthy',
            'service': 'headless_scraper',
            'browser_engine': 'playwright_chromium',
            'features': [
                'javascript_execution',
                'anti_bot_detection',
                'structured_data_extraction',
                'table_extraction',
                'repeating_container_extraction'
            ]
        })
        
    except ImportError as e:
        return jsonify({
            'status': 'unhealthy',
            'service': 'headless_scraper',
            'error': f'Playwright not available: {str(e)}'
        }), 503
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'service': 'headless_scraper',
            'error': str(e)
        }), 503