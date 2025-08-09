"""
Integration test for on3.com-style list extraction with comma separation
"""
import pytest
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.services.playwright_service import PlaywrightService


@pytest.mark.asyncio
async def test_on3_style_list_extraction():
    """Test extraction of on3.com-style player ranking lists"""
    
    # Create test HTML similar to on3.com structure
    test_html = """
    <html>
    <body>
        <ol class="rankings">
            <li class="NilRankingsPageComponent_nilRankingsItem__MBIiG">
                <div class="NilPlayerRankingItem_itemContainer__JO4vA">
                    <span class="NilPlayerRankingItem_playerRank__qvvJP">1</span>
                    <div class="NilPlayerRankingItem_sportWrapper__pUp4G">
                        <svg class="NilPlayerRankingItem_sportIcon__YIaUz">
                            <style>.sports-football_svg__st0{fill:#a1b1c8;transform:rotate(90deg);transform-origin:center}</style>
                        </svg>
                        <span class="NilPlayerRankingItem_position__szofU">OT</span>
                    </div>
                    <img alt="Default Avatar" src="avatar.jpg" />
                    <div class="NilPlayerRankingItem_name__FU_w4">
                        <a href="/player/jackson-cantwell/">Jackson Cantwell</a>
                    </div>
                    <div class="NilPlayerRankingItem_details__gs5Kt">
                        <span class="NilPlayerRankingItem_classYear__PtNTZ">2026/</span>
                        <span>6-7.5/</span>
                        <span>315</span>
                    </div>
                    <div class="NilPlayerRankingItem_hometownContainer__fVTwT">
                        <a class="NilPlayerRankingItem_highSchool__9YfhQ" href="/high-school/nixa/">Nixa</a>
                        <span>(Nixa, MO)</span>
                    </div>
                    <div class="NilPlayerRankingItem_ratingWrapper__PzwoI">
                        <span class="StarRating_overallRating__wz9dE">98.55</span>
                    </div>
                    <div class="NilPlayerRankingItem_rankingsWrapper__auJlX">
                        <span class="NilPlayerRankingItem_rankItem__1uamm">
                            <span>3</span>
                            <span>Natl.</span>
                        </span>
                        <span class="NilPlayerRankingItem_rankItem__1uamm">
                            <span>1</span>
                            <span>Pos.</span>
                        </span>
                        <span class="NilPlayerRankingItem_rankItem__1uamm">
                            <span>1</span>
                            <span>St.</span>
                        </span>
                    </div>
                    <div class="NilPlayerRankingItem_statusWrapper__UW3oo">
                        <span class="NilPlayerRankingItem_statusText__MvEIW">Commit</span>
                    </div>
                    <div class="NilPlayerRankingItem_valuationWrapper__hFFHr">
                        <span class="NilPlayerRankingItem_valuationCurrency__07B4a">$1.9M</span>
                    </div>
                    <div class="NilPlayerRankingItem_socialWrapper__ptaUr">
                        <span class="NilPlayerRankingItem_socialItemText__loUwI">8.1K</span>
                        <span class="NilPlayerRankingItem_socialItemText__loUwI">6.8K</span>
                    </div>
                    <div class="VerifiedEliteAthlete_block__Pl39l">
                        <span>Elite</span>
                    </div>
                </div>
            </li>
        </ol>
    </body>
    </html>
    """
    
    # Save test HTML
    test_file = Path("/tmp/test_on3_extraction.html")
    test_file.write_text(test_html)
    
    service = PlaywrightService()
    try:
        await service.initialize()
        await service.load_page(f"file://{test_file}")
        
        # Extract list data
        results = await service.extract_all_content([{"selector": ".rankings", "label": "rankings"}])
        
        assert results is not None
        assert len(results) > 0
        
        # Check the first item
        item = results[0]
        print(f"\nExtracted full_text: {item.get('full_text', '')}")
        
        # Verify comma separation
        full_text = item.get('full_text', '')
        assert ', ' in full_text, "Text should be separated with commas"
        
        # Check for expected content pieces
        expected_pieces = ['1', 'OT', 'Jackson Cantwell', '2026/', '6-7.5/', '315', 
                          'Nixa', '(Nixa, MO)', '98.55', '3', 'Natl.', '1', 'Pos.', 
                          '1', 'St.', 'Commit', '$1.9M', '8.1K', '6.8K', 'Elite']
        
        # Count how many expected pieces are in the text
        found_pieces = sum(1 for piece in expected_pieces if piece in full_text)
        print(f"Found {found_pieces}/{len(expected_pieces)} expected pieces")
        
        # Should find most pieces (allowing for some formatting differences)
        assert found_pieces >= 15, f"Should find at least 15 pieces, found {found_pieces}"
        
        # Verify significant comma separation
        comma_count = full_text.count(', ')
        print(f"Comma count: {comma_count}")
        assert comma_count >= 10, f"Should have at least 10 commas, found {comma_count}"
        
    finally:
        await service.cleanup()
        # Clean up
        if test_file.exists():
            test_file.unlink()


if __name__ == "__main__":
    asyncio.run(test_on3_style_list_extraction())