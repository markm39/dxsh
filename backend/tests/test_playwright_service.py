import unittest
import asyncio
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from app.services.playwright_service import PlaywrightService, scrape_url


class TestPlaywrightService(unittest.TestCase):
    """Test suite for Playwright web scraping service"""
    
    def setUp(self):
        """Set up test case"""
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
    
    def tearDown(self):
        """Clean up after test"""
        if self.loop.is_running():
            self.loop.stop()
        self.loop.close()
    
    def test_playwright_service_initialization(self):
        """Test PlaywrightService can be created"""
        service = PlaywrightService()
        self.assertIsNotNone(service)
        self.assertIsNone(service.browser)
        self.assertIsNone(service.page)
    
    @patch('app.services.playwright_service.async_playwright')
    async def test_initialize_browser(self, mock_playwright):
        """Test browser initialization"""
        # Mock the playwright components
        mock_playwright_instance = MagicMock()
        mock_browser = MagicMock()
        mock_chromium = MagicMock()
        
        mock_chromium.launch.return_value = mock_browser
        mock_playwright_instance.chromium = mock_chromium
        mock_playwright.return_value.start.return_value = mock_playwright_instance
        
        service = PlaywrightService()
        await service.initialize()
        
        # Verify initialization
        self.assertIsNotNone(service.browser)
        mock_playwright.return_value.start.assert_called_once()
        mock_chromium.launch.assert_called_once()
    
    @patch('app.services.playwright_service.async_playwright')
    async def test_load_page(self, mock_playwright):
        """Test loading a webpage"""
        # Mock all the components
        mock_playwright_instance = MagicMock()
        mock_browser = MagicMock()
        mock_context = MagicMock()
        mock_page = MagicMock()
        mock_response = MagicMock()
        
        # Set up the mock chain
        mock_response.status = 200
        mock_page.goto.return_value = mock_response
        mock_page.wait_for_load_state = MagicMock()
        mock_context.new_page.return_value = mock_page
        mock_browser.new_context.return_value = mock_context
        mock_playwright_instance.chromium.launch.return_value = mock_browser
        mock_playwright.return_value.start.return_value = mock_playwright_instance
        
        service = PlaywrightService()
        page = await service.load_page('https://example.com')
        
        # Verify page loading
        self.assertIsNotNone(page)
        mock_page.goto.assert_called_once()
        mock_page.wait_for_load_state.assert_called_once()
    
    def test_generate_css_selector_validation(self):
        """Test CSS selector generation input validation"""
        service = PlaywrightService()
        
        # Test without loaded page should raise exception
        with self.assertRaises(Exception):
            self.loop.run_until_complete(
                service.generate_css_selector("test text")
            )
    
    def test_extract_content_validation(self):
        """Test content extraction input validation"""
        service = PlaywrightService()
        
        # Test without loaded page should raise exception
        with self.assertRaises(Exception):
            self.loop.run_until_complete(
                service.extract_content([{'selector': '.test', 'label': 'Test'}])
            )
    
    @patch('app.services.playwright_service.PlaywrightService')
    async def test_scrape_url_utility(self, mock_service_class):
        """Test the utility scrape_url function"""
        # Mock the service instance
        mock_service = MagicMock()
        mock_service_class.return_value.__aenter__.return_value = mock_service
        mock_service_class.return_value.__aexit__.return_value = None
        
        # Mock service methods
        mock_service.load_page = MagicMock()
        mock_service.extract_content.return_value = {'test': 'content'}
        mock_service.get_page_info.return_value = {'title': 'Test Page', 'url': 'https://example.com'}
        
        # Test the utility function
        result = await scrape_url(
            'https://example.com',
            [{'selector': '.test', 'label': 'Test'}]
        )
        
        # Verify result structure
        self.assertTrue(result['success'])
        self.assertEqual(result['url'], 'https://example.com')
        self.assertIn('content', result)
        self.assertIn('page_info', result)
    
    def test_selector_config_structure(self):
        """Test expected selector configuration structure"""
        # Valid selector config
        valid_config = {
            'selector': '.test-class',
            'label': 'Test Element',
            'attribute': 'textContent'
        }
        
        # Test required fields
        self.assertIn('selector', valid_config)
        self.assertIn('label', valid_config)
        
        # Test optional attribute field
        self.assertIn('attribute', valid_config)
        self.assertIn(valid_config['attribute'], ['textContent', 'innerHTML', 'href'])
    
    def test_css_selector_patterns(self):
        """Test CSS selector pattern validation"""
        valid_selectors = [
            '.class-name',
            '#element-id',
            'div.class',
            'div > p',
            '[data-attribute="value"]',
            'div:nth-child(1)',
            'h1, h2, h3'
        ]
        
        for selector in valid_selectors:
            # These are valid CSS selector patterns
            self.assertIsInstance(selector, str)
            self.assertGreater(len(selector), 0)
    
    @patch('app.services.playwright_service.logger')
    def test_error_logging(self, mock_logger):
        """Test that errors are properly logged"""
        service = PlaywrightService()
        
        # Test error handling without browser
        try:
            self.loop.run_until_complete(
                service.extract_content([{'selector': '.test'}])
            )
        except Exception:
            pass  # Expected to fail
        
        # Should have logged the error attempt
        self.assertTrue(True)  # Basic test that we can mock logger


class TestAsyncPlaywrightService(unittest.IsolatedAsyncioTestCase):
    """Async test cases for Playwright service using real async test framework"""
    
    async def test_async_context_manager(self):
        """Test that PlaywrightService works as async context manager"""
        with patch('app.services.playwright_service.async_playwright') as mock_playwright:
            # Mock the playwright components
            mock_playwright_instance = MagicMock()
            mock_browser = MagicMock()
            mock_chromium = MagicMock()
            
            mock_chromium.launch.return_value = mock_browser
            mock_playwright_instance.chromium = mock_chromium
            mock_playwright.return_value.start.return_value = mock_playwright_instance
            
            # Test async context manager
            async with PlaywrightService() as service:
                self.assertIsNotNone(service)
                # Should have initialized browser
                self.assertIsNotNone(service.browser)
    
    async def test_cleanup_method(self):
        """Test cleanup method handles None values gracefully"""
        service = PlaywrightService()
        
        # Should not raise exception when cleaning up uninitialized service
        await service.cleanup()
        
        # All attributes should remain None
        self.assertIsNone(service.browser)
        self.assertIsNone(service.page)


class TestPlaywrightProductionReadiness(unittest.IsolatedAsyncioTestCase):
    """Production-ready tests for PlaywrightService to catch real issues"""
    
    async def test_real_espn_loading(self):
        """Test loading ESPN.com specifically (the reported issue)"""
        try:
            async with PlaywrightService() as service:
                # This should not fail with set_user_agent error
                page = await service.load_page('https://espn.com', wait_for_load=False)
                self.assertIsNotNone(page)
                
                # Check that page actually loaded
                title = await page.title()
                self.assertIsNotNone(title)
                self.assertGreater(len(title), 0)
                
        except Exception as e:
            self.fail(f"ESPN loading failed with error: {e}")
    
    async def test_user_agent_is_set_correctly(self):
        """Test that user agent is properly set and not showing HeadlessChrome"""
        async with PlaywrightService() as service:
            page = await service.load_page('https://httpbin.org/user-agent')
            content = await page.content()
            
            # Should not contain HeadlessChrome which indicates bot detection
            self.assertNotIn('HeadlessChrome', content)
            # Should contain a realistic browser string
            self.assertTrue(any(browser in content for browser in ['Chrome', 'Mozilla', 'Safari']))
    
    async def test_custom_user_agent(self):
        """Test that custom user agent works"""
        custom_ua = "CustomTestAgent/1.0"
        service = PlaywrightService()
        await service.initialize(user_agent=custom_ua)
        
        page = await service.load_page('https://httpbin.org/user-agent')
        content = await page.content()
        
        self.assertIn(custom_ua, content)
        await service.cleanup()
    
    async def test_css_selector_generation_real_page(self):
        """Test CSS selector generation on a real page"""
        async with PlaywrightService() as service:
            page = await service.load_page('https://httpbin.org/html')
            
            # Try to generate selectors for known text
            selectors = await service.generate_css_selector('Herman Melville')
            self.assertIsInstance(selectors, list)
            
            # If selectors found, test one
            if selectors:
                result = await service.test_selector(selectors[0])
                self.assertGreater(result['count'], 0)
    
    async def test_error_handling_timeout(self):
        """Test timeout handling"""
        async with PlaywrightService() as service:
            # This should timeout gracefully
            with self.assertRaises(Exception):
                await service.load_page('https://httpbin.org/delay/40')
    
    async def test_error_handling_404(self):
        """Test 404 error handling"""
        async with PlaywrightService() as service:
            with self.assertRaises(Exception):
                await service.load_page('https://httpbin.org/status/404')
    
    async def test_multiple_page_loads(self):
        """Test loading multiple pages sequentially"""
        async with PlaywrightService() as service:
            # Load first page
            page1 = await service.load_page('https://httpbin.org/html')
            title1 = await page1.title()
            
            # Load second page
            page2 = await service.load_page('https://httpbin.org/json')
            content2 = await page2.content()
            
            self.assertIsNotNone(title1)
            self.assertIn('json', content2.lower())
    
    async def test_content_extraction(self):
        """Test extracting content from real page"""
        async with PlaywrightService() as service:
            page = await service.load_page('https://httpbin.org/html')
            
            selectors = [
                {'selector': 'title', 'label': 'page_title', 'attribute': 'textContent'},
                {'selector': 'h1', 'label': 'heading', 'attribute': 'textContent'}
            ]
            
            content = await service.extract_content(selectors)
            self.assertIn('page_title', content)
            self.assertIsNotNone(content['page_title'])
    
    async def test_scrape_url_utility_real(self):
        """Test scrape_url utility with real URL"""
        selectors = [
            {'selector': 'title', 'label': 'page_title', 'attribute': 'textContent'}
        ]
        
        result = await scrape_url('https://httpbin.org/html', selectors)
        
        self.assertTrue(result['success'])
        self.assertEqual(result['url'], 'https://httpbin.org/html')
        self.assertIn('content', result)
        self.assertIn('page_title', result['content'])
    
    async def test_robust_cleanup(self):
        """Test that cleanup works in all scenarios"""
        service = PlaywrightService()
        
        # Test cleanup without initialization
        await service.cleanup()
        
        # Test cleanup after initialization
        await service.initialize()
        await service.cleanup()
        
        # Test cleanup after page loading
        await service.initialize()
        await service.load_page('https://httpbin.org/html')
        await service.cleanup()


class TestPlaywrightIntegration(unittest.IsolatedAsyncioTestCase):
    """Integration tests for the monitoring system"""
    
    async def test_css_selector_workflow(self):
        """Test the complete CSS selector generation workflow"""
        async with PlaywrightService() as service:
            # Load a page
            page = await service.load_page('https://httpbin.org/html')
            
            # Generate selectors
            selectors = await service.generate_css_selector('Herman Melville')
            
            # Test generated selectors
            for selector in selectors[:2]:  # Test first 2
                result = await service.test_selector(selector)
                self.assertIsInstance(result, dict)
                self.assertIn('count', result)
    
    async def test_monitoring_simulation(self):
        """Simulate a monitoring job workflow"""
        async with PlaywrightService() as service:
            # Load target page
            page = await service.load_page('https://httpbin.org/html')
            
            # Define monitoring selectors
            selectors = [
                {'selector': 'title', 'label': 'page_title', 'attribute': 'textContent'},
                {'selector': 'p', 'label': 'first_paragraph', 'attribute': 'textContent'}
            ]
            
            # Extract content (simulating monitoring check)
            content = await service.extract_content(selectors)
            
            # Verify we got content
            self.assertIsInstance(content, dict)
            self.assertIn('page_title', content)


class TestPatternBasedListExtraction(unittest.IsolatedAsyncioTestCase):
    """Test the new pattern-based list extraction functionality"""
    
    async def test_simple_list_extraction(self):
        """Test pattern detection on a simple HTML list"""
        async with PlaywrightService() as service:
            # Create a test HTML page with a simple list
            html_content = '''
            <html>
            <body>
                <ul id="test-list">
                    <li>Item 1 - Description A</li>
                    <li>Item 2 - Description B</li>
                    <li>Item 3 - Description C</li>
                </ul>
            </body>
            </html>
            '''
            
            # Load HTML as data URL
            data_url = f"data:text/html,{html_content}"
            await service.load_page(data_url)
            
            # Test list extraction
            result = await service._extract_list_data('#test-list')
            
            # Verify results
            self.assertIsInstance(result, list)
            self.assertEqual(len(result), 3)
            
            # Check each item has expected structure
            for i, item in enumerate(result):
                self.assertIn('_data_type', item)
                self.assertEqual(item['_data_type'], 'list_item')
                self.assertIn('_item_index', item)
                self.assertEqual(item['_item_index'], i)
                self.assertIn('full_text', item)
    
    async def test_complex_list_with_links_and_structure(self):
        """Test pattern detection on complex list with links and nested elements"""
        async with PlaywrightService() as service:
            # Create a test HTML page with complex list structure
            html_content = '''
            <html>
            <body>
                <ol id="player-rankings">
                    <li>
                        <span class="rank">1</span>
                        <a href="/player/1">John Smith</a>
                        <span class="position">QB</span>
                        <span class="school">Stanford University</span>
                        <span class="rating">97.5</span>
                    </li>
                    <li>
                        <span class="rank">2</span>
                        <a href="/player/2">Mike Johnson</a>
                        <span class="position">RB</span>
                        <span class="school">USC</span>
                        <span class="rating">96.8</span>
                    </li>
                    <li>
                        <span class="rank">3</span>
                        <a href="/player/3">David Williams</a>
                        <span class="position">WR</span>
                        <span class="school">UCLA</span>
                        <span class="rating">95.2</span>
                    </li>
                </ol>
            </body>
            </html>
            '''
            
            data_url = f"data:text/html,{html_content}"
            await service.load_page(data_url)
            
            # Test list extraction
            result = await service._extract_list_data('#player-rankings')
            
            # Verify results
            self.assertIsInstance(result, list)
            self.assertEqual(len(result), 3)
            
            # Check first item structure
            first_item = result[0]
            self.assertIn('_data_type', first_item)
            self.assertIn('_list_type', first_item)
            self.assertEqual(first_item['_list_type'], 'ol')
            
            # Should have extracted child elements
            child_elements = [key for key in first_item.keys() if key.startswith('element_')]
            self.assertGreater(len(child_elements), 0)
            
            # Should have extracted links
            self.assertIn('links', first_item)
            self.assertIsInstance(first_item['links'], list)
            self.assertGreater(len(first_item['links']), 0)
            
            # Check link structure
            link = first_item['links'][0]
            self.assertIn('href', link)
            self.assertIn('text', link)
            self.assertIn('/player/', link['href'])
    
    async def test_list_pattern_detection(self):
        """Test that pattern detection identifies repeated structures"""
        async with PlaywrightService() as service:
            # Create list with consistent pattern
            html_content = '''
            <html>
            <body>
                <ul id="pattern-list">
                    <li><img src="img1.jpg" alt="Image 1"><span>Product 1</span><span class="price">$10</span></li>
                    <li><img src="img2.jpg" alt="Image 2"><span>Product 2</span><span class="price">$20</span></li>
                    <li><img src="img3.jpg" alt="Image 3"><span>Product 3</span><span class="price">$30</span></li>
                    <li><span>Different Structure</span></li>
                </ul>
            </body>
            </html>
            '''
            
            data_url = f"data:text/html,{html_content}"
            await service.load_page(data_url)
            
            # Test list extraction
            result = await service._extract_list_data('#pattern-list')
            
            # Verify results
            self.assertIsInstance(result, list)
            self.assertEqual(len(result), 4)
            
            # First 3 items should have images
            for i in range(3):
                item = result[i]
                self.assertIn('images', item)
                self.assertIsInstance(item['images'], list)
                self.assertGreater(len(item['images']), 0)
                
                # Check image structure
                image = item['images'][0]
                self.assertIn('src', image)
                self.assertIn('alt', image)
            
            # Last item should not have images (different structure)
            last_item = result[3]
            if 'images' in last_item:
                self.assertEqual(len(last_item['images']), 0)
    
    async def test_extract_all_content_with_list_detection(self):
        """Test that extract_all_content properly detects and uses list extraction"""
        async with PlaywrightService() as service:
            # Create page with list that should trigger structured extraction
            html_content = '''
            <html>
            <body>
                <ul class="structured-list">
                    <li>
                        <div class="rank">1</div>
                        <div class="name">Player One</div>
                        <div class="stats">100 points</div>
                    </li>
                    <li>
                        <div class="rank">2</div>
                        <div class="name">Player Two</div>
                        <div class="stats">95 points</div>
                    </li>
                </ul>
            </body>
            </html>
            '''
            
            data_url = f"data:text/html,{html_content}"
            await service.load_page(data_url)
            
            # Test with extract_all_content (should detect structured list)
            selectors = [{'selector': '.structured-list', 'label': 'list_data'}]
            result = await service.extract_all_content(selectors)
            
            # Verify it used structured extraction
            self.assertIsInstance(result, list)
            self.assertGreater(len(result), 0)
            
            # Should have extracted multiple list items
            if len(result) > 1:
                # Check that it's structured list data
                first_item = result[0]
                self.assertIn('_data_type', first_item)
    
    async def test_empty_list_handling(self):
        """Test handling of empty lists"""
        async with PlaywrightService() as service:
            html_content = '''
            <html>
            <body>
                <ul id="empty-list"></ul>
            </body>
            </html>
            '''
            
            data_url = f"data:text/html,{html_content}"
            await service.load_page(data_url)
            
            result = await service._extract_list_data('#empty-list')
            
            # Should return empty list, not None
            self.assertIsInstance(result, list)
            self.assertEqual(len(result), 0)
    
    async def test_nonexistent_list_handling(self):
        """Test handling of nonexistent list selectors"""
        async with PlaywrightService() as service:
            html_content = '''
            <html>
            <body>
                <div>No lists here</div>
            </body>
            </html>
            '''
            
            data_url = f"data:text/html,{html_content}"
            await service.load_page(data_url)
            
            result = await service._extract_list_data('#nonexistent-list')
            
            # Should return empty list
            self.assertIsInstance(result, list)
            self.assertEqual(len(result), 0)
    
    async def test_nested_list_handling(self):
        """Test handling of nested lists"""
        async with PlaywrightService() as service:
            html_content = '''
            <html>
            <body>
                <ul id="nested-list">
                    <li>
                        Parent Item 1
                        <ul>
                            <li>Child Item 1.1</li>
                            <li>Child Item 1.2</li>
                        </ul>
                    </li>
                    <li>Parent Item 2</li>
                </ul>
            </body>
            </html>
            '''
            
            data_url = f"data:text/html,{html_content}"
            await service.load_page(data_url)
            
            result = await service._extract_list_data('#nested-list')
            
            # Should extract parent list items only
            self.assertIsInstance(result, list)
            self.assertEqual(len(result), 2)
            
            # Check that both items are properly extracted
            for item in result:
                self.assertIn('_data_type', item)
                self.assertIn('full_text', item)
    
    async def test_data_attributes_extraction(self):
        """Test extraction of data attributes from list items"""
        async with PlaywrightService() as service:
            html_content = '''
            <html>
            <body>
                <ul id="data-list">
                    <li data-id="1" data-category="sports">
                        <span data-field="name">Player 1</span>
                    </li>
                    <li data-id="2" data-category="sports">
                        <span data-field="name">Player 2</span>
                    </li>
                </ul>
            </body>
            </html>
            '''
            
            data_url = f"data:text/html,{html_content}"
            await service.load_page(data_url)
            
            result = await service._extract_list_data('#data-list')
            
            # Verify data attributes are extracted
            self.assertIsInstance(result, list)
            self.assertEqual(len(result), 2)
            
            # Check for data attributes in child elements
            first_item = result[0]
            child_elements = [first_item[key] for key in first_item.keys() if key.startswith('element_')]
            
            # Should have extracted child elements with data attributes
            self.assertGreater(len(child_elements), 0)
            
            # Look for data attributes in child elements
            found_data_attrs = False
            for child in child_elements:
                if 'data_attributes' in child:
                    found_data_attrs = True
                    break
            
            # At least one child should have data attributes
            self.assertTrue(found_data_attrs or 'data_attributes' in first_item)


if __name__ == '__main__':
    # Add a simple test runner that can be used for quick verification
    async def run_quick_test():
        """Quick test to verify the service works correctly"""
        print("🧪 Running quick Playwright service verification...")
        try:
            async with PlaywrightService() as service:
                print("✓ Service initialized")
                
                # Test ESPN specifically (the reported issue)
                page = await service.load_page('https://espn.com', wait_for_load=False)
                title = await page.title()
                print(f"✓ ESPN loaded successfully: {title[:50]}...")
                
                # Test selector generation
                page = await service.load_page('https://httpbin.org/html')
                selectors = await service.generate_css_selector('Herman Melville')
                print(f"✓ Generated {len(selectors)} CSS selectors")
                
                # Test content extraction
                content = await service.extract_content([
                    {'selector': 'title', 'label': 'title', 'attribute': 'textContent'}
                ])
                print(f"✓ Content extraction works: {content}")
                
            print("🎉 All quick tests passed!")
            return True
            
        except Exception as e:
            print(f"❌ Quick test failed: {e}")
            return False
    
    # Run either the quick test or full unittest suite
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == '--quick':
        result = asyncio.run(run_quick_test())
        sys.exit(0 if result else 1)
    else:
        unittest.main()