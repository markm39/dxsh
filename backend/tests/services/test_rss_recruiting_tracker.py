import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime
import json

from app.services.rss_recruiting_tracker import RSSRecruitingTracker
from app.models.hidden_gem import HiddenGem

# This is a sample feed entry that mimics what feedparser would produce for a Twitter RSS feed.
# We will use this as the return value for our mocked feedparser.
FAKE_RSS_ENTRY = {
    'title': 'New Post from @RecruitingGuru',
    'description': "Excited to see 2026 QB John Recruit (@JohnRecruit26) from Anytown High, TX picking up an offer from State University! A real hidden gem with a cannon for an arm.",
    'link': 'http://twitter.com/RecruitingGuru/status/12345',
    'published_parsed': datetime(2025, 7, 15).timetuple(),
    'authors': [{'name': '@RecruitingGuru'}]
}

# This is a sample response from our AI model that we will use to mock the lambda_client.
FAKE_AI_RESPONSE = {
    "is_hidden_gem": True,
    "player": {
        "name": "John Recruit",
        "position": "QB",
        "school": "Anytown High",
        "city": "Anytown",
        "state": "TX",
        "year": "2026",
        "height": "6-3",
        "weight": "205",
        "info": "Picking up an offer from State University!",
        "college_interest": ["State University"],
        "source_type": "offer",
        "gem_rating": 8.0,
        "x_handle": "@JohnRecruit26",
        "reasoning": "Offer from a notable university, identified as a hidden gem."
    }
}


@pytest.fixture
def tracker(app):
    """Provides an instance of RSSRecruitingTracker with a mocked lambda_client."""
    with app.app_context():
        # Create a mock for the lambda_client
        mock_lambda_client = MagicMock()

        # We will configure the mock's return value inside each test
        app.lambda_client = mock_lambda_client

        yield RSSRecruitingTracker()


def test_fetch_rss_content(mocker):
    # 1. ARRANGE
    mock_feed = MagicMock()
    mock_feed.bozo = 0
    
    # Use a simple class that behaves like a feedparser entry
    class MockEntry:
        def __init__(self, data):
            self.__dict__.update(data)
            self._data = data
        
        def get(self, key, default=''):
            return self._data.get(key, default)
        
        def __getitem__(self, key):
            return self._data[key]
    
    entry_data = {
        'title': FAKE_RSS_ENTRY['title'],
        'link': FAKE_RSS_ENTRY['link'],
        'description': FAKE_RSS_ENTRY['description'], 
        'published_parsed': FAKE_RSS_ENTRY['published_parsed'],
        'author': '@RecruitingGuru'
    }
    
    mock_feed.entries = [MockEntry(entry_data)]
    mocker.patch('feedparser.parse', return_value=mock_feed)

    tracker_instance = RSSRecruitingTracker()
    
    # 2. ACT
    posts = tracker_instance.fetch_rss_content('http://fake.rss/feed.xml')

    # 3. ASSERT
    assert len(posts) == 1
    post = posts[0]
    assert post['title'] == FAKE_RSS_ENTRY['title']
    assert post['content'] == FAKE_RSS_ENTRY['description']


def test_analyze_rss_content_for_gems(tracker, app):
    """
    GIVEN a tracker with a mocked AI client
    WHEN analyze_rss_content_for_gems is called with a recruiting post
    THEN it should return structured data for a hidden gem.
    """
    # 1. ARRANGE
    # Configure the mock AI client on the tracker to return our fake AI response
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = json.dumps(FAKE_AI_RESPONSE)
    app.lambda_client.chat.completions.create.return_value = mock_response
    
    # Create a sample content item from our fake RSS entry
    content_item = {
        'content': FAKE_RSS_ENTRY['description'],
        'link': FAKE_RSS_ENTRY['link'],
        'twitter_handle': '@RecruitingGuru'
    }

    # 2. ACT
    result = tracker.analyze_rss_content_for_gems(content_item, sport='football')

    # 3. ASSERT
    assert result is not None
    assert result['name'] == 'John Recruit'
    assert result['position'] == 'QB'
    assert result['x_handle'] == '@JohnRecruit26'
    assert result['source_url'] == FAKE_RSS_ENTRY['link']

    # Check that the AI client was called
    app.lambda_client.chat.completions.create.assert_called_once()


def test_analyze_rss_content_non_recruiting(tracker, app, mocker):
    """
    GIVEN a tracker with a mocked AI client
    WHEN analyze_rss_content_for_gems is called with a non-recruiting post
    THEN it should return None.
    """
    # Mock any filtering methods that might cause early returns
    mocker.patch.object(tracker, 'is_post_about_sport', return_value=True)
    if hasattr(tracker, '_contains_recruiting_keywords'):
        mocker.patch.object(tracker, '_contains_recruiting_keywords', return_value=True)
    if hasattr(tracker, '_is_recruiting_content'):
        mocker.patch.object(tracker, '_is_recruiting_content', return_value=True)
    
    # 1. ARRANGE
    # Configure the mock AI client to return a "not a gem" response
    fake_non_gem_response = {"is_hidden_gem": False, "reason": "Just a game score update."}
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = json.dumps(fake_non_gem_response)
    app.lambda_client.chat.completions.create.return_value = mock_response

    content_item = {
        'content': 'Final score: Team A 24, Team B 21 with recruit mention.', 
        'link': 'http://a.b/c',
        'twitter_handle': '@TestHandle'
    }

    # 2. ACT
    result = tracker.analyze_rss_content_for_gems(content_item, sport='football')

    # 3. ASSERT
    assert result is None
    app.lambda_client.chat.completions.create.assert_called_once()


@patch('app.services.rss_recruiting_tracker.RSSRecruitingTracker.fetch_rss_content')
@patch('app.services.rss_recruiting_tracker.RSSRecruitingTracker.analyze_rss_content_for_gems')
def test_monitor_rss_feeds_integration(mock_analyze, mock_fetch, tracker, db):
    # Mock to return exactly one content item from one feed
    mock_fetch.return_value = [{'content': 'A post about a recruit', 'link': 'http://a.b/c'}]
    
    # Mock to return a gem only on the first call, None afterwards
    mock_analyze.side_effect = [FAKE_AI_RESPONSE['player']] + [None] * 100
    
    # Patch the feeds config to return only one feed
    with patch.object(tracker, 'get_rss_feeds_config') as mock_config:
        mock_config.return_value = {
            'football': ['http://test-feed.xml']  # Only one feed
        }
        
        result = tracker.monitor_rss_feeds(hours_back=1)
    
    assert result['success'] is True
    assert result['gems_found'] == 1
