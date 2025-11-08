"""
Unit tests for proxy rotation manager.
"""

import pytest
from src.services.proxy_manager import ProxyManager, ProxyConfig


class TestProxyConfig:
    """Test ProxyConfig dataclass"""

    def test_proxy_url_with_auth(self):
        """Test proxy URL generation with authentication"""
        proxy = ProxyConfig(
            host="proxy.example.com",
            port=8080,
            username="user",
            password="pass",
            protocol="http"
        )

        assert proxy.url == "http://user:pass@proxy.example.com:8080"

    def test_proxy_url_without_auth(self):
        """Test proxy URL generation without authentication"""
        proxy = ProxyConfig(
            host="proxy.example.com",
            port=8080,
            protocol="http"
        )

        assert proxy.url == "http://proxy.example.com:8080"

    def test_success_rate_calculation(self):
        """Test success rate calculation"""
        proxy = ProxyConfig(host="test", port=8080)

        assert proxy.success_rate == 1.0

        proxy.mark_success()
        assert proxy.success_rate == 1.0

        proxy.mark_failure()
        assert proxy.success_rate == 0.5


class TestProxyManager:
    """Test ProxyManager"""

    def test_initialization(self):
        """Test manager initialization"""
        manager = ProxyManager()
        assert len(manager.proxies) == 0

    def test_add_proxy(self):
        """Test adding a proxy"""
        manager = ProxyManager()
        manager.add_proxy("proxy1.com", 8080)

        assert len(manager.proxies) == 1
        assert manager.proxies[0].host == "proxy1.com"
        assert manager.proxies[0].port == 8080

    def test_round_robin_selection(self):
        """Test round-robin proxy selection"""
        manager = ProxyManager()
        manager.add_proxy("proxy1.com", 8080)
        manager.add_proxy("proxy2.com", 8080)

        proxy1 = manager.get_next_proxy(strategy='round_robin')
        proxy2 = manager.get_next_proxy(strategy='round_robin')

        assert proxy1.host == "proxy1.com"
        assert proxy2.host == "proxy2.com"

    def test_proxy_stats(self):
        """Test getting proxy statistics"""
        manager = ProxyManager()
        manager.add_proxy("proxy1.com", 8080)

        stats = manager.get_proxy_stats()

        assert stats['total'] == 1
        assert stats['available'] == 1
        assert 'proxies' in stats
