"""
Unit tests for stealth scraping service.
"""

import pytest
from src.services.stealth_scraper import StealthScraperService


class TestStealthScraper:
    """Test StealthScraperService"""

    def test_initialization(self):
        """Test service initialization"""
        scraper = StealthScraperService()
        assert scraper is not None
        assert len(scraper.fingerprints) > 0

    def test_fingerprint_generation(self):
        """Test browser fingerprint generation"""
        scraper = StealthScraperService()
        fingerprints = scraper.fingerprints

        assert len(fingerprints) >= 3
        for fp in fingerprints:
            assert 'platform' in fp
            assert 'vendor' in fp
            assert 'hardwareConcurrency' in fp
            assert 'screen' in fp

    def test_get_random_user_agent(self):
        """Test random user agent generation"""
        scraper = StealthScraperService()
        ua = scraper.get_random_user_agent()

        assert ua is not None
        assert isinstance(ua, str)
        assert len(ua) > 0

    @pytest.mark.asyncio
    async def test_get_enhanced_context_options(self):
        """Test getting enhanced browser context options"""
        scraper = StealthScraperService()
        options = await scraper.get_enhanced_context_options()

        assert 'viewport' in options
        assert 'user_agent' in options
        assert 'extra_http_headers' in options
        assert options['java_script_enabled'] == True
