from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
import httpx
import asyncio
import logging
from typing import Dict, Any
from urllib.parse import urlparse
import re
from ..auth import get_current_user, AuthUser
from ..services.playwright_service import PlaywrightService

router = APIRouter(prefix="/api/v1", tags=["scraping"])
logger = logging.getLogger(__name__)

# Security: Blocked domains and patterns
BLOCKED_DOMAINS = [
    'localhost', '127.0.0.1', '0.0.0.0', '10.', '192.168.', '172.16.',
    'malware', 'phishing', 'spam'
]

# Modern user agents for better compatibility - Updated for 2025
USER_AGENTS = [
    # Chrome (Windows)
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    # Chrome (macOS)
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    # Chrome (Linux)
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    # Firefox (Windows)
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    # Firefox (macOS)
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:122.0) Gecko/20100101 Firefox/122.0",
    # Safari (macOS)
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    # Edge (Windows)
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0",
]

def validate_url(url: str) -> str:
    """Validate and normalize URL for security"""
    try:
        parsed = urlparse(url)
        if not parsed.scheme:
            url = f"https://{url}"
            parsed = urlparse(url)
        
        if parsed.scheme not in ['http', 'https']:
            raise ValueError("Invalid URL scheme")
        
        # Check for blocked domains
        hostname = parsed.hostname or ''
        for blocked in BLOCKED_DOMAINS:
            if blocked in hostname.lower():
                raise ValueError(f"Access to {hostname} is blocked")
        
        return url
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid URL: {str(e)}")

@router.get("/proxy")
async def proxy_request(
    url: str,
    token: str = None,
    current_user: AuthUser = Depends(get_current_user)
):
    """CORS proxy endpoint for loading external websites"""
    try:
        # Validate URL
        validated_url = validate_url(url)
        
        # Add random delay to appear more human-like
        import random
        import asyncio
        delay = random.uniform(0.1, 0.5)
        await asyncio.sleep(delay)
        
        # Use random user agent for better compatibility
        user_agent = random.choice(USER_AGENTS)
        
        # Generate browser-specific headers based on user agent
        if 'Chrome' in user_agent or 'Edg' in user_agent:
            accept_header = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7'
            sec_headers = {
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
            }
        elif 'Firefox' in user_agent:
            accept_header = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
            sec_headers = {}
        else:  # Safari
            accept_header = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            sec_headers = {}
        
        # Make HTTP request with proper headers based on user agent
        headers = {
            'User-Agent': user_agent,
            'Accept': accept_header,
            'Accept-Language': random.choice([
                'en-US,en;q=0.9',
                'en-US,en;q=0.8',
                'en-GB,en-US;q=0.9,en;q=0.8',
                'en-US,en;q=0.5'
            ]),
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0',
            'Pragma': 'no-cache',
        }
        
        # Add browser-specific security headers
        headers.update(sec_headers)
        
        # Add referer for some sites that require it
        parsed_url = urlparse(validated_url)
        if parsed_url.netloc:
            headers['Referer'] = f"{parsed_url.scheme}://{parsed_url.netloc}/"
        
        # Use session-like behavior with longer timeout
        async with httpx.AsyncClient(
            timeout=60.0, 
            follow_redirects=True,
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5)
        ) as client:
            response = await client.get(validated_url, headers=headers)
            
            # Check for bot protection
            content = response.text
            content_lower = content.lower()
            
            # Check for common bot protection indicators
            protection_indicators = [
                'cloudflare', 'just a moment', 'checking your browser',
                'ddos protection', 'captcha', 'access denied', 'security check',
                'please enable cookies', 'please enable javascript',
                'ray id', 'cf-ray', 'blocked by administrator', 'bot detected'
            ]
            
            detected_protection = None
            for indicator in protection_indicators:
                if indicator in content_lower:
                    detected_protection = indicator
                    break
            
            if detected_protection:
                logger.warning(f"Bot protection detected on {validated_url}: {detected_protection}")
                # Return error but still try to serve the content
                raise HTTPException(
                    status_code=403, 
                    detail=f"Website has bot protection ({detected_protection}). Visual selector may not work properly."
                )
            
            # Inject visual selector script if HTML
            if 'text/html' in response.headers.get('content-type', ''):
                content = inject_visual_selector_script(content)
            
            # Prepare response headers for iframe compatibility
            response_headers = {
                'Content-Type': response.headers.get('content-type', 'text/html'),
                'X-Frame-Options': 'ALLOWALL',
                'Content-Security-Policy': "frame-ancestors *",
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': '*',
            }
            
            return Response(
                content=content,
                status_code=response.status_code,
                headers=response_headers
            )
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=408, detail="Request timeout - website took too long to respond")
    except httpx.RequestError as e:
        logger.error(f"Request error for {url}: {str(e)}")
        raise HTTPException(status_code=503, detail=f"Could not connect to website: {str(e)}")
    except Exception as e:
        logger.error(f"Proxy error for {url}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Proxy error: {str(e)}")

@router.get("/scrape/load-for-selection")
async def load_for_selection(
    url: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """Load page using headless browser for visual element selection"""
    try:
        # Validate URL
        validated_url = validate_url(url)
        
        # Use Playwright service with proper context management
        async with PlaywrightService() as playwright_service:
            # Load page with Playwright
            result = await playwright_service.load_page_for_selection(validated_url)
            
            if not result.get('success'):
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to load page: {result.get('error', 'Unknown error')}"
                )
            
            # Get HTML content and inject visual selector
            html_content = result.get('html', '')
            html_with_selector = inject_visual_selector_script(html_content)
            
            return Response(
                content=html_with_selector,
                status_code=200,
                headers={
                    'Content-Type': 'text/html',
                    'X-Frame-Options': 'ALLOWALL',
                    'Content-Security-Policy': "frame-ancestors *",
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': '*',
                }
            )
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Headless scraping error for {url}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Scraping failed: {str(e)}")

def inject_visual_selector_script(html_content: str) -> str:
    """Inject visual element selector JavaScript into HTML"""
    
    # Read the complete visual selector script from the original architecture
    visual_selector_script = '''
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
    
    html body .element-selector-container,
    html body .element-selector-container * {
        background-color: rgba(34, 197, 94, 0.2) !important;
        outline: 3px solid #22c55e !important;
        outline-offset: -3px !important;
        position: relative !important;
        z-index: 999998 !important;
    }
    
    html body .element-selector-field,
    html body .element-selector-field * {
        background-color: rgba(245, 158, 11, 0.3) !important;
        outline: 2px solid #f59e0b !important;
        outline-offset: -2px !important;
        position: relative !important;
        z-index: 999998 !important;
    }
    
    /* Ensure highlighting is always visible */
    html body .temp-multi-hover {
        box-shadow: 0 0 0 2px #00d4ff, 0 0 10px rgba(0, 212, 255, 0.5) !important;
    }
    
    html body .temp-field-hover {
        box-shadow: 0 0 0 2px #f59e0b, 0 0 10px rgba(245, 158, 11, 0.5) !important;
    }
    
    /* Overlay system for element highlighting */
    .element-selector-overlay-container {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        z-index: 999999 !important;
        pointer-events: none !important;
    }
    
    .element-selector-highlight-box {
        position: absolute !important;
        background: rgba(0, 212, 255, 0.2) !important;
        border: 2px solid #00d4ff !important;
        pointer-events: none !important;
        box-sizing: border-box !important;
        z-index: 999999 !important;
    }
    
    .element-selector-info {
        position: absolute !important;
        background: rgba(0, 0, 0, 0.8) !important;
        color: white !important;
        padding: 4px 8px !important;
        border-radius: 4px !important;
        font-family: monospace !important;
        font-size: 12px !important;
        pointer-events: none !important;
        z-index: 1000000 !important;
        white-space: nowrap !important;
    }
    </style>
    
    <script>
    // Full Visual Element Selector Logic (Injected by Proxy)
    console.log('🎯 Visual Element Selector script injected by proxy');
    
    // Types and constants
    const SELECTION_MODES = {
      all: { color: "#00d4ff" },
      table: { color: "#22c55e" },
      repeating: { color: "#f59e0b" }
    };
    
    // State
    let isSelectionEnabled = false;
    let selectionMode = 'all'; // 'all', 'table', 'repeating'
    let containerSelector = null;
    let highlightBox = null;
    let infoBox = null;
    
    // Clear temp highlights function
    function clearTempHighlights() {
        document.querySelectorAll('.temp-multi-hover, .temp-field-hover').forEach(el => {
            el.classList.remove('temp-multi-hover', 'temp-field-hover');
        });
    }
    
    // Check if element is selectable based on current mode
    function isElementSelectable(element) {
        if (!element || !element.tagName) return false;
        
        if (selectionMode === 'table') {
            // Only allow table elements - restrict to table tag only
            const tagName = element.tagName.toLowerCase();
            return tagName === 'table';
        }
        
        // For 'all' and 'repeating' modes, allow all elements
        return true;
    }
    
    // Utility functions
    function generateOptimalSelector(element, doc, forRepeating = false) {
        if (!element || !doc) return element?.tagName?.toLowerCase() || 'unknown';
        
        const tagName = element.tagName.toLowerCase();
        
        // Special handling for table mode
        if (selectionMode === 'table') {
            // For table elements, prefer selectors that capture table structure
            if (tagName === 'table') {
                // For tables, try to get a unique selector that identifies this specific table
                if (element.id) {
                    return `table#${element.id}`;
                }
                if (element.className) {
                    const classes = element.className.split(' ').filter(c => c.trim()).slice(0, 2);
                    if (classes.length > 0) {
                        const classSelector = `table.${classes.join('.')}`;
                        if (doc.querySelectorAll(classSelector).length <= 3) {
                            return classSelector;
                        }
                    }
                }
                return 'table';
            }
        }
        
        // For repeating mode, generate more general selectors
        if (forRepeating || selectionMode === 'repeating') {
            // Use tag name and first meaningful class
            let selector = tagName;
            if (element.className) {
                const classes = element.className.split(' ').filter(c => c.trim() && !c.includes('hover') && !c.includes('selected'));
                if (classes.length > 0) {
                    selector = `${tagName}.${classes[0]}`;
                }
            }
            return selector;
        }
        
        // Default: Generate unique selector
        // Try ID first
        if (element.id && !/^[0-9]/.test(element.id)) {
            return `#${element.id}`;
        }
        
        // Try unique class combinations
        if (element.className) {
            const classes = element.className.split(' ').filter(c => c.trim() && !c.includes('hover'));
            for (let i = 1; i <= Math.min(3, classes.length); i++) {
                const selector = `.${classes.slice(0, i).join('.')}`;
                if (doc.querySelectorAll(selector).length === 1) {
                    return selector;
                }
            }
        }
        
        // Build path from parent with ID or unique class
        let path = [];
        let current = element;
        let depth = 0;
        
        while (current && current !== doc.body && depth < 5) {
            let selector = current.tagName.toLowerCase();
            
            if (current.id && !/^[0-9]/.test(current.id)) {
                selector = `${selector}#${current.id}`;
                path.unshift(selector);
                break;
            }
            
            if (current.className) {
                const classes = current.className.split(' ').filter(c => c.trim() && !c.includes('hover'));
                if (classes.length > 0) {
                    selector = `${selector}.${classes[0]}`;
                }
            }
            
            // Add nth-child if needed
            if (current.parentElement) {
                const siblings = Array.from(current.parentElement.children).filter(
                    child => child.tagName === current.tagName
                );
                if (siblings.length > 1) {
                    const index = siblings.indexOf(current) + 1;
                    selector += `:nth-child(${index})`;
                }
            }
            
            path.unshift(selector);
            current = current.parentElement;
            depth++;
        }
        
        return path.join(' > ');
    }
    
    // Create highlight box
    function createHighlightBox() {
        if (!highlightBox) {
            const container = document.createElement('div');
            container.className = 'element-selector-overlay-container';
            
            highlightBox = document.createElement('div');
            highlightBox.className = 'element-selector-highlight-box';
            
            infoBox = document.createElement('div');
            infoBox.className = 'element-selector-info';
            
            container.appendChild(highlightBox);
            container.appendChild(infoBox);
            document.body.appendChild(container);
        }
    }
    
    // Update highlight box position
    function updateHighlightBox(element) {
        if (!highlightBox || !element) return;
        
        const rect = element.getBoundingClientRect();
        highlightBox.style.left = rect.left + window.scrollX + 'px';
        highlightBox.style.top = rect.top + window.scrollY + 'px';
        highlightBox.style.width = rect.width + 'px';
        highlightBox.style.height = rect.height + 'px';
        highlightBox.style.display = 'block';
        
        // Update info box
        const selector = generateOptimalSelector(element, document, selectionMode === 'repeating');
        infoBox.textContent = selector;
        infoBox.style.left = rect.left + window.scrollX + 'px';
        infoBox.style.top = (rect.top + window.scrollY - 25) + 'px';
        infoBox.style.display = 'block';
    }
    
    // Hide highlight box
    function hideHighlightBox() {
        if (highlightBox) {
            highlightBox.style.display = 'none';
            infoBox.style.display = 'none';
        }
    }
    
    // Mouse event handlers
    function handleMouseMove(event) {
        if (!isSelectionEnabled) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        const element = event.target;
        
        if (isElementSelectable(element)) {
            // Clear previous highlights
            clearTempHighlights();
            
            // Apply appropriate hover class
            if (selectionMode === 'repeating' && containerSelector) {
                element.classList.add('temp-field-hover');
            } else {
                element.classList.add('temp-multi-hover');
            }
            
            updateHighlightBox(element);
        } else {
            hideHighlightBox();
        }
    }
    
    function handleClick(event) {
        if (!isSelectionEnabled) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        const element = event.target;
        
        if (!isElementSelectable(element)) return;
        
        // Generate selector
        const selector = generateOptimalSelector(element, document, selectionMode === 'repeating');
        
        // Generate relative selector if we have a container
        let relativeSelector = null;
        if (containerSelector && selectionMode === 'repeating') {
            try {
                const container = document.querySelector(containerSelector);
                if (container && container.contains(element)) {
                    // Generate selector relative to container
                    let relativePath = [];
                    let current = element;
                    
                    while (current && current !== container) {
                        let relSelector = current.tagName.toLowerCase();
                        
                        if (current.className) {
                            const classes = current.className.split(' ').filter(c => 
                                c.trim() && !c.includes('hover') && !c.includes('selector')
                            );
                            if (classes.length > 0) {
                                relSelector += `.${classes[0]}`;
                            }
                        }
                        
                        relativePath.unshift(relSelector);
                        current = current.parentElement;
                    }
                    
                    relativeSelector = relativePath.join(' > ');
                }
            } catch (e) {
                console.error('Error generating relative selector:', e);
            }
        }
        
        // Send message to parent
        const message = {
            type: 'ELEMENT_SELECTED',
            selector: selector,
            relativeSelector: relativeSelector,
            element: {
                tagName: element.tagName,
                textContent: element.textContent?.substring(0, 100),
                className: element.className,
                id: element.id
            },
            selectionMode: selectionMode,
            containerSelector: containerSelector
        };
        
        console.log('📨 Sending selection to parent:', message);
        
        if (window.parent && window.parent !== window) {
            window.parent.postMessage(message, '*');
        }
    }
    
    // Enable selection
    function enableSelection() {
        console.log('🎯 Enabling visual element selection');
        isSelectionEnabled = true;
        createHighlightBox();
        document.body.classList.add('element-selector-active');
        document.addEventListener('mousemove', handleMouseMove, true);
        document.addEventListener('click', handleClick, true);
        document.addEventListener('contextmenu', (e) => e.preventDefault(), true);
    }
    
    // Disable selection
    function disableSelection() {
        console.log('🛑 Disabling visual element selection');
        isSelectionEnabled = false;
        clearTempHighlights();
        hideHighlightBox();
        document.body.classList.remove('element-selector-active');
        document.removeEventListener('mousemove', handleMouseMove, true);
        document.removeEventListener('click', handleClick, true);
    }
    
    // Handle messages from parent
    window.addEventListener('message', (event) => {
        const message = event.data;
        
        if (message.type === 'SET_SELECTION_MODE') {
            selectionMode = message.mode || 'all';
            console.log('🎯 Selection mode set to:', selectionMode);
        }
        
        if (message.type === 'SET_CONTAINER_SELECTOR') {
            containerSelector = message.selector;
            console.log('📦 Container selector set to:', containerSelector);
        }
        
        if (message.type === 'ENABLE_SELECTION') {
            enableSelection();
        }
        
        if (message.type === 'DISABLE_SELECTION') {
            disableSelection();
        }
    });
    
    // Auto-enable selection
    setTimeout(() => {
        console.log('🚀 Auto-enabling visual element selection');
        enableSelection();
        
        // Notify parent that we're ready
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'SELECTOR_READY',
                modes: Object.keys(SELECTION_MODES)
            }, '*');
        }
    }, 500);
    
    </script>
    '''
    
    # Try to inject before closing body tag
    if '</body>' in html_content:
        html_content = html_content.replace('</body>', visual_selector_script + '</body>')
    else:
        # Fallback: append to end
        html_content += visual_selector_script
    
    return html_content