import asyncio
import json
import re
from typing import List, Dict, Optional, Tuple
from playwright.async_api import async_playwright, Browser, Page, ElementHandle
from urllib.parse import urlparse, urljoin
import logging


logger = logging.getLogger(__name__)


class PlaywrightService:
    """Service for web scraping and CSS selector generation using Playwright"""
    
    def __init__(self):
        self.browser: Optional[Browser] = None
        self.context = None
        self.page: Optional[Page] = None
    
    async def __aenter__(self):
        """Async context manager entry"""
        await self.initialize()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.cleanup()
    
    async def initialize(self, user_agent: str = None, headless: bool = True):
        """Initialize Playwright browser with context"""
        try:
            self.playwright = await async_playwright().start()
            # Enhanced browser args for better compatibility and stealth
            browser_args = [
                '--no-sandbox', 
                '--disable-dev-shm-usage', 
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-ipc-flooding-protection',
                '--force-color-profile=srgb',
                '--metrics-recording-only',
                '--no-first-run',
                '--password-store=basic',
                '--use-mock-keychain',
                '--disable-extensions-except',
                '--disable-plugins-discovery',
                '--disable-sync',
                '--disable-translate',
                '--hide-scrollbars',
                '--disable-notifications',
                '--disable-default-apps',
                '--no-default-browser-check',
                '--disable-background-networking',
                '--disable-client-side-phishing-detection',
                '--disable-hang-monitor',
                '--disable-prompt-on-repost'
            ]
            
            self.browser = await self.playwright.chromium.launch(
                headless=headless,
                args=browser_args
            )
            
            # Use realistic user agents that change over time
            import random
            realistic_user_agents = [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36', 
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:122.0) Gecko/20100101 Firefox/122.0',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
            ]
            default_user_agent = user_agent or random.choice(realistic_user_agents)
            
            # Create browser context with enhanced anti-detection settings
            self.context = await self.browser.new_context(
                user_agent=user_agent or default_user_agent,
                viewport={'width': 1920, 'height': 1080},  # Common resolution
                extra_http_headers={
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-User': '?1',
                    'Upgrade-Insecure-Requests': '1',
                    'Cache-Control': 'max-age=0'
                },
                java_script_enabled=True,
                ignore_https_errors=True
            )
            
            # Add stealth settings to avoid detection
            await self.context.add_init_script("""
                // Pass the Chrome Test
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
                
                // Pass the Permissions Test
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' ?
                        Promise.resolve({ state: Notification.permission }) :
                        originalQuery(parameters)
                );
                
                // Pass the Plugins Length Test
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5],
                });
                
                // Pass the Languages Test
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en'],
                });
                
                // Pass the Chrome Runtime Test
                window.chrome = {
                    runtime: {},
                };
            """)
            logger.info("Playwright browser and context initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Playwright: {e}")
            raise
    
    async def cleanup(self):
        """Clean up Playwright resources with timeout protection"""
        cleanup_timeout = 10  # seconds
        try:
            # Use asyncio.wait_for to prevent hanging during cleanup
            await asyncio.wait_for(self._perform_cleanup(), timeout=cleanup_timeout)
            logger.info("Playwright resources cleaned up successfully")
        except asyncio.TimeoutError:
            logger.warning(f"Playwright cleanup timed out after {cleanup_timeout}s")
        except Exception as e:
            logger.error(f"Error during Playwright cleanup: {e}")
    
    async def _perform_cleanup(self):
        """Internal cleanup method"""
        if self.page:
            try:
                await self.page.close()
            except Exception as e:
                logger.warning(f"Error closing page: {e}")
        
        if self.context:
            try:
                await self.context.close()
            except Exception as e:
                logger.warning(f"Error closing context: {e}")
        
        if self.browser:
            try:
                await self.browser.close()
            except Exception as e:
                logger.warning(f"Error closing browser: {e}")
        
        if hasattr(self, 'playwright'):
            try:
                await self.playwright.stop()
            except Exception as e:
                logger.warning(f"Error stopping playwright: {e}")
    
    async def load_page(self, url: str, wait_for_load: bool = True) -> Page:
        """Load a webpage and return the page object"""
        if not self.context:
            await self.initialize()
        
        try:
            # Close existing page if it exists to prevent resource buildup
            if self.page:
                try:
                    await self.page.close()
                except:
                    pass  # Ignore errors when closing
            
            # Create new page from context (user agent already set in context)
            self.page = await self.context.new_page()
            
            # Navigate to URL with longer timeout for heavy sites
            response = await self.page.goto(url, wait_until='domcontentloaded', timeout=60000)
            
            if wait_for_load:
                # Wait for network to be mostly idle with longer timeout
                try:
                    await self.page.wait_for_load_state('networkidle', timeout=30000)
                except Exception as e:
                    logger.warning(f"Network idle timeout for {url}, continuing anyway: {e}")
                    # Continue without network idle - page might still be usable
                    # Additional wait for basic content loading
                    try:
                        await self.page.wait_for_timeout(2000)  # Give page 2 more seconds
                    except:
                        pass
            
            if response and response.status >= 400:
                raise Exception(f"HTTP {response.status} error loading {url}")
            
            logger.info(f"Successfully loaded page: {url}")
            return self.page
            
        except Exception as e:
            logger.error(f"Failed to load page {url}: {e}")
            raise
    
    async def generate_css_selector(self, element_text: str, element_attributes: Dict = None) -> List[str]:
        """Generate CSS selectors for finding elements with specific text or attributes"""
        if not self.page:
            raise Exception("No page loaded. Call load_page() first.")
        
        selectors = []
        
        try:
            # Method 1: Find by exact text content
            if element_text:
                # Try to find element by text
                elements = await self.page.query_selector_all(f'text="{element_text}"')
                if elements:
                    for element in elements[:3]:  # Limit to first 3 matches
                        selector = await self._generate_selector_for_element(element)
                        if selector:
                            selectors.append(selector)
            
            # Method 2: Find by attributes
            if element_attributes:
                for attr, value in element_attributes.items():
                    attr_selector = f'[{attr}="{value}"]'
                    elements = await self.page.query_selector_all(attr_selector)
                    if elements:
                        for element in elements[:2]:  # Limit to first 2 matches
                            selector = await self._generate_selector_for_element(element)
                            if selector and selector not in selectors:
                                selectors.append(selector)
            
            # Method 3: Find by partial text
            if element_text and len(selectors) == 0:
                # Try partial text match
                elements = await self.page.query_selector_all(f'text*="{element_text[:20]}"')
                if elements:
                    for element in elements[:2]:
                        selector = await self._generate_selector_for_element(element)
                        if selector and selector not in selectors:
                            selectors.append(selector)
            
        except Exception as e:
            logger.error(f"Error generating CSS selector: {e}")
        
        return selectors
    
    async def _generate_selector_for_element(self, element: ElementHandle) -> Optional[str]:
        """Generate a robust CSS selector for a specific element"""
        try:
            # Get element info
            tag_name = await element.evaluate('el => el.tagName.toLowerCase()')
            element_id = await element.evaluate('el => el.id')
            class_list = await element.evaluate('el => Array.from(el.classList)')
            
            # Start building selector
            selector = tag_name
            
            # Add ID if available (most specific)
            if element_id:
                selector = f'{tag_name}#{element_id}'
                # Test if this selector is unique
                if await self._is_selector_unique(selector):
                    return selector
            
            # Add classes if available
            if class_list:
                # Use stable, semantic classes (avoid generated/dynamic ones)
                stable_classes = [cls for cls in class_list if not re.match(r'^[a-z]\d+|css-\w+|makeStyles-\w+', cls)]
                if stable_classes:
                    class_selector = f'{tag_name}.{".".join(stable_classes[:2])}'  # Limit to 2 classes
                    if await self._is_selector_unique(class_selector):
                        return class_selector
            
            # Fall back to nth-child or other strategies
            parent_selector = await self._get_parent_context(element)
            if parent_selector:
                # Try with parent context
                nth_selector = f'{parent_selector} > {selector}:nth-child({await self._get_element_index(element)})'
                if await self._is_selector_unique(nth_selector):
                    return nth_selector
            
            return None
            
        except Exception as e:
            logger.error(f"Error generating selector for element: {e}")
            return None
    
    async def _is_selector_unique(self, selector: str) -> bool:
        """Check if a CSS selector returns exactly one element"""
        try:
            elements = await self.page.query_selector_all(selector)
            return len(elements) == 1
        except:
            return False
    
    async def _get_parent_context(self, element: ElementHandle) -> Optional[str]:
        """Get a selector for the parent element to provide context"""
        try:
            parent = await element.evaluate_handle('el => el.parentElement')
            if parent:
                parent_tag = await parent.evaluate('el => el.tagName.toLowerCase()')
                parent_id = await parent.evaluate('el => el.id')
                parent_classes = await parent.evaluate('el => Array.from(el.classList)')
                
                if parent_id:
                    return f'{parent_tag}#{parent_id}'
                elif parent_classes:
                    stable_classes = [cls for cls in parent_classes if not re.match(r'^[a-z]\d+|css-\w+', cls)]
                    if stable_classes:
                        return f'{parent_tag}.{stable_classes[0]}'
                
                return parent_tag
        except:
            pass
        return None
    
    async def _get_element_index(self, element: ElementHandle) -> int:
        """Get the nth-child index of an element"""
        try:
            return await element.evaluate('''el => {
                let index = 1;
                let sibling = el.previousElementSibling;
                while (sibling) {
                    if (sibling.tagName === el.tagName) index++;
                    sibling = sibling.previousElementSibling;
                }
                return index;
            }''')
        except:
            return 1
    
    async def test_selector(self, selector: str) -> Dict:
        """Test a CSS selector and return information about what it finds"""
        if not self.page:
            raise Exception("No page loaded. Call load_page() first.")
        
        try:
            elements = await self.page.query_selector_all(selector)
            results = {
                'selector': selector,
                'count': len(elements),
                'elements': []
            }
            
            for element in elements[:5]:  # Limit to first 5 elements
                element_info = {
                    'tag': await element.evaluate('el => el.tagName.toLowerCase()'),
                    'text': (await element.text_content() or '').strip()[:100],
                    'id': await element.evaluate('el => el.id'),
                    'classes': await element.evaluate('el => Array.from(el.classList)'),
                    'attributes': await element.evaluate('''el => {
                        const attrs = {};
                        for (let attr of el.attributes) {
                            attrs[attr.name] = attr.value;
                        }
                        return attrs;
                    }''')
                }
                results['elements'].append(element_info)
            
            return results
            
        except Exception as e:
            logger.error(f"Error testing selector {selector}: {e}")
            return {'selector': selector, 'count': 0, 'error': str(e), 'elements': []}
    
    async def extract_content(self, selectors: List[Dict[str, str]]) -> Dict[str, str]:
        """Extract content using multiple CSS selectors"""
        if not self.page:
            raise Exception("No page loaded. Call load_page() first.")
        
        results = {}
        
        for selector_config in selectors:
            selector = selector_config.get('selector')
            label = selector_config.get('label', selector)
            attribute = selector_config.get('attribute', 'textContent')
            
            if not selector:
                continue
            
            try:
                element = await self.page.query_selector(selector)
                if element:
                    if attribute == 'textContent':
                        content = await element.text_content()
                    elif attribute == 'innerHTML':
                        content = await element.evaluate('el => el.innerHTML')
                    elif attribute == 'href':
                        content = await element.evaluate('el => el.href')
                    else:
                        content = await element.evaluate(f'el => el.getAttribute("{attribute}")')
                    
                    results[label] = (content or '').strip()
                else:
                    results[label] = None
                    logger.warning(f"No element found for selector: {selector}")
            
            except Exception as e:
                logger.error(f"Error extracting content for {selector}: {e}")
                results[label] = None
        
        return results
    
    async def extract_all_content(self, selectors: List[Dict[str, str]]) -> List[Dict[str, any]]:
        """Extract content from ALL matching elements with support for repeating containers"""
        if not self.page:
            raise Exception("No page loaded. Call load_page() first.")
        
        try:
            all_results = []
            
            for selector_config in selectors:
                selector = selector_config.get('selector')
                name = selector_config.get('name', selector_config.get('label', selector))
                type_ = selector_config.get('type')
                attribute = selector_config.get('attribute', 'textContent')
                
                # Debug log to understand why table types aren't working
                logger.info(f" DEBUG SELECTOR: type='{type_}', attribute='{attribute}', selector='{selector}'")
                
                if not selector:
                    continue
                
                if type_ == 'table' or attribute == 'table_data':
                    # Table mode - use structured table extraction
                    logger.info(f" TABLE MODE: Processing table selector: {selector}")
                    
                    try:
                        # Use the built-in table extraction logic
                        table_data = await self._extract_table_data(selector)
                        
                        if table_data:
                            logger.info(f" TABLE MODE: Extracted {len(table_data)} table rows")
                            result = {name: table_data}
                            all_results.append(result)
                        else:
                            logger.warning(f" TABLE MODE: No table data extracted for {selector}")
                            all_results.append({name: []})
                            
                    except Exception as e:
                        logger.error(f"Error processing table {selector}: {e}")
                        all_results.append({name: []})
                
                elif type_ == 'repeating' and 'fields' in selector_config:
                    # Repeating container mode - extract structured rows
                    logger.info(f" REPEATING MODE: Processing container selector: {selector}")
                    logger.info(f" REPEATING MODE: Fields to extract: {[f['name'] for f in selector_config['fields']]}")
                    
                    try:
                        containers = await self.page.query_selector_all(selector)
                        logger.info(f" REPEATING MODE: Found {len(containers)} containers for '{selector}'")
                        
                        rows = []
                        for i, container in enumerate(containers):
                            logger.info(f" REPEATING MODE: Processing container {i+1}/{len(containers)}")
                            row = {}
                            row_valid = False
                            
                            for field in selector_config['fields']:
                                field_name = field['name']
                                sub_selector = field.get('sub_selector', field.get('selector', ''))  # Fallback to 'selector' if 'sub_selector' missing
                                attribute = field.get('attribute', 'textContent')
                                
                                if not sub_selector:
                                    logger.warning(f" FIELD CONFIG ERROR: Field '{field_name}' missing sub_selector/selector")
                                    continue
                                
                                logger.info(f" FIELD EXTRACTION: Looking for field '{field_name}' with selector '{sub_selector}' in container {i+1}")
                                
                                try:
                                    # Use relative selector within the container
                                    field_elem = await container.query_selector(sub_selector)
                                    if field_elem:
                                        if attribute == 'textContent':
                                            # Enhanced text extraction - try multiple methods
                                            value = await field_elem.evaluate('''el => {
                                                // Try innerText first (respects visibility)
                                                if (el.innerText && el.innerText.trim()) {
                                                    return el.innerText.trim();
                                                }
                                                // Fallback to textContent
                                                if (el.textContent && el.textContent.trim()) {
                                                    return el.textContent.trim();
                                                }
                                                // For anchor tags, try getting href or title
                                                if (el.tagName.toLowerCase() === 'a') {
                                                    return el.href || el.title || '';
                                                }
                                                // For images, try alt text
                                                if (el.tagName.toLowerCase() === 'img') {
                                                    return el.alt || el.title || '';
                                                }
                                                return '';
                                            }''')
                                            if not value:
                                                # Final fallback to Playwright's text_content
                                                value = (await field_elem.text_content() or '').strip()
                                        elif attribute == 'innerHTML':
                                            value = await field_elem.evaluate('el => el.innerHTML')
                                        elif attribute == 'href':
                                            value = await field_elem.evaluate('el => el.href')
                                        else:
                                            value = await field_elem.evaluate(f'el => el.getAttribute("{attribute}")')
                                        
                                        row[field_name] = value
                                        logger.info(f" FIELD EXTRACTED: '{field_name}' = '{value[:50]}...' from container {i+1}")
                                        if value:  # Mark row as valid if we got at least one non-empty value
                                            row_valid = True
                                    else:
                                        row[field_name] = None
                                        logger.warning(f" FIELD NOT FOUND: '{field_name}' selector '{sub_selector}' not found in container {i+1}")
                                        
                                except Exception as e:
                                    logger.error(f" FIELD ERROR: Error extracting '{field_name}' from container {i+1}: {e}")
                                    row[field_name] = None
                            
                            # Only add row if we extracted at least some data
                            if row_valid:
                                rows.append(row)
                                logger.info(f" ROW ADDED: Container {i+1} produced valid row: {row}")
                            else:
                                logger.warning(f" ROW SKIPPED: Container {i+1} had no valid fields")
                        
                        logger.info(f" FINAL RESULT: Extracted {len(rows)} structured rows from {len(containers)} containers")
                        if rows:
                            logger.info(f" SAMPLE ROW: {rows[0]}")
                        else:
                            logger.error(f" NO ROWS EXTRACTED! Check field selectors.")
                        
                        # Return structured rows under the container name
                        result = {name: rows}
                        all_results.append(result)
                        
                    except Exception as e:
                        logger.error(f"Error processing repeating container {selector}: {e}")
                        all_results.append({name: []})
                
                else:
                    # Fallback to original per-selector extraction for non-repeating selectors
                    logger.info(f"Processing regular selector: {selector}")
                    
                    try:
                        attribute = selector_config.get('attribute', 'textContent')
                        elements = await self.page.query_selector_all(selector)
                        extracted_values = []
                        
                        logger.info(f"Found {len(elements)} elements for selector '{selector}' (name: '{name}')")
                        
                        for element in elements:
                            if attribute == 'all':
                                # Extract all relevant attributes and content
                                element_data = await element.evaluate('''el => {
                                    const data = {
                                        text: el.textContent?.trim() || '',
                                        href: el.href || null,
                                        src: el.src || null,
                                        alt: el.alt || null,
                                        title: el.title || null,
                                        id: el.id || null,
                                        className: el.className || null
                                    };
                                    // Get data attributes
                                    for (const attr of el.attributes) {
                                        if (attr.name.startsWith('data-')) {
                                            data[attr.name] = attr.value;
                                        }
                                    }
                                    return data;
                                }''')
                                extracted_values.append(element_data)
                            elif attribute == 'textContent':
                                content = await element.text_content()
                                extracted_values.append((content or '').strip())
                            elif attribute == 'innerHTML':
                                content = await element.evaluate('el => el.innerHTML')
                                extracted_values.append(content)
                            elif attribute == 'outerHTML':
                                content = await element.evaluate('el => el.outerHTML')
                                extracted_values.append(content)
                            else:
                                content = await element.evaluate(f'el => el.getAttribute("{attribute}")')
                                extracted_values.append(content)
                        
                        logger.info(f"Extracted {len(extracted_values)} values for selector '{selector}' (name: '{name}')")
                        logger.info(f"Sample extracted values: {extracted_values[:3] if extracted_values else 'None'}")
                        
                        # Store as named array for backward compatibility
                        result = {name: extracted_values}
                        all_results.append(result)
                        
                    except Exception as e:
                        logger.error(f"Error extracting content for {selector}: {e}")
                        all_results.append({name: []})
            
            # Merge all results into a single dictionary for backward compatibility
            if all_results:
                merged_result = {}
                for result in all_results:
                    merged_result.update(result)
                
                logger.info(f"Final merged result keys: {list(merged_result.keys())}")
                logger.info(f"Final result structure: {[(k, len(v) if isinstance(v, list) else type(v).__name__) for k, v in merged_result.items()]}")
                
                return [merged_result]  # Return as single item containing all data
            
            return []
            
        except Exception as e:
            logger.error(f"Error extracting all content: {e}")
            return []
    
    async def get_page_info(self) -> Dict:
        """Get basic information about the current page"""
        if not self.page:
            raise Exception("No page loaded. Call load_page() first.")
        
        try:
            return {
                'url': self.page.url,
                'title': await self.page.title(),
                'status': 200,  # If we got here, page loaded successfully
                'ready_state': await self.page.evaluate('document.readyState')
            }
        except Exception as e:
            logger.error(f"Error getting page info: {e}")
            return {'error': str(e)}
    
    async def wait_for_selector(self, selector: str, timeout: int = 10000) -> bool:
        """Wait for a selector to appear on the page"""
        if not self.page:
            raise Exception("No page loaded. Call load_page() first.")
        
        try:
            await self.page.wait_for_selector(selector, timeout=timeout)
            return True
        except Exception as e:
            logger.warning(f"Selector {selector} not found within {timeout}ms: {e}")
            return False

    async def _extract_structured_data(self, selectors: List[Dict[str, str]]) -> List[Dict[str, any]]:
        """
        Extract structured data from tables, lists, and card components
        Based on 2024 best practices for web scraping
        """
        if not self.page:
            raise Exception("No page loaded. Call load_page() first.")
        
        try:
            structured_results = []
            
            for selector_config in selectors:
                selector = selector_config.get('selector')
                if not selector:
                    continue
                
                # Check if selector targets structured data elements
                elements = await self.page.query_selector_all(selector)
                if not elements:
                    continue
                
                # Analyze the first element to determine data structure type
                first_element = elements[0]
                tag_name = await first_element.evaluate('el => el.tagName.toLowerCase()')
                
                if tag_name == 'table':
                    # Extract table data
                    table_data = await self._extract_table_data(selector)
                    if table_data:
                        structured_results.extend(table_data)
                
                elif tag_name in ['ul', 'ol']:
                    # Extract list data
                    list_data = await self._extract_list_data(selector)
                    if list_data:
                        structured_results.extend(list_data)
                
                elif await self._is_card_component(first_element):
                    # Extract card/article data
                    card_data = await self._extract_card_data(selector)
                    if card_data:
                        structured_results.extend(card_data)
            
            return structured_results if structured_results else None
            
        except Exception as e:
            logger.error(f"Error extracting structured data: {e}")
            return None

    async def _extract_table_data(self, table_selector: str) -> List[Dict[str, any]]:
        """
        Extract data from HTML tables with proper header detection
        Following best practices from research on table-to-JSON conversion
        """
        try:
            table_data = await self.page.evaluate(f'''
                (selector) => {{
                    const table = document.querySelector(selector);
                    if (!table) return null;
                    
                    const rows = Array.from(table.querySelectorAll('tr'));
                    if (rows.length === 0) return null;
                    
                    // Extract headers from first row (th elements or first tr)
                    const headerRow = rows[0];
                    const headers = Array.from(headerRow.querySelectorAll('th, td')).map(cell => {{
                        const text = cell.textContent?.trim() || '';
                        // Clean header text for use as JSON keys
                        return text.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() || `column_${{cell.cellIndex}}`;
                    }});
                    
                    if (headers.length === 0) return null;
                    
                    // Extract data rows (skip header if it contains th elements)
                    const dataRows = headerRow.querySelector('th') ? rows.slice(1) : rows.slice(1);
                    
                    const jsonData = [];
                    dataRows.forEach((row, rowIndex) => {{
                        const cells = Array.from(row.querySelectorAll('td, th'));
                        if (cells.length === 0) return;
                        
                        const rowObject = {{}};
                        cells.forEach((cell, cellIndex) => {{
                            const header = headers[cellIndex] || `column_${{cellIndex}}`;
                            
                            // Extract comprehensive cell data
                            const cellData = {{
                                text: cell.textContent?.trim() || '',
                                href: cell.querySelector('a')?.href || null,
                                src: cell.querySelector('img')?.src || null,
                                alt: cell.querySelector('img')?.alt || null,
                                title: cell.title || null
                            }};
                            
                            // Use just text if no additional attributes, otherwise full object
                            rowObject[header] = (cellData.href || cellData.src || cellData.alt || cellData.title) 
                                ? cellData 
                                : cellData.text;
                        }});
                        
                        // Add metadata
                        rowObject._table_row_index = rowIndex;
                        rowObject._data_type = 'table_row';
                        jsonData.push(rowObject);
                    }});
                    
                    return jsonData;
                }}
            ''', table_selector)
            
            return table_data or []
            
        except Exception as e:
            logger.error(f"Error extracting table data from {table_selector}: {e}")
            return []

    async def _extract_list_data(self, list_selector: str) -> List[Dict[str, any]]:
        """
        Extract data from HTML lists (ul/ol) with pattern detection for repeated elements
        Detects repeated inner element structures and groups them together
        """
        try:
            list_data = await self.page.evaluate(f'''
                (selector) => {{
                    const list = document.querySelector(selector);
                    if (!list) return null;
                    
                    const listItems = Array.from(list.querySelectorAll('li'));
                    if (listItems.length === 0) return null;
                    
                    // Detect repeated element patterns within list items
                    function detectRepeatedPatterns(items) {{
                        const patterns = new Map();
                        
                        // Analyze the structure of each list item
                        items.forEach((item, index) => {{
                            const structure = analyzeElementStructure(item);
                            const structureKey = JSON.stringify(structure.pattern);
                            
                            if (!patterns.has(structureKey)) {{
                                patterns.set(structureKey, {{
                                    pattern: structure.pattern,
                                    elements: [item],
                                    count: 1,
                                    indices: [index]
                                }});
                            }} else {{
                                const existing = patterns.get(structureKey);
                                existing.elements.push(item);
                                existing.count++;
                                existing.indices.push(index);
                            }}
                        }});
                        
                        // Find the most common pattern (the one that repeats most)
                        let dominantPattern = null;
                        let maxCount = 0;
                        
                        patterns.forEach((patternData, key) => {{
                            if (patternData.count > maxCount) {{
                                maxCount = patternData.count;
                                dominantPattern = patternData;
                            }}
                        }});
                        
                        return {{ patterns, dominantPattern }};
                    }}
                    
                    function analyzeElementStructure(element) {{
                        const pattern = {{
                            childCount: element.children.length,
                            childTags: Array.from(element.children).map(child => child.tagName.toLowerCase()),
                            hasText: !!element.textContent.trim(),
                            hasLinks: !!element.querySelector('a'),
                            hasImages: !!element.querySelector('img'),
                            textSegmentCount: element.textContent.trim().split(/\\s+/).length
                        }};
                        
                        return {{ pattern }};
                    }}
                    
                    function extractElementData(element, index) {{
                        const data = {{
                            _data_type: 'list_item',
                            _item_index: index,
                            _list_type: list.tagName.toLowerCase()
                        }};
                        
                        // Extract all direct child elements as separate fields
                        const children = Array.from(element.children);
                        children.forEach((child, childIndex) => {{
                            const childData = extractChildElementData(child);
                            data[`element_${{childIndex}}`] = childData;
                        }});
                        
                        // Extract direct text content (excluding children)
                        const directText = getDirectTextContent(element);
                        if (directText.trim()) {{
                            data.direct_text = directText.trim();
                        }}
                        
                        // Extract all text content with comma separation
                        // Walk through ALL descendant elements to get text from each leaf node
                        const textParts = [];
                        
                        // Helper to recursively extract text from all leaf elements
                        const extractTextFromElement = (elem) => {{
                            // Skip style and script elements
                            if (elem.tagName && (elem.tagName.toLowerCase() === 'style' || elem.tagName.toLowerCase() === 'script')) {{
                                return;
                            }}
                            
                            // If element has no children (or only text nodes), get its text
                            const hasElementChildren = Array.from(elem.childNodes).some(
                                node => node.nodeType === Node.ELEMENT_NODE
                            );
                            
                            if (!hasElementChildren) {{
                                const text = elem.textContent.trim();
                                if (text && !text.includes('{{') && !text.includes('}}')) {{ // Skip CSS content
                                    textParts.push(text);
                                }}
                            }} else {{
                                // Recursively process child elements
                                Array.from(elem.children).forEach(child => {{
                                    extractTextFromElement(child);
                                }});
                            }}
                        }};
                        
                        // Start extraction from the list item
                        extractTextFromElement(element);
                        
                        // Join with commas for easier parsing
                        data.full_text = textParts.join(', ');
                        
                        // Extract all links
                        const links = element.querySelectorAll('a');
                        if (links.length > 0) {{
                            data.links = Array.from(links).map(link => ({{
                                href: link.href,
                                text: link.textContent.trim(),
                                title: link.title || null
                            }}));
                        }}
                        
                        // Extract all images
                        const images = element.querySelectorAll('img');
                        if (images.length > 0) {{
                            data.images = Array.from(images).map(img => ({{
                                src: img.src,
                                alt: img.alt || null,
                                title: img.title || null
                            }}));
                        }}
                        
                        return data;
                    }}
                    
                    function extractChildElementData(child) {{
                        const childData = {{
                            tag: child.tagName.toLowerCase(),
                            text: child.textContent.trim(),
                            classes: Array.from(child.classList),
                            id: child.id || null
                        }};
                        
                        // Extract element-specific attributes
                        if (child.tagName.toLowerCase() === 'a') {{
                            childData.href = child.href;
                            childData.title = child.title || null;
                        }} else if (child.tagName.toLowerCase() === 'img') {{
                            childData.src = child.src;
                            childData.alt = child.alt || null;
                        }}
                        
                        // Extract all data attributes
                        const dataAttrs = {{}};
                        for (const attr of child.attributes) {{
                            if (attr.name.startsWith('data-')) {{
                                dataAttrs[attr.name] = attr.value;
                            }}
                        }}
                        if (Object.keys(dataAttrs).length > 0) {{
                            childData.data_attributes = dataAttrs;
                        }}
                        
                        return childData;
                    }}
                    
                    function getDirectTextContent(element) {{
                        let directText = '';
                        for (const node of element.childNodes) {{
                            if (node.nodeType === Node.TEXT_NODE) {{
                                directText += node.textContent;
                            }}
                        }}
                        return directText;
                    }}
                    
                    // Detect patterns in the list items
                    const {{ patterns, dominantPattern }} = detectRepeatedPatterns(listItems);
                    
                    // Extract data from all items
                    const extractedData = listItems.map((item, index) => {{
                        return extractElementData(item, index);
                    }});
                    
                    // Add pattern metadata
                    const result = {{
                        _extraction_type: 'pattern_based_list',
                        _total_items: extractedData.length,
                        _patterns_detected: patterns.size,
                        _dominant_pattern: dominantPattern ? {{
                            count: dominantPattern.count,
                            pattern: dominantPattern.pattern
                        }} : null,
                        items: extractedData
                    }};
                    
                    return result;
                }}
            ''', list_selector)
            
            # Extract just the items array for consistency with other extraction methods
            if list_data and isinstance(list_data, dict) and 'items' in list_data:
                return list_data['items']
            
            return list_data or []
            
        except Exception as e:
            logger.error(f"Error extracting pattern-based list data from {list_selector}: {e}")
            return []

    async def _is_card_component(self, element) -> bool:
        """
        Determine if an element represents a card/article component
        Based on common patterns and semantic indicators
        """
        try:
            is_card = await element.evaluate('''
                el => {
                    const tagName = el.tagName.toLowerCase();
                    const className = el.className.toLowerCase();
                    const hasMultipleChildren = el.children.length >= 2;
                    
                    // Check for common card indicators
                    const cardIndicators = [
                        'card', 'article', 'post', 'item', 'product', 'listing',
                        'tile', 'block', 'entry', 'record', 'result'
                    ];
                    
                    const hasCardClass = cardIndicators.some(indicator => 
                        className.includes(indicator)
                    );
                    
                    const isArticle = tagName === 'article';
                    const hasCardStructure = hasMultipleChildren && (
                        el.querySelector('img, picture') ||
                        el.querySelector('h1, h2, h3, h4, h5, h6') ||
                        el.querySelector('p, span, div')
                    );
                    
                    return hasCardClass || isArticle || hasCardStructure;
                }
            ''')
            
            return is_card
            
        except Exception as e:
            logger.error(f"Error checking if element is card component: {e}")
            return False

    async def _extract_card_data(self, card_selector: str) -> List[Dict[str, any]]:
        """
        Extract data from card/article components with semantic structure
        Following modern component extraction patterns
        """
        try:
            card_data = await self.page.evaluate(f'''
                (selector) => {{
                    const cards = Array.from(document.querySelectorAll(selector));
                    if (cards.length === 0) return null;
                    
                    return cards.map((card, cardIndex) => {{
                        const cardData = {{
                            _data_type: 'card_component',
                            _card_index: cardIndex
                        }};
                        
                        // Extract title/heading
                        const heading = card.querySelector('h1, h2, h3, h4, h5, h6, .title, .headline, [class*="title"], [class*="heading"]');
                        if (heading) {{
                            cardData.title = heading.textContent?.trim();
                            cardData.title_tag = heading.tagName.toLowerCase();
                        }}
                        
                        // Extract description/content
                        const description = card.querySelector('p, .description, .content, .summary, [class*="description"], [class*="content"]');
                        if (description) {{
                            cardData.description = description.textContent?.trim();
                        }}
                        
                        // Extract image
                        const image = card.querySelector('img, picture img');
                        if (image) {{
                            cardData.image = {{
                                src: image.src,
                                alt: image.alt || null,
                                title: image.title || null
                            }};
                        }}
                        
                        // Extract links
                        const links = Array.from(card.querySelectorAll('a')).map(link => ({{
                            href: link.href,
                            text: link.textContent?.trim(),
                            title: link.title || null
                        }}));
                        if (links.length > 0) {{
                            cardData.links = links;
                            cardData.primary_link = links[0]; // First link is usually primary
                        }}
                        
                        // Extract metadata (prices, dates, ratings, etc.)
                        const price = card.querySelector('.price, [class*="price"], [data-price]');
                        if (price) {{
                            cardData.price = price.textContent?.trim();
                        }}
                        
                        const date = card.querySelector('.date, [class*="date"], time, [datetime]');
                        if (date) {{
                            cardData.date = date.textContent?.trim();
                            cardData.datetime = date.getAttribute('datetime') || null;
                        }}
                        
                        const rating = card.querySelector('.rating, [class*="rating"], [class*="star"]');
                        if (rating) {{
                            cardData.rating = rating.textContent?.trim();
                        }}
                        
                        // Extract any data attributes
                        const dataAttributes = {{}};
                        for (const attr of card.attributes) {{
                            if (attr.name.startsWith('data-')) {{
                                dataAttributes[attr.name] = attr.value;
                            }}
                        }}
                        if (Object.keys(dataAttributes).length > 0) {{
                            cardData.data_attributes = dataAttributes;
                        }}
                        
                        // Extract full text content with comma separation
                        const textParts = [];
                        
                        // Helper to recursively extract text from all leaf elements
                        const extractTextFromElement = (elem) => {{
                            // Skip style and script elements
                            if (elem.tagName && (elem.tagName.toLowerCase() === 'style' || elem.tagName.toLowerCase() === 'script')) {{
                                return;
                            }}
                            
                            // If element has no children (or only text nodes), get its text
                            const hasElementChildren = Array.from(elem.childNodes).some(
                                node => node.nodeType === Node.ELEMENT_NODE
                            );
                            
                            if (!hasElementChildren) {{
                                const text = elem.textContent.trim();
                                if (text && !text.includes('{{') && !text.includes('}}')) {{ // Skip CSS content
                                    textParts.push(text);
                                }}
                            }} else {{
                                // Recursively process child elements
                                Array.from(elem.children).forEach(child => {{
                                    extractTextFromElement(child);
                                }});
                            }}
                        }};
                        
                        // Start extraction from the card
                        extractTextFromElement(card);
                        
                        cardData.full_text = textParts.join(', ');
                        
                        return cardData;
                    }});
                }}
            ''', card_selector)
            
            return card_data or []
            
        except Exception as e:
            logger.error(f"Error extracting card data from {card_selector}: {e}")
            return []

    async def load_page_for_selection(self, url: str) -> Dict:
        """
        Load a page for visual element selection
        
        Args:
            url: The URL to load
            
        Returns:
            Dict with page HTML and metadata
        """
        try:
            # Ensure service is initialized
            if not self.browser or not self.context:
                await self.initialize()
            
            await self.load_page(url, wait_for_load=True)
            
            # Get page HTML
            html_content = await self.page.content()
            page_info = await self.get_page_info()
            
            return {
                'success': True,
                'url': url,
                'html': html_content,
                'page_info': page_info
            }
            
        except Exception as e:
            logger.error(f"Error loading page for selection {url}: {e}")
            return {
                'success': False,
                'error': str(e),
                'url': url
            }


# Utility function for easy usage
async def scrape_url(url: str, selectors: List[Dict[str, str]], wait_for_load: bool = True) -> Dict:
    """
    Utility function to scrape a URL with given selectors
    
    Args:
        url: The URL to scrape
        selectors: List of selector configs [{'selector': '.class', 'label': 'Name', 'attribute': 'textContent'}]
        wait_for_load: Whether to wait for the page to fully load
    
    Returns:
        Dict with extracted content and metadata
    """
    async with PlaywrightService() as service:
        try:
            await service.load_page(url, wait_for_load)
            
            content = await service.extract_content(selectors)
            page_info = await service.get_page_info()
            
            return {
                'success': True,
                'url': url,
                'page_info': page_info,
                'content': content,
                'selectors_tested': len(selectors)
            }
            
        except Exception as e:
            logger.error(f"Error scraping {url}: {e}")
            return {
                'success': False,
                'url': url,
                'error': str(e),
                'content': {},
                'selectors_tested': 0
            }


# Test function
async def test_playwright_service():
    """Test function to verify Playwright service works"""
    async with PlaywrightService() as service:
        # Test with ESPN as an example
        await service.load_page('https://www.espn.com')
        
        # Generate selectors for the main headline
        selectors = await service.generate_css_selector('ESPN')
        print(f"Generated selectors: {selectors}")
        
        # Test a selector
        if selectors:
            test_result = await service.test_selector(selectors[0])
            print(f"Selector test result: {test_result}")
        
        # Extract content
        content = await service.extract_content([
            {'selector': 'title', 'label': 'page_title', 'attribute': 'textContent'},
            {'selector': 'h1', 'label': 'main_heading', 'attribute': 'textContent'}
        ])
        print(f"Extracted content: {content}")


if __name__ == '__main__':
    # Run test
    asyncio.run(test_playwright_service())