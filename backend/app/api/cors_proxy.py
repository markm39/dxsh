"""
CORS Proxy API for Visual Element Selector

Provides a secure proxy to bypass CORS restrictions when loading external websites
in iframes for visual element selection. Based on Flask-CORS best practices.
"""

import logging
import requests
import random
import time
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from flask import request, Response, jsonify
from flask_cors import cross_origin
from urllib.parse import urlparse, urljoin
from app.api import api_bp
from app.auth import auth_required, verify_token

logger = logging.getLogger(__name__)

# Check if brotli is available for decompression
try:
    import brotli
    BROTLI_AVAILABLE = True
    logger.info("Brotli decompression support enabled")
except ImportError:
    BROTLI_AVAILABLE = False
    logger.warning("Brotli package not installed - 'br' encoding will not be supported. Install with: pip install brotli")

# Blocked domains for security (malicious/problematic sites)
BLOCKED_DOMAINS = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    'file://',
    'ftp://'
]

# Allow most domains except blocked ones
ALLOWED_DOMAINS = None  # Setting to None means allow all except blocked

# Headers to strip from the response (security)
HEADERS_TO_STRIP = [
    'x-frame-options',
    'content-security-policy',
    'content-security-policy-report-only',
    'x-content-type-options',
    'strict-transport-security'
]

# Modern User Agents - Updated for 2025
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
    # Firefox (Linux)
    "Mozilla/5.0 (X11; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0",
    # Safari (macOS)
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    # Edge (Windows)
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0",
]

# Browser-specific header patterns
def get_browser_headers(user_agent):
    """Generate realistic headers based on user agent"""
    base_headers = {
        'User-Agent': user_agent,
        'Accept-Language': random.choice([
            'en-US,en;q=0.9',
            'en-US,en;q=0.8',
            'en-GB,en-US;q=0.9,en;q=0.8',
            'en-US,en;q=0.5'
        ]),
        'Accept-Encoding': 'gzip, deflate, br' if BROTLI_AVAILABLE else 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
    }
    
    if 'Chrome' in user_agent or 'Edg' in user_agent:
        # Chrome/Edge specific headers
        base_headers.update({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': random.choice(['none', 'same-origin', 'cross-site']),
            'Sec-Fetch-User': '?1',
            'Sec-Ch-Ua': f'"Not A(Brand";v="99", "Google Chrome";v="{random.randint(120, 122)}", "Chromium";v="{random.randint(120, 122)}"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': f'"{random.choice(["Windows", "macOS", "Linux"])}"',
        })
    elif 'Firefox' in user_agent:
        # Firefox specific headers
        base_headers.update({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
        })
    elif 'Safari' in user_agent:
        # Safari specific headers
        base_headers.update({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        })
    
    return base_headers

# Global session pool for connection reuse
session_pool = {}

def get_session_for_domain(domain):
    """Get or create a session for a specific domain"""
    if domain not in session_pool:
        session = requests.Session()
        
        # Configure retry strategy with randomized delays
        retry_strategy = Retry(
            total=3,
            backoff_factor=random.uniform(0.8, 2.0),  # Randomized backoff
            status_forcelist=[403, 429, 500, 502, 503, 504],
            respect_retry_after_header=True
        )
        
        # Mount adapters with retry strategy
        adapter = HTTPAdapter(max_retries=retry_strategy, pool_connections=10, pool_maxsize=20)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        
        # Set random user agent and headers for this session
        user_agent = random.choice(USER_AGENTS)
        headers = get_browser_headers(user_agent)
        session.headers.update(headers)
        
        # Add session metadata for tracking
        session._domain = domain
        session._created_at = time.time()
        
        session_pool[domain] = session
        logger.info(f"Created new session for domain: {domain} with User-Agent: {user_agent[:50]}...")
    
    return session_pool[domain]

def cleanup_old_sessions():
    """Clean up sessions older than 1 hour to prevent memory leaks"""
    current_time = time.time()
    old_domains = []
    
    for domain, session in session_pool.items():
        if hasattr(session, '_created_at') and current_time - session._created_at > 3600:  # 1 hour
            old_domains.append(domain)
    
    for domain in old_domains:
        session_pool[domain].close()
        del session_pool[domain]
        logger.info(f"Cleaned up old session for domain: {domain}")

def detect_bot_protection(response):
    """Detect common bot protection mechanisms"""
    content_lower = response.text.lower() if hasattr(response, 'text') else ''
    
    # Check for common bot protection indicators
    protection_indicators = [
        'cloudflare',
        'checking your browser',
        'ddos protection',
        'captcha',
        'access denied',
        'security check',
        'please enable cookies',
        'please enable javascript',
        'ray id',  # Cloudflare Ray ID
        'cf-ray',  # Cloudflare Ray header
        'blocked by administrator',
        'bot detected'
    ]
    
    for indicator in protection_indicators:
        if indicator in content_lower:
            return indicator
    
    return None

def rotate_session_for_domain(domain):
    """Force create a new session with different user agent for a domain"""
    if domain in session_pool:
        old_session = session_pool[domain]
        old_session.close()
        del session_pool[domain]
        logger.info(f"Rotated session for domain: {domain}")
    
    # Create new session (will be created on next get_session_for_domain call)
    return get_session_for_domain(domain)

def is_allowed_domain(url: str) -> bool:
    """Check if domain is allowed (not in blocked list)"""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        
        # Remove 'www.' prefix if present
        if domain.startswith('www.'):
            domain = domain[4:]
        
        # Check if domain is blocked
        for blocked in BLOCKED_DOMAINS:
            if domain == blocked or domain.endswith('.' + blocked) or url.lower().startswith(blocked):
                logger.warning(f"Blocked domain attempted: {domain}")
                return False
        
        # Block private IP ranges and local domains
        if (domain.startswith('192.168.') or 
            domain.startswith('10.') or 
            domain.startswith('172.') or
            domain == 'localhost' or
            '.' not in domain):  # Local domains without TLD
            logger.warning(f"Private/local domain blocked: {domain}")
            return False
        
        # Allow all other domains
        return True
        
    except Exception as e:
        logger.error(f"Error parsing domain from URL {url}: {e}")
        return False

def sanitize_headers(headers):
    """Remove problematic headers that prevent iframe embedding"""
    sanitized = {}
    for key, value in headers.items():
        key_lower = key.lower()
        if key_lower not in HEADERS_TO_STRIP:
            # Keep most headers but modify some for iframe compatibility
            if key_lower == 'content-type':
                sanitized[key] = value
            elif key_lower.startswith('access-control-'):
                sanitized[key] = value
            elif key_lower in ['cache-control', 'expires', 'last-modified', 'etag']:
                sanitized[key] = value
            # Skip other headers that might cause issues
    
    # Add CORS headers for iframe access
    sanitized['Access-Control-Allow-Origin'] = '*'
    sanitized['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    sanitized['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    sanitized['X-Frame-Options'] = 'ALLOWALL'  # Allow iframe embedding
    
    return sanitized

@api_bp.route('/proxy', methods=['GET', 'OPTIONS'])
# @cross_origin(origins='*', methods=['GET', 'OPTIONS'])
def proxy_website():
    """
    Proxy a website to bypass CORS restrictions for visual element selection
    
    Query Parameters:
        url: The target URL to proxy
        
    Returns:
        The website content with CORS headers and iframe restrictions removed
    """
    
    if request.method == 'OPTIONS':
        return Response('', 200)
    
    target_url = request.args.get('url')
    auth_token = request.args.get('token')  # Allow token via query param for iframe usage
    
    if not target_url:
        return jsonify({
            'success': False,
            'error': 'Missing required parameter: url'
        }), 400
    
    # Validate authentication - check both header and query param
    # Try to get token from Authorization header first, then query param
    token = None
    if hasattr(request, 'headers') and request.headers.get('Authorization'):
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
    elif auth_token:
        token = auth_token
    
    if not token:
        return jsonify({
            'success': False,
            'code': 'authorization_required',
            'error': 'Authentication token required (header or ?token= parameter)'
        }), 401
    
    # Validate the token
    try:
        user = verify_token(token)
        if not user:
            raise ValueError("Invalid token")
    except Exception as e:
        logger.error(f"Token validation failed: {e}")
        return jsonify({
            'success': False,
            'code': 'invalid_token',
            'error': 'Invalid or expired authentication token'
        }), 401
    
    # Continue with the rest of the validation after successful auth
    # Validate URL format
    try:
        parsed = urlparse(target_url)
        if not parsed.scheme or not parsed.netloc:
            raise ValueError("Invalid URL format")
        
        if parsed.scheme not in ['http', 'https']:
            raise ValueError("Only HTTP and HTTPS URLs are allowed")
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Invalid URL: {e}'
        }), 400
    
    # Check if domain is allowed (not blocked)
    if not is_allowed_domain(target_url):
        parsed = urlparse(target_url)
        return jsonify({
            'success': False,
            'error': f'Domain {parsed.netloc} is blocked for security reasons (localhost, private IPs, or known malicious sites)',
            'code': 'DOMAIN_BLOCKED',
            'suggestion': 'Use the manual CSS selector option instead'
        }), 403
    
    try:
        # Add random delay to appear more human-like
        delay = random.uniform(0.1, 0.5)
        time.sleep(delay)
        
        # Get domain-specific session with persistent headers
        parsed = urlparse(target_url)
        domain = parsed.netloc
        session = get_session_for_domain(domain)
        
        # Add referer if we have a previous request (simulate browsing)
        request_headers = session.headers.copy()
        if random.random() < 0.3:  # 30% chance to add referer
            request_headers['Referer'] = f"https://{domain}/"
        
        logger.info(f"Proxying request to: {target_url}")
        logger.debug(f"Using User-Agent: {request_headers.get('User-Agent', 'Unknown')[:50]}...")
        
        # Make the request with enhanced session
        response = session.get(
            target_url,
            headers=request_headers,
            timeout=(10, 30),  # (connect_timeout, read_timeout)
            allow_redirects=True,
            stream=False  # Allow automatic decompression
        )
        
        # Clean up old sessions periodically
        if random.random() < 0.1:  # 10% chance to cleanup
            cleanup_old_sessions()
        
        # Check if response is successful
        if response.status_code >= 400:
            # Check if it's a bot protection issue
            protection_type = detect_bot_protection(response)
            if protection_type:
                return jsonify({
                    'success': False,
                    'error': f'Website has bot protection ({protection_type}). Status: {response.status_code}',
                    'code': 'BOT_PROTECTION_DETECTED',
                    'protection_type': protection_type,
                    'suggestion': 'Try again later or use manual CSS selector'
                }), response.status_code
            else:
                return jsonify({
                    'success': False,
                    'error': f'Target server returned {response.status_code}',
                    'code': 'HTTP_ERROR'
                }), response.status_code
        
        # Check content type - only allow HTML and related types
        content_type = response.headers.get('content-type', '').lower()
        if not any(ct in content_type for ct in ['text/html', 'application/xhtml', 'text/plain']):
            return jsonify({
                'success': False,
                'error': f'Unsupported content type: {content_type}',
                'code': 'UNSUPPORTED_CONTENT_TYPE'
            }), 415
        
        # Prepare response headers (remove compression headers since we're sending uncompressed)
        response_headers = sanitize_headers(response.headers)
        # Remove compression headers since we're decompressing
        response_headers.pop('Content-Encoding', None)
        response_headers.pop('Content-Length', None)  # Length will change after modification
        
        # Ensure proper UTF-8 encoding in content-type
        if 'text/html' in content_type and 'charset=' not in content_type:
            response_headers['Content-Type'] = 'text/html; charset=utf-8'
        
        # Modify HTML content to inject our element selector script
        if 'text/html' in content_type:
            try:
                # Use response.text for automatic decompression and encoding detection
                html_content = response.text
                
                # Inject complete visual element selector script
                selector_script = '''
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
                        
                        // For table rows (tr), prefer selectors that get all rows in the table
                        if (tagName === 'tr') {
                            const table = element.closest('table');
                            if (table) {
                                const tableSelector = generateOptimalSelector(table, doc, false);
                                return `${tableSelector} tr`;
                            }
                            return 'tr';
                        }
                        
                        // For table cells, prefer the whole row
                        if (tagName === 'td' || tagName === 'th') {
                            const row = element.closest('tr');
                            if (row) {
                                return generateOptimalSelector(row, doc, false);
                            }
                        }
                    }
                    
                    // Try ID first (but not for repeating mode)
                    if (!forRepeating && element.id && /^[a-zA-Z]/.test(element.id)) {
                        const idSelector = '#' + element.id;
                        if (doc.querySelectorAll(idSelector).length === 1) {
                            return idSelector;
                        }
                    }
                    
                    // For repeating mode, prefer class-based selectors
                    if (element.className && typeof element.className === 'string') {
                        const classes = element.className.split(' ')
                            .filter(c => c.trim() && !/^(hover|active|focus|selected)/.test(c))
                            .slice(0, 3);
                            
                        if (classes.length > 0) {
                            const classSelector = element.tagName.toLowerCase() + '.' + classes.join('.');
                            const matches = doc.querySelectorAll(classSelector);
                            if (forRepeating && matches.length > 1 && matches.length < 20) {
                                return classSelector;
                            } else if (!forRepeating && matches.length <= 5) {
                                return classSelector;
                            }
                        }
                    }
                    
                    // Try attribute-based selectors
                    const attributes = ['data-testid', 'data-cy', 'role', 'aria-label', 'name', 'type'];
                    for (const attr of attributes) {
                        if (element.hasAttribute(attr)) {
                            const value = element.getAttribute(attr);
                            if (value && value.length < 50) {
                                const attrSelector = `${element.tagName.toLowerCase()}[${attr}="${value}"]`;
                                const matches = doc.querySelectorAll(attrSelector);
                                if (forRepeating && matches.length > 1 && matches.length < 20) {
                                    return attrSelector;
                                } else if (!forRepeating && matches.length <= 3) {
                                    return attrSelector;
                                }
                            }
                        }
                    }
                    
                    // nth-child approach with parent context
                    const parent = element.parentElement;
                    if (parent) {
                        const siblings = Array.from(parent.children);
                        const index = siblings.indexOf(element) + 1;
                        
                        let parentSelector = parent.tagName.toLowerCase();
                        if (parent.id && /^[a-zA-Z]/.test(parent.id)) {
                            parentSelector = '#' + parent.id;
                        } else if (parent.className && typeof parent.className === 'string') {
                            const parentClasses = parent.className.split(' ')
                                .filter(c => c.trim())
                                .slice(0, 2);
                            if (parentClasses.length > 0) {
                                parentSelector = parent.tagName.toLowerCase() + '.' + parentClasses.join('.');
                            }
                        }
                        
                        return `${parentSelector} > ${element.tagName.toLowerCase()}:nth-child(${index})`;
                    }
                    
                    // Fallback
                    return element.tagName.toLowerCase();
                }
                
                function computeRelativeSelector(element, container) {
                    if (!element || !container) return '';
                    
                    const path = [];
                    let current = element;
                    
                    while (current && current !== container) {
                        const siblings = Array.from(current.parentElement?.children || []);
                        const index = siblings.indexOf(current) + 1;
                        path.unshift(`${current.tagName.toLowerCase()}:nth-child(${index})`);
                        current = current.parentElement;
                    }
                    
                    return path.join(' > ');
                }
                
                // Generate relative selector from container to field element
                function generateRelativeSelector(fieldElement, containerElement) {
                    if (!containerElement || !fieldElement) return null;
                    
                    // Check if field is inside container
                    if (!containerElement.contains(fieldElement)) {
                        console.warn('Field element is not inside container');
                        return null;
                    }
                    
                    // If it's the same element, return a simple selector
                    if (fieldElement === containerElement) {
                        return '.';
                    }
                    
                    // Build path from container to field
                    const path = [];
                    let current = fieldElement;
                    
                    while (current && current !== containerElement) {
                        const parent = current.parentElement;
                        if (!parent) break;
                        
                        // Get the position of current element among its siblings
                        const siblings = Array.from(parent.children).filter(child => 
                            child.tagName === current.tagName
                        );
                        
                        let selector = current.tagName.toLowerCase();
                        
                        // Add specificity if needed
                        if (siblings.length > 1) {
                            const index = siblings.indexOf(current) + 1;
                            selector += `:nth-of-type(${index})`;
                        }
                        
                        // Add class if it helps with specificity
                        if (current.className && current.className.trim()) {
                            const classes = current.className.trim().split(/\\s+/);
                            if (classes.length > 0) {
                                selector += '.' + classes[0]; // Use first class for simplicity
                            }
                        }
                        
                        path.unshift(selector);
                        current = parent;
                    }
                    
                    return path.length > 0 ? path.join(' > ') : null;
                }
                
                // Container selector for relative field selection
                let containerSelector = null;
                
                // Visual Element Selector Integration
                window.addEventListener('message', function(event) {
                    // console.log('📨 Iframe received message:', event.data);
                    
                    if (event.data.type === 'ENABLE_SELECTOR_MODE') {
                        console.log('✅ Enabling selector mode');
                        document.body.classList.add('element-selector-active');
                        document.body.style.cursor = 'crosshair';
                        isSelectionEnabled = true;
                    } else if (event.data.type === 'DISABLE_SELECTOR_MODE') {
                        console.log('❌ Disabling selector mode');
                        document.body.classList.remove('element-selector-active');
                        document.body.style.cursor = '';
                        isSelectionEnabled = false;
                        // Clear highlights inline
                        document.querySelectorAll('.temp-multi-hover, .temp-field-hover').forEach(el => {
                            el.classList.remove('temp-multi-hover', 'temp-field-hover');
                        });
                    } else if (event.data.type === 'SET_CONTAINER_SELECTOR') {
                        console.log('📦 Setting container selector:', event.data.selector);
                        containerSelector = event.data.selector;
                    } else if (event.data.type === 'SET_SELECTION_MODE') {
                        console.log('🎯 Setting selection mode:', event.data.mode);
                        selectionMode = event.data.mode;
                    } else if (event.data.type === 'GET_ELEMENT_AT_POINT') {
                        // console.log('🎯 Processing GET_ELEMENT_AT_POINT:', event.data);
                        // Handle element detection requests from parent
                        const { x, y, action } = event.data;
                        const element = document.elementFromPoint(x, y);
                        
                        if (element && isElementSelectable(element)) {
                            // console.log('📍 Found element at point:', element.tagName, element.className);
                            const rect = element.getBoundingClientRect();
                            const selector = generateOptimalSelector(element, document, false);
                            
                            const elementData = {
                                tagName: element.tagName,
                                id: element.id,
                                className: element.className,
                                textContent: element.textContent ? element.textContent.trim().slice(0, 100) : ''
                            };
                            
                            if (action === 'SELECT') {
                                let relativeSelector = null;
                                
                                // If we have a container selector, compute relative selector
                                if (containerSelector) {
                                    console.log('🔗 Container selector set:', containerSelector);
                                    const containerElement = document.querySelector(containerSelector);
                                    if (containerElement) {
                                        console.log('🔗 Container element found:', containerElement.tagName);
                                        relativeSelector = generateRelativeSelector(element, containerElement);
                                        console.log('🔗 Generated relative selector:', relativeSelector);
                                    } else {
                                        console.warn('🔗 Container element not found for selector:', containerSelector);
                                    }
                                } else {
                                    console.log('🔗 No container selector set');
                                }
                                
                                // Send selection event
                                event.source.postMessage({
                                    type: 'ELEMENT_SELECTED',
                                    element: elementData,
                                    selector: selector,
                                    relativeSelector: relativeSelector
                                }, event.origin);
                            } else if (action === 'HOVER') {
                                // Clear previous highlights
                                const previousHighlights = document.querySelectorAll('.temp-multi-hover');
                                previousHighlights.forEach(el => {
                                    el.classList.remove('temp-multi-hover');
                                });
                                
                                // Apply highlight to current element and similar elements
                                const matches = document.querySelectorAll(selector);
                                matches.forEach((match, index) => {
                                    match.classList.add('temp-multi-hover');
                                });
                                
                                // Send hover info
                                event.source.postMessage({
                                    type: 'ELEMENT_INFO',
                                    element: elementData,
                                    rect: {
                                        left: rect.left,
                                        top: rect.top,
                                        width: rect.width,
                                        height: rect.height
                                    },
                                    selector: selector
                                }, event.origin);
                            }
                        } else {
                            console.log('❌ No element found at point:', x, y);
                        }
                    }
                });
                
                // Disable all default interactions
                document.addEventListener('DOMContentLoaded', function() {
                    console.log('🎯 DOM Content Loaded - initializing element selector');
                    
                    // Prevent all clicks from functioning normally
                    document.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        return false;
                    }, true);
                    
                    // Prevent form submissions
                    document.addEventListener('submit', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        return false;
                    }, true);
                    
                    // Prevent keyboard interactions
                    document.addEventListener('keydown', function(e) {
                        // Allow only basic navigation keys
                        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape'].includes(e.key)) {
                            e.preventDefault();
                            e.stopPropagation();
                            return false;
                        }
                    }, true);
                    
                    // Prevent context menu
                    document.addEventListener('contextmenu', function(e) {
                        e.preventDefault();
                        return false;
                    });
                    
                    console.log('✅ Basic interaction blocking set up');
                });
                
                </script>
                '''
                
                # Insert before closing head tag if it exists
                if '</head>' in html_content:
                    html_content = html_content.replace('</head>', selector_script + '</head>')
                elif '<body>' in html_content:
                    html_content = html_content.replace('<body>', '<body>' + selector_script)
                else:
                    # Fallback: add at the beginning
                    html_content = selector_script + html_content
                
                # Encode the modified HTML content
                content = html_content.encode('utf-8', errors='ignore')
                
            except Exception as e:
                logger.warning(f"Failed to inject selector script: {e}")
                # Continue with original content, properly encoded
                content = response.text.encode('utf-8', errors='ignore')
        else:
            # For non-HTML content, use raw bytes (but this should rarely happen due to content-type filter)
            content = response.content
        
        # Create response
        flask_response = Response(
            content,
            status=response.status_code,
            headers=response_headers
        )
        
        logger.info(f"Successfully proxied {target_url} ({len(content)} bytes)")
        return flask_response
        
    except requests.exceptions.Timeout:
        return jsonify({
            'success': False,
            'error': 'Request to target URL timed out',
            'code': 'TIMEOUT'
        }), 504
        
    except requests.exceptions.ConnectionError:
        return jsonify({
            'success': False,
            'error': 'Failed to connect to target URL',
            'code': 'CONNECTION_ERROR'
        }), 502
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Request error for {target_url}: {e}")
        return jsonify({
            'success': False,
            'error': f'Request failed: {str(e)}',
            'code': 'REQUEST_ERROR'
        }), 502
        
    except Exception as e:
        logger.error(f"Unexpected error proxying {target_url}: {e}")
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'code': 'INTERNAL_ERROR'
        }), 500

@api_bp.route('/proxy/check', methods=['GET'])
@cross_origin(origins='*')
@auth_required
def check_proxy_availability():
    """
    Check if a URL can be proxied
    
    Query Parameters:
        url: The target URL to check
        
    Returns:
        Information about proxy availability for the URL
    """
    target_url = request.args.get('url')
    
    if not target_url:
        return jsonify({
            'success': False,
            'error': 'Missing required parameter: url'
        }), 400
    
    try:
        # Validate URL
        parsed = urlparse(target_url)
        if not parsed.scheme or not parsed.netloc:
            return jsonify({
                'success': False,
                'can_proxy': False,
                'reason': 'Invalid URL format',
                'alternatives': ['manual_selector']
            })
        
        # Check if domain is allowed
        can_proxy = is_allowed_domain(target_url)
        
        response_data = {
            'success': True,
            'url': target_url,
            'domain': parsed.netloc,
            'can_proxy': can_proxy,
            'alternatives': []
        }
        
        if not can_proxy:
            response_data['reason'] = 'Domain blocked for security reasons'
            response_data['alternatives'] = [
                'manual_selector',
                'external_proxy',
                'browser_extension'
            ]
        
        return jsonify(response_data)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'can_proxy': False,
            'reason': f'Error checking URL: {e}',
            'alternatives': ['manual_selector']
        })

# Add health check endpoint
@api_bp.route('/proxy/health', methods=['GET'])
def proxy_health():
    """Health check for proxy service"""
    return jsonify({
        'status': 'healthy',
        'service': 'cors_proxy',
        'allowed_domains_count': len(ALLOWED_DOMAINS)
    })