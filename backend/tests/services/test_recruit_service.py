# tests/services/test_recruit_service.py
import pytest
from app.services.recruit_service import RecruitService

# --- Pure Unit Tests ---

@pytest.mark.parametrize("stars, expected_color", [
    (5, 'blue'),
    (4, 'red'),
    (3, 'orange'),
    (2, 'yellow'),
    (1, '#ccc'),
    (0, '#ccc'),
    (None, '#ccc')
])
def test_get_color_for_stars(stars, expected_color):
    """
    GIVEN a star rating
    WHEN get_color_for_stars is called
    THEN the correct color string is returned
    """
    assert RecruitService.get_color_for_stars(stars) == expected_color


@pytest.mark.parametrize("grade, expected_color", [
    (0.96, 'blue'),
    (0.90, 'red'),
    (0.88, 'red'),
    (0.85, 'red'), # Boundary check
    (0.84, 'orange'),
    (0.70, 'orange'), # Boundary check
    (0.69, 'yellow'),
    (0.50, 'yellow'), # Boundary check
    (0.49, '#ccc'),
    (None, '#ccc')
])
def test_get_color_for_grade(grade, expected_color):
    """
    GIVEN a numeric grade
    WHEN get_color_for_grade is called
    THEN the correct color string is returned
    """
    assert RecruitService.get_color_for_grade(grade) == expected_color
    
# --- Integration Tests using the DB and Factories ---

def test_get_minimal_map_data(db, cfb_recruit_factory):
    """
    GIVEN several recruits in the database
    WHEN get_minimal_map_data is called with filters
    THEN it should return only the matching recruits with correct data.
    """
    # 1. ARRANGE: Create test data using our factory
    # Create recruits that match the filter
    cfb_recruit_factory(position='QB', state_province='TX', name='Texas QB 1')
    cfb_recruit_factory(position='QB', state_province='TX', name='Texas QB 2')
    
    # Create recruits that do NOT match the filter
    cfb_recruit_factory(position='WR', state_province='TX', name='Texas WR')
    cfb_recruit_factory(position='QB', state_province='CA', name='California QB')

    # Create a recruit with no coordinates to ensure it's filtered out
    cfb_recruit_factory(
        position='QB', state_province='TX', name='No-Coord QB',
        hometown_info_latitude=None, hometown_info_longitude=None
    )

    # 2. ACT: Call the service method
    filters = {
        'position': ['QB'],
        'state_province': ['TX']
    }
    result = RecruitService.get_minimal_map_data(
        'cfb_recruit', 
        filters=filters,
        color_by='stars'
    )

    # 3. ASSERT: Check the results
    assert result['success'] is True
    assert result['count'] == 2 # Only 2 recruits should match all criteria

    names = {p['name'] for p in result['data']}
    assert names == {'Texas QB 1', 'Texas QB 2'}

    # Check that a point has the correct structure
    point = result['data'][0]
    assert 'id' in point
    assert 'name' in point
    assert 'lat' in point
    assert 'lon' in point
    assert 'color' in point
    assert point['color'] == 'red' # For 4-star default

def test_get_player_career(db, cbb_recruit_factory):
    """
    GIVEN a CBB recruit in the database
    WHEN get_player_career is called with the recruit's ID
    THEN it should return the full career details
    """
    # 1. ARRANGE
    recruit = cbb_recruit_factory(
        name='Test Player',
        ranking=15,
        committed_to_name='Test University'
    )
    
    # 2. ACT
    result = RecruitService.get_player_career('cbb_recruit', recruit.id)

    # 3. ASSERT
    assert result['success'] is True
    data = result['data']
    assert data['name'] == 'Test Player'
    assert data['ranking'] == 15
    assert data['committedToName'] == 'Test University'