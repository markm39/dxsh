"""
Proxy rotation and management service for distributed scraping.
"""

import random
import logging
from typing import List, Dict, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


@dataclass
class ProxyConfig:
    """Proxy configuration"""
    host: str
    port: int
    username: Optional[str] = None
    password: Optional[str] = None
    protocol: str = 'http'
    country: Optional[str] = None
    success_count: int = 0
    failure_count: int = 0
    last_used: Optional[datetime] = None

    @property
    def url(self) -> str:
        """Get proxy URL"""
        if self.username and self.password:
            return f"{self.protocol}://{self.username}:{self.password}@{self.host}:{self.port}"
        return f"{self.protocol}://{self.host}:{self.port}"

    @property
    def success_rate(self) -> float:
        """Calculate success rate"""
        total = self.success_count + self.failure_count
        if total == 0:
            return 1.0
        return self.success_count / total

    def mark_success(self) -> None:
        """Mark proxy as successful"""
        self.success_count += 1
        self.last_used = datetime.now()

    def mark_failure(self) -> None:
        """Mark proxy as failed"""
        self.failure_count += 1
        self.last_used = datetime.now()


class ProxyManager:
    """Manage proxy rotation and selection"""

    def __init__(self):
        self.proxies: List[ProxyConfig] = []
        self.current_index = 0
        self.min_success_rate = 0.3
        self.cooldown_period = timedelta(minutes=5)

    def add_proxy(self, host: str, port: int,
                  username: Optional[str] = None,
                  password: Optional[str] = None,
                  protocol: str = 'http',
                  country: Optional[str] = None) -> None:
        """Add a proxy to the rotation pool"""
        proxy = ProxyConfig(
            host=host,
            port=port,
            username=username,
            password=password,
            protocol=protocol,
            country=country
        )
        self.proxies.append(proxy)
        logger.info(f"Added proxy: {host}:{port}")

    def add_proxies_from_list(self, proxy_list: List[Dict]) -> None:
        """Add multiple proxies from list"""
        for proxy_data in proxy_list:
            self.add_proxy(**proxy_data)

    def get_next_proxy(self, strategy: str = 'round_robin') -> Optional[ProxyConfig]:
        """Get next proxy based on strategy"""
        if not self.proxies:
            return None

        available_proxies = self._get_available_proxies()
        if not available_proxies:
            logger.warning("No available proxies, using any proxy")
            available_proxies = self.proxies

        if strategy == 'round_robin':
            return self._round_robin_select(available_proxies)
        elif strategy == 'random':
            return random.choice(available_proxies)
        elif strategy == 'best':
            return self._best_performing_select(available_proxies)
        else:
            return self._round_robin_select(available_proxies)

    def _get_available_proxies(self) -> List[ProxyConfig]:
        """Get proxies that are available (not in cooldown, good success rate)"""
        now = datetime.now()
        available = []

        for proxy in self.proxies:
            # Check success rate
            if proxy.success_rate < self.min_success_rate and proxy.failure_count > 5:
                continue

            # Check cooldown
            if proxy.last_used:
                time_since_use = now - proxy.last_used
                if proxy.success_rate < 0.5 and time_since_use < self.cooldown_period:
                    continue

            available.append(proxy)

        return available

    def _round_robin_select(self, proxies: List[ProxyConfig]) -> ProxyConfig:
        """Round-robin selection"""
        if self.current_index >= len(proxies):
            self.current_index = 0

        proxy = proxies[self.current_index]
        self.current_index += 1
        return proxy

    def _best_performing_select(self, proxies: List[ProxyConfig]) -> ProxyConfig:
        """Select best performing proxy"""
        return max(proxies, key=lambda p: p.success_rate)

    def get_proxy_by_country(self, country: str) -> Optional[ProxyConfig]:
        """Get proxy from specific country"""
        country_proxies = [p for p in self.proxies if p.country == country]
        if not country_proxies:
            return None
        return random.choice(country_proxies)

    def mark_proxy_result(self, proxy: ProxyConfig, success: bool) -> None:
        """Mark result of proxy usage"""
        if success:
            proxy.mark_success()
            logger.debug(f"Proxy {proxy.host} success rate: {proxy.success_rate:.2f}")
        else:
            proxy.mark_failure()
            logger.warning(f"Proxy {proxy.host} failed. Success rate: {proxy.success_rate:.2f}")

    def get_proxy_stats(self) -> Dict:
        """Get statistics about proxy pool"""
        if not self.proxies:
            return {'total': 0, 'available': 0, 'avg_success_rate': 0}

        available = self._get_available_proxies()
        total_success_rate = sum(p.success_rate for p in self.proxies)

        return {
            'total': len(self.proxies),
            'available': len(available),
            'avg_success_rate': total_success_rate / len(self.proxies),
            'proxies': [
                {
                    'host': p.host,
                    'port': p.port,
                    'success_rate': p.success_rate,
                    'total_requests': p.success_count + p.failure_count
                }
                for p in self.proxies
            ]
        }

    def remove_failing_proxies(self, min_requests: int = 10) -> int:
        """Remove proxies with poor performance"""
        removed = 0
        self.proxies = [
            p for p in self.proxies
            if not (
                (p.success_count + p.failure_count > min_requests) and
                (p.success_rate < self.min_success_rate)
            )
        ]

        if removed > 0:
            logger.info(f"Removed {removed} failing proxies")

        return removed

    def reset_stats(self) -> None:
        """Reset all proxy statistics"""
        for proxy in self.proxies:
            proxy.success_count = 0
            proxy.failure_count = 0
            proxy.last_used = None

        logger.info("Reset all proxy statistics")
