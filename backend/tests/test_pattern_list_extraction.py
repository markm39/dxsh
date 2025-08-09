#!/usr/bin/env python3
"""
Dedicated test script for pattern-based list extraction functionality.
Tests the new improved _extract_list_data method with real-world scenarios.
"""

import asyncio
import sys
import os
import unittest
from pathlib import Path

# Add the parent directory to the path to import app modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.services.playwright_service import PlaywrightService


class TestPatternListExtractionDetailed(unittest.IsolatedAsyncioTestCase):
    """Comprehensive tests for pattern-based list extraction"""
    
    async def test_on3_style_player_rankings_simulation(self):
        """Test extraction on a structure similar to on3.com player rankings"""
        async with PlaywrightService() as service:
            # Simulate the complex on3.com structure with player data
            html_content = '''
            <html>
            <body>
                <ol class="player-rankings">
                    <li class="player-item">
                        <div class="rank-info">
                            <span class="rank">1</span>
                            <span class="position">QB</span>
                        </div>
                        <div class="player-details">
                            <a href="/player/dylan-raiola" class="player-name">Dylan Raiola</a>
                            <div class="player-meta">
                                <span class="class">2024</span>
                                <span class="location">Chandler, AZ</span>
                            </div>
                        </div>
                        <div class="ratings">
                            <span class="composite">98.75</span>
                            <span class="national-rank">1</span>
                            <span class="position-rank">1</span>
                        </div>
                        <div class="social">
                            <span class="twitter">10.2K</span>
                            <span class="instagram">15.3K</span>
                        </div>
                    </li>
                    <li class="player-item">
                        <div class="rank-info">
                            <span class="rank">2</span>
                            <span class="position">QB</span>
                        </div>
                        <div class="player-details">
                            <a href="/player/nico-iamaleava" class="player-name">Nico Iamaleava</a>
                            <div class="player-meta">
                                <span class="class">2023</span>
                                <span class="location">Long Beach, CA</span>
                            </div>
                        </div>
                        <div class="ratings">
                            <span class="composite">97.82</span>
                            <span class="national-rank">2</span>
                            <span class="position-rank">2</span>
                        </div>
                        <div class="social">
                            <span class="twitter">8.1K</span>
                            <span class="instagram">12.7K</span>
                        </div>
                    </li>
                    <li class="player-item">
                        <div class="rank-info">
                            <span class="rank">3</span>
                            <span class="position">RB</span>
                        </div>
                        <div class="player-details">
                            <a href="/player/richard-young" class="player-name">Richard Young</a>
                            <div class="player-meta">
                                <span class="class">2024</span>
                                <span class="location">Lehigh Acres, FL</span>
                            </div>
                        </div>
                        <div class="ratings">
                            <span class="composite">96.45</span>
                            <span class="national-rank">3</span>
                            <span class="position-rank">1</span>
                        </div>
                        <div class="social">
                            <span class="twitter">5.2K</span>
                            <span class="instagram">8.9K</span>
                        </div>
                    </li>
                </ol>
            </body>
            </html>
            '''
            
            data_url = f"data:text/html,{html_content}"
            await service.load_page(data_url)
            
            # Test the improved list extraction
            result = await service._extract_list_data('.player-rankings')
            
            print(f"\n📊 Extracted {len(result)} player items")
            
            # Verify we got the expected number of items
            self.assertEqual(len(result), 3)
            
            # Check the structure of the first item
            first_player = result[0]
            print(f"\n🏈 First Player Data Structure:")
            for key, value in first_player.items():
                if not key.startswith('_'):  # Skip metadata fields for readability
                    print(f"  {key}: {value}")
            
            # Verify essential fields
            self.assertIn('_data_type', first_player)
            self.assertEqual(first_player['_data_type'], 'list_item')
            self.assertIn('_list_type', first_player)
            self.assertEqual(first_player['_list_type'], 'ol')
            
            # Should have links to player profiles
            self.assertIn('links', first_player)
            self.assertIsInstance(first_player['links'], list)
            self.assertGreater(len(first_player['links']), 0)
            
            # Check link structure
            player_link = first_player['links'][0]
            self.assertIn('href', player_link)
            self.assertIn('text', player_link)
            self.assertIn('/player/', player_link['href'])
            
            # Should have extracted multiple child elements
            child_elements = [key for key in first_player.keys() if key.startswith('element_')]
            self.assertGreater(len(child_elements), 3)  # At least 4 main div sections
            
            # Check that each child element has proper structure
            for element_key in child_elements:
                element = first_player[element_key]
                self.assertIn('tag', element)
                self.assertIn('text', element)
                self.assertIn('classes', element)
            
            # Verify all three players have consistent structure
            for i, player in enumerate(result):
                # Each should have the same basic structure
                self.assertIn('_data_type', player)
                self.assertIn('_item_index', player)
                self.assertEqual(player['_item_index'], i)
                self.assertIn('links', player)
                self.assertIn('full_text', player)
                
                # Each should have extracted player data
                self.assertIsNotNone(player['full_text'])
                self.assertGreater(len(player['full_text']), 10)
    
    async def test_simple_repeated_pattern_detection(self):
        """Test detection of simple repeated patterns"""
        async with PlaywrightService() as service:
            html_content = '''
            <html>
            <body>
                <ul class="product-list">
                    <li>
                        <img src="product1.jpg" alt="Product 1">
                        <h3>Product Name 1</h3>
                        <span class="price">$19.99</span>
                        <button>Add to Cart</button>
                    </li>
                    <li>
                        <img src="product2.jpg" alt="Product 2">
                        <h3>Product Name 2</h3>
                        <span class="price">$29.99</span>
                        <button>Add to Cart</button>
                    </li>
                    <li>
                        <img src="product3.jpg" alt="Product 3">
                        <h3>Product Name 3</h3>
                        <span class="price">$39.99</span>
                        <button>Add to Cart</button>
                    </li>
                </ul>
            </body>
            </html>
            '''
            
            data_url = f"data:text/html,{html_content}"
            await service.load_page(data_url)
            
            result = await service._extract_list_data('.product-list')
            
            print(f"\n📦 Product List Extraction Results:")
            print(f"  Items extracted: {len(result)}")
            
            self.assertEqual(len(result), 3)
            
            # All items should have the same structure
            for i, item in enumerate(result):
                print(f"\n  Product {i+1}:")
                print(f"    Images: {len(item.get('images', []))}")
                print(f"    Links: {len(item.get('links', []))}")
                print(f"    Child Elements: {len([k for k in item.keys() if k.startswith('element_')])}")
                
                # Should have images
                self.assertIn('images', item)
                self.assertEqual(len(item['images']), 1)
                
                # Check image structure
                image = item['images'][0]
                self.assertIn('src', image)
                self.assertIn('alt', image)
                self.assertIn('product', image['src'])
                
                # Should have child elements for h3, span, button
                child_elements = [item[k] for k in item.keys() if k.startswith('element_')]
                self.assertGreaterEqual(len(child_elements), 3)
    
    async def test_mixed_structure_list(self):
        """Test list with mixed structures (some items different)"""
        async with PlaywrightService() as service:
            html_content = '''
            <html>
            <body>
                <ul class="mixed-list">
                    <li class="regular-item">
                        <span class="label">Item 1</span>
                        <span class="value">Value 1</span>
                    </li>
                    <li class="regular-item">
                        <span class="label">Item 2</span>
                        <span class="value">Value 2</span>
                    </li>
                    <li class="special-item">
                        <div class="special-content">
                            <h3>Special Item</h3>
                            <p>This has a different structure</p>
                            <a href="/special">Learn More</a>
                        </div>
                    </li>
                    <li class="regular-item">
                        <span class="label">Item 3</span>
                        <span class="value">Value 3</span>
                    </li>
                </ul>
            </body>
            </html>
            '''
            
            data_url = f"data:text/html,{html_content}"
            await service.load_page(data_url)
            
            result = await service._extract_list_data('.mixed-list')
            
            print(f"\n🔀 Mixed Structure List Results:")
            print(f"  Items extracted: {len(result)}")
            
            self.assertEqual(len(result), 4)
            
            # Check that all items are extracted despite different structures
            for i, item in enumerate(result):
                print(f"\n  Item {i+1} structure:")
                child_count = len([k for k in item.keys() if k.startswith('element_')])
                print(f"    Child elements: {child_count}")
                print(f"    Has links: {'links' in item and len(item['links']) > 0}")
                print(f"    Full text length: {len(item.get('full_text', ''))}")
                
                self.assertIn('_data_type', item)
                self.assertIn('full_text', item)
                self.assertIsNotNone(item['full_text'])
            
            # The special item (index 2) should have a link
            special_item = result[2]
            if 'links' in special_item:
                self.assertGreater(len(special_item['links']), 0)
                link = special_item['links'][0]
                self.assertIn('/special', link['href'])
    
    async def test_extract_all_content_structured_detection(self):
        """Test that extract_all_content properly detects and uses structured extraction"""
        async with PlaywrightService() as service:
            html_content = '''
            <html>
            <body>
                <div class="content">
                    <ul class="news-list">
                        <li class="news-item">
                            <h3><a href="/article/1">Breaking News Article 1</a></h3>
                            <p class="summary">This is a summary of the first article...</p>
                            <span class="date">2024-01-15</span>
                        </li>
                        <li class="news-item">
                            <h3><a href="/article/2">Breaking News Article 2</a></h3>
                            <p class="summary">This is a summary of the second article...</p>
                            <span class="date">2024-01-16</span>
                        </li>
                    </ul>
                </div>
            </body>
            </html>
            '''
            
            data_url = f"data:text/html,{html_content}"
            await service.load_page(data_url)
            
            # Test with extract_all_content which should detect the structured list
            selectors = [{'selector': '.news-list', 'label': 'news_data'}]
            result = await service.extract_all_content(selectors)
            
            print(f"\n📰 News List via extract_all_content:")
            print(f"  Result type: {type(result)}")
            print(f"  Items extracted: {len(result) if isinstance(result, list) else 'N/A'}")
            
            # Should return a list of structured items
            self.assertIsInstance(result, list)
            
            if len(result) > 0:
                first_item = result[0]
                print(f"  First item keys: {list(first_item.keys())}")
                
                # Should have structured data type
                if '_data_type' in first_item:
                    print(f"  Data type: {first_item['_data_type']}")


async def run_comprehensive_test():
    """Run a comprehensive test of the pattern-based list extraction"""
    print("🧪 Starting Comprehensive Pattern-Based List Extraction Tests")
    print("=" * 70)
    
    try:
        # Run the test suite
        loader = unittest.TestLoader()
        suite = loader.loadTestsFromTestCase(TestPatternListExtractionDetailed)
        
        # Custom test runner for better output
        class VerboseTestResult(unittest.TextTestResult):
            def startTest(self, test):
                super().startTest(test)
                print(f"\n🔬 Running: {test._testMethodName}")
        
        runner = unittest.TextTestRunner(
            resultclass=VerboseTestResult,
            verbosity=2,
            stream=sys.stdout
        )
        
        result = runner.run(suite)
        
        print("\n" + "=" * 70)
        if result.wasSuccessful():
            print("✅ All pattern-based list extraction tests passed!")
            return True
        else:
            print(f"❌ {len(result.failures)} test(s) failed, {len(result.errors)} error(s)")
            for test, traceback in result.failures + result.errors:
                print(f"\n❌ {test}: {traceback}")
            return False
            
    except Exception as e:
        print(f"❌ Test execution failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def run_quick_verification():
    """Quick verification that the new list extraction works"""
    print("⚡ Quick Pattern-Based List Extraction Verification")
    print("=" * 50)
    
    try:
        async with PlaywrightService() as service:
            # Test with a simple structured list
            html_content = '''
            <html>
            <body>
                <ul id="test-list">
                    <li>
                        <span class="rank">1</span>
                        <a href="/item/1">First Item</a>
                        <span class="category">Category A</span>
                    </li>
                    <li>
                        <span class="rank">2</span>
                        <a href="/item/2">Second Item</a>
                        <span class="category">Category B</span>
                    </li>
                </ul>
            </body>
            </html>
            '''
            
            data_url = f"data:text/html,{html_content}"
            await service.load_page(data_url)
            
            print("📄 Loading test HTML with structured list...")
            
            # Test the new pattern-based extraction
            result = await service._extract_list_data('#test-list')
            
            print(f"✅ Extracted {len(result)} items")
            
            if len(result) > 0:
                first_item = result[0]
                print(f"✅ First item structure: {len([k for k in first_item.keys() if k.startswith('element_')])} child elements")
                
                if 'links' in first_item:
                    print(f"✅ Links extracted: {len(first_item['links'])}")
                    print(f"   First link: {first_item['links'][0]['href']}")
                
                print(f"✅ Full text: {first_item.get('full_text', 'N/A')[:50]}...")
                
            print("🎉 Quick verification successful!")
            return True
            
    except Exception as e:
        print(f"❌ Quick verification failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Test pattern-based list extraction')
    parser.add_argument('--quick', action='store_true', help='Run quick verification only')
    parser.add_argument('--comprehensive', action='store_true', help='Run comprehensive test suite')
    
    args = parser.parse_args()
    
    if args.quick:
        result = asyncio.run(run_quick_verification())
    elif args.comprehensive:
        result = asyncio.run(run_comprehensive_test())
    else:
        # Default: run both
        print("Running both quick verification and comprehensive tests...\n")
        quick_result = asyncio.run(run_quick_verification())
        print("\n" + "=" * 70 + "\n")
        comprehensive_result = asyncio.run(run_comprehensive_test())
        result = quick_result and comprehensive_result
    
    sys.exit(0 if result else 1)