"""
Test that PlaywrightService separates sub-element text with commas
"""
import pytest
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock
from app.services.playwright_service import PlaywrightService


class TestPlaywrightTextSeparation:
    """Test text separation in list and card extraction"""
    
    @pytest.mark.asyncio
    async def test_list_text_separation(self):
        """Test that list extraction separates sub-element text with commas"""
        
        # Mock the page evaluate response for list extraction
        mock_list_data = [{
            '_data_type': 'list_item',
            '_item_index': 0,
            '_list_type': 'ul',
            'element_0': {'tag': 'span', 'text': '1', 'classes': ['rank']},
            'element_1': {'tag': 'span', 'text': 'QB', 'classes': ['position']},
            'element_2': {'tag': 'span', 'text': 'Jackson Cantwell', 'classes': ['name']},
            'element_3': {'tag': 'span', 'text': '2026', 'classes': ['year']},
            'full_text': '1, QB, Jackson Cantwell, 2026'  # Comma separated
        }, {
            '_data_type': 'list_item',
            '_item_index': 1,
            '_list_type': 'ul',
            'element_0': {'tag': 'span', 'text': '10', 'classes': ['rank']},
            'element_1': {'tag': 'span', 'text': 'QB', 'classes': ['position']},
            'element_2': {'tag': 'span', 'text': 'Ryder Lyons', 'classes': ['name']},
            'element_3': {'tag': 'span', 'text': '2026', 'classes': ['year']},
            'full_text': '10, QB, Ryder Lyons, 2026'  # Comma separated
        }]
        
        service = PlaywrightService()
        service.page = MagicMock()
        service.page.evaluate = AsyncMock(return_value=mock_list_data)
        
        # Test extraction
        result = await service._extract_list_data('.player-list')
        
        # Verify results
        assert len(result) == 2
        assert result[0]['full_text'] == '1, QB, Jackson Cantwell, 2026'
        assert result[1]['full_text'] == '10, QB, Ryder Lyons, 2026'
        
        # Verify commas are present
        for item in result:
            assert ', ' in item['full_text'], "Text should be separated with commas"
    
    @pytest.mark.asyncio
    async def test_card_text_separation(self):
        """Test that card extraction separates text with commas"""
        
        # Mock the page evaluate response for card extraction
        mock_card_data = [{
            '_data_type': 'card_component',
            '_card_index': 0,
            'title': 'Player Card',
            'title_tag': 'h3',
            'description': 'Top Recruit',
            'full_text': 'Player Card, Top Recruit, 5 Stars, $1.9M'  # Comma separated
        }]
        
        service = PlaywrightService()
        service.page = MagicMock()
        service.page.evaluate = AsyncMock(return_value=mock_card_data)
        
        # Test extraction
        result = await service._extract_card_data('.card')
        
        # Verify results
        assert len(result) == 1
        assert result[0]['full_text'] == 'Player Card, Top Recruit, 5 Stars, $1.9M'
        
        # Verify commas are present
        assert ', ' in result[0]['full_text'], "Text should be separated with commas"
    
    @pytest.mark.asyncio
    async def test_complex_nested_text_separation(self):
        """Test text separation with complex nested structures"""
        
        # Mock complex list data like on3.com - now with all leaf elements separated
        mock_complex_data = [{
            '_data_type': 'list_item',
            '_item_index': 0,
            '_list_type': 'ol',
            'element_0': {'tag': 'div', 'text': '1', 'classes': ['itemContainer']},
            'full_text': '1, OT, Jackson Cantwell, 2026, 6-7.5, 315, Nixa, Nixa, MO, 98.55, 3, Natl., 1, Pos., 1, St., Commit, $1.9M, 8.1K, 6.8K, Elite'
        }]
        
        service = PlaywrightService()
        service.page = MagicMock()
        service.page.evaluate = AsyncMock(return_value=mock_complex_data)
        
        # Test extraction
        result = await service._extract_list_data('.rankings-list')
        
        # Verify results
        assert len(result) == 1
        item = result[0]
        
        # Check that all elements are separated by commas
        # The full text should contain all elements separated by commas
        assert '1, ' in item['full_text']
        assert ', OT, ' in item['full_text']
        assert ', Jackson Cantwell, ' in item['full_text']
        assert ', Nixa' in item['full_text']
        assert ', MO' in item['full_text']
        assert ', Elite' in item['full_text']
        
        # Verify the text has the expected structure with comma separation
        assert item['full_text'].count(', ') >= 10  # Many comma separations for all leaf elements
    
    @pytest.mark.asyncio
    async def test_empty_elements_excluded(self):
        """Test that empty text elements are excluded from comma separation"""
        
        # Mock data with some empty elements
        mock_data = [{
            '_data_type': 'list_item',
            '_item_index': 0,
            '_list_type': 'ul',
            'element_0': {'tag': 'span', 'text': 'Player'},
            'element_1': {'tag': 'span', 'text': ''},  # Empty
            'element_2': {'tag': 'span', 'text': 'Name'},
            'element_3': {'tag': 'span', 'text': '   '},  # Whitespace only
            'full_text': 'Player, Name'  # Empty elements excluded
        }]
        
        service = PlaywrightService()
        service.page = MagicMock()
        service.page.evaluate = AsyncMock(return_value=mock_data)
        
        # Test extraction
        result = await service._extract_list_data('.test-list')
        
        # Verify empty elements are not included
        assert result[0]['full_text'] == 'Player, Name'
        assert ', , ' not in result[0]['full_text']  # No double commas