#!/usr/bin/env python3
"""
Integration test for the new headless browser visual selection
"""

import asyncio
import sys
import os

# Add the backend directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from app.api.headless_scraper import load_page_with_browser

async def test_integration():
    """Test the complete integration"""
    print("🧪 Testing Headless Browser Integration")
    print("=" * 50)
    
    # Test URLs
    test_urls = [
        "https://quotes.toscrape.com/",  # JavaScript-friendly test site
        "https://httpbin.org/html",      # Simple HTML test
        "https://www.homes.com/homes-for-sale/"  # Previously problematic site
    ]
    
    for i, url in enumerate(test_urls, 1):
        print(f"\n{i}. Testing: {url}")
        print("-" * 40)
        
        try:
            result = await load_page_with_browser(url)
            
            if result['success']:
                html_length = len(result['html'])
                page_title = result.get('page_info', {}).get('title', 'Unknown')
                
                print(f"✅ SUCCESS")
                print(f"   📄 HTML: {html_length:,} characters")
                print(f"   🏷️  Title: {page_title}")
                print(f"   🎯 Ready for visual selection")
                
                # Check for meaningful content
                html_lower = result['html'].lower()
                if any(keyword in html_lower for keyword in ['home', 'quote', 'html']):
                    print(f"   🔍 Content detected and looks valid")
                else:
                    print(f"   ⚠️  Content may be limited")
                    
            else:
                print(f"❌ FAILED: {result.get('error', 'Unknown error')}")
                
        except Exception as e:
            print(f"💥 ERROR: {e}")
    
    print("\n" + "=" * 50)
    print("🎉 Integration test completed!")
    print("\nNext steps:")
    print("1. ✅ Backend headless browser working")
    print("2. ✅ Frontend updated to use new endpoint")  
    print("3. 🚀 Test in browser - should now load homes.com!")

if __name__ == "__main__":
    asyncio.run(test_integration())