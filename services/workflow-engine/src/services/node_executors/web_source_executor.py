"""
WebSource Node Executor

Executes web scraping operations using headless browser technology.
Handles visual selector configurations and structured data extraction.
"""

import asyncio
import logging
from typing import Dict, Any, Optional, List
from .base_executor import BaseNodeExecutor, NodeExecutionResult
from ..playwright_service import PlaywrightService

logger = logging.getLogger(__name__)

class WebSourceExecutor(BaseNodeExecutor):
    """Executor for WebSource nodes using headless browser scraping"""
    
    def __init__(self, node_config: Dict[str, Any]):
        super().__init__(node_config)
        self.node_type = 'webSource'
    
    async def execute(self, input_data: Optional[Dict[str, Any]] = None) -> NodeExecutionResult:
        """
        Execute web scraping using Playwright-based headless browser
        
        Expected node configuration:
        {
            "id": "node_id",
            "type": "webSource",
            "data": {
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
        
        try:
            # Validate configuration
            if not self.validate_config():
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=False,
                    data=None,
                    error="Invalid node configuration",
                    metadata={}
                )
            
            # Extract configuration from node data
            data = self.node_config.get('data', {})
            
            # Handle both direct format and monitoring format
            url = data.get('url')
            selectors = data.get('selectors', [])
            options = data.get('options', {})
            
            # Check for monitoring configuration (used by frontend AI system)
            monitoring = data.get('monitoring', {})
            if not url and monitoring.get('url'):
                url = monitoring.get('url')
                logger.info(f"Found URL in monitoring config: {url}")
            
            if not selectors and monitoring.get('selectors'):
                selectors = monitoring.get('selectors')
                logger.info(f"Found {len(selectors)} selectors in monitoring config")
            
            # Validate required fields
            if not url:
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=False,
                    data=None,
                    error="Missing required field: url",
                    metadata={}
                )
            
            if not selectors:
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=False,
                    data=None,
                    error="Missing required field: selectors",
                    metadata={}
                )
            
            # Set default options
            wait_for_load = options.get('wait_for_load', True)
            timeout = options.get('timeout', 30000)
            
            logger.info(f"Scraping URL: {url}")
            logger.info(f"Processing {len(selectors)} selectors")
            
            # Perform the scraping
            result = await self._scrape_with_playwright(url, selectors, wait_for_load, timeout)
            
            if result['success']:
                logger.info(f"Extracted data from {len(selectors)} selectors")
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=True,
                    data=result['data'],
                    error=None,
                    metadata={
                        'url': url,
                        'page_info': result.get('page_info', {}),
                        'selectors_processed': result.get('selectors_processed', 0),
                        'extraction_method': 'headless_browser'
                    }
                )
            else:
                logger.error(f"Scraping failed: {result.get('error', 'Unknown error')}")
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=False,
                    data=None,
                    error=result.get('error', 'Scraping failed'),
                    metadata={'details': result}
                )
                
        except Exception as e:
            logger.error(f"WebSource execution failed: {e}")
            return NodeExecutionResult(
                node_id=self.node_id,
                success=False,
                data=None,
                error=f"Execution failed: {str(e)}",
                metadata={'error_type': 'general_error'}
            )
    
    async def _scrape_with_playwright(self, url: str, selectors: List[Dict], wait_for_load: bool, timeout: int) -> Dict[str, Any]:
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
                logger.info(f"Page loaded: {page_info.get('title', 'Unknown')}")
                
                # Process selectors to ensure they're in the correct format
                processed_selectors = self._process_selectors(selectors)
                
                # Extract data using the enhanced extraction method
                extracted_data = await service.extract_all_content(processed_selectors)
                
                logger.info(f"Extraction completed. Results: {len(extracted_data) if extracted_data else 0} items")
                
                return {
                    'success': True,
                    'url': url,
                    'data': extracted_data[0] if extracted_data else {},
                    'page_info': page_info,
                    'selectors_processed': len(selectors)
                }
                
            except Exception as e:
                logger.error(f"Error scraping {url}: {e}")
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
                logger.warning(f"Invalid selector config (not dict): {selector_config}")
                continue
            
            # Ensure required fields
            if 'selector' not in selector_config:
                logger.warning(f"Selector config missing 'selector' field: {selector_config}")
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
            logger.debug(f"Processed selector: {processed_config}")
        
        return processed
    
    def validate_config(self) -> bool:
        """
        Validate WebSource-specific configuration
        """
        # Basic validation is handled by parent class
        
        data = self.node_config.get('data', {})
        
        # Check for required configuration fields
        if not data.get('url'):
            logger.error("WebSource node missing 'url' in data")
            return False
        
        selectors = data.get('selectors', [])
        if not selectors or not isinstance(selectors, list):
            logger.error("WebSource node missing valid 'selectors' array in data")
            return False
        
        # Validate each selector
        for i, selector in enumerate(selectors):
            if not isinstance(selector, dict):
                logger.error(f"Selector {i} is not a dictionary")
                return False
            
            if not selector.get('selector'):
                logger.error(f"Selector {i} missing 'selector' field")
                return False
        
        return True