"""
WebSource Node Executor

Executes web scraping operations using headless browser technology.
Handles visual selector configurations and structured data extraction.
"""

import asyncio
from typing import Dict, Any, Optional, List
from .base_executor import BaseExecutor
from app.services.playwright_service import PlaywrightService

class WebSourceExecutor(BaseExecutor):
    """Executor for WebSource nodes using headless browser scraping"""
    
    async def execute(self, input_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Execute web scraping using Playwright-based headless browser
        
        Expected node configuration:
        {
            "id": "node_id",
            "type": "webSource",
            "config": {
                "url": "https://example.com",
                "selectors": [
                    {
                        "name": "title",
                        "selector": "h1",
                        "type": "all|table|repeating",
                        "attribute": "textContent",
                        "fields": [...] // for repeating type
                    }
                ],
                "options": {
                    "wait_for_load": true,
                    "timeout": 30000
                }
            }
        }
        """
        
        self.log_execution_start()
        
        try:
            # Validate configuration
            if not self.validate_config():
                return self.create_error_result("Invalid node configuration")
            
            # Extract configuration
            config = self.get_config_value('config', {})
            url = config.get('url')
            selectors = config.get('selectors', [])
            options = config.get('options', {})
            
            # Validate required fields
            if not url:
                return self.create_error_result("Missing required field: url")
            
            if not selectors:
                return self.create_error_result("Missing required field: selectors")
            
            # Set default options
            wait_for_load = options.get('wait_for_load', True)
            timeout = options.get('timeout', 30000)
            
            self.logger.info(f"Scraping URL: {url}")
            self.logger.info(f"Processing {len(selectors)} selectors")
            
            # Perform the scraping
            result = await self._scrape_with_playwright(url, selectors, wait_for_load, timeout)
            
            if result['success']:
                self.log_execution_complete(f"Extracted data from {len(selectors)} selectors")
                return self.create_success_result(
                    data=result['data'],
                    metadata={
                        'url': url,
                        'page_info': result.get('page_info', {}),
                        'selectors_processed': result.get('selectors_processed', 0),
                        'extraction_method': 'headless_browser'
                    }
                )
            else:
                self.log_execution_error(Exception(result.get('error', 'Unknown error')))
                return self.create_error_result(
                    error=result.get('error', 'Scraping failed'),
                    details=result
                )
                
        except Exception as e:
            self.log_execution_error(e)
            return self.create_error_result(f"Execution failed: {str(e)}")
    
    async def _scrape_with_playwright(self, url: str, selectors: List[Dict], wait_for_load: bool, timeout: int) -> Dict[str, Any]:
        """
        Perform the actual scraping using PlaywrightService
        """
        async with PlaywrightService() as service:
            try:
                # Load the page
                self.logger.info(f"Loading page: {url}")
                await service.load_page(url, wait_for_load)
                
                # Get page info
                page_info = await service.get_page_info()
                self.logger.info(f"Page loaded: {page_info.get('title', 'Unknown')}")
                
                # Process selectors to ensure they're in the correct format
                processed_selectors = self._process_selectors(selectors)
                
                # Extract data using the enhanced extraction method
                extracted_data = await service.extract_all_content(processed_selectors)
                
                self.logger.info(f"Extraction completed. Results: {len(extracted_data) if extracted_data else 0} items")
                
                return {
                    'success': True,
                    'url': url,
                    'data': extracted_data[0] if extracted_data else {},
                    'page_info': page_info,
                    'selectors_processed': len(selectors)
                }
                
            except Exception as e:
                self.logger.error(f"Error scraping {url}: {e}")
                return {
                    'success': False,
                    'url': url,
                    'error': str(e),
                    'data': {},
                    'page_info': {},
                    'selectors_processed': 0
                }
    
    def _process_selectors(self, selectors: List[Dict]) -> List[Dict]:
        """
        Process and validate selector configurations
        """
        processed = []
        
        for selector_config in selectors:
            if not isinstance(selector_config, dict):
                self.logger.warning(f"Invalid selector config (not dict): {selector_config}")
                continue
            
            # Ensure required fields
            if 'selector' not in selector_config:
                self.logger.warning(f"Selector config missing 'selector' field: {selector_config}")
                continue
            
            # Set defaults
            processed_config = {
                'selector': selector_config['selector'],
                'name': selector_config.get('name', selector_config.get('label', selector_config['selector'])),
                'type': selector_config.get('type', 'all'),
                'attribute': selector_config.get('attribute', 'textContent')
            }
            
            # Handle repeating containers with fields
            if processed_config['type'] == 'repeating' and 'fields' in selector_config:
                processed_config['fields'] = selector_config['fields']
            
            # Handle table extraction
            if processed_config['type'] == 'table':
                processed_config['attribute'] = 'table_data'
            
            processed.append(processed_config)
            self.logger.debug(f"Processed selector: {processed_config}")
        
        return processed
    
    def validate_config(self) -> bool:
        """
        Validate WebSource-specific configuration
        """
        if not super().validate_config():
            return False
        
        config = self.get_config_value('config', {})
        
        # Check for required configuration fields
        if not config.get('url'):
            self.logger.error("WebSource node missing 'url' in config")
            return False
        
        selectors = config.get('selectors', [])
        if not selectors or not isinstance(selectors, list):
            self.logger.error("WebSource node missing valid 'selectors' array in config")
            return False
        
        # Validate each selector
        for i, selector in enumerate(selectors):
            if not isinstance(selector, dict):
                self.logger.error(f"Selector {i} is not a dictionary")
                return False
            
            if not selector.get('selector'):
                self.logger.error(f"Selector {i} missing 'selector' field")
                return False
        
        return True