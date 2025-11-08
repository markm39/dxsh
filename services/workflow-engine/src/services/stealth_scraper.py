"""
Advanced stealth web scraping service with anti-detection capabilities.
Enhances PlaywrightService with additional evasion techniques.
"""

import random
import asyncio
import logging
from typing import Dict, List, Optional, Any
from playwright.async_api import Page, Browser
from fake_useragent import UserAgent

logger = logging.getLogger(__name__)


class StealthScraperService:
    """Enhanced scraping service with anti-detection features"""

    def __init__(self):
        self.ua = UserAgent()
        self.fingerprints = self._generate_fingerprints()

    def _generate_fingerprints(self) -> List[Dict[str, Any]]:
        """Generate realistic browser fingerprints"""
        fingerprints = [
            {
                'platform': 'Win32',
                'vendor': 'Google Inc.',
                'renderer': 'ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.1)',
                'hardwareConcurrency': 8,
                'deviceMemory': 8,
                'languages': ['en-US', 'en'],
                'screen': {'width': 1920, 'height': 1080, 'colorDepth': 24}
            },
            {
                'platform': 'MacIntel',
                'vendor': 'Apple Computer, Inc.',
                'renderer': 'Apple GPU',
                'hardwareConcurrency': 8,
                'deviceMemory': 16,
                'languages': ['en-US', 'en'],
                'screen': {'width': 2560, 'height': 1440, 'colorDepth': 24}
            },
            {
                'platform': 'Linux x86_64',
                'vendor': 'Google Inc.',
                'renderer': 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1080, OpenGL 4.5)',
                'hardwareConcurrency': 16,
                'deviceMemory': 32,
                'languages': ['en-US', 'en'],
                'screen': {'width': 1920, 'height': 1080, 'colorDepth': 24}
            }
        ]
        return fingerprints

    async def apply_stealth_mode(self, page: Page) -> None:
        """Apply stealth JavaScript patches to page"""
        await page.add_init_script("""
            // Override navigator properties
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });

            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5]
            });

            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });

            // Override permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );

            // Mock chrome object
            window.chrome = {
                runtime: {}
            };

            // Remove automation indicators
            delete navigator.__proto__.webdriver;
        """)

    async def apply_fingerprint(self, page: Page, fingerprint: Optional[Dict] = None) -> None:
        """Apply browser fingerprint to page"""
        if not fingerprint:
            fingerprint = random.choice(self.fingerprints)

        await page.add_init_script(f"""
            Object.defineProperty(navigator, 'platform', {{
                get: () => '{fingerprint['platform']}'
            }});

            Object.defineProperty(navigator, 'vendor', {{
                get: () => '{fingerprint['vendor']}'
            }});

            Object.defineProperty(navigator, 'hardwareConcurrency', {{
                get: () => {fingerprint['hardwareConcurrency']}
            }});

            Object.defineProperty(navigator, 'deviceMemory', {{
                get: () => {fingerprint['deviceMemory']}
            }});
        """)

    async def add_random_delays(self, min_ms: int = 100, max_ms: int = 500) -> None:
        """Add random human-like delays"""
        delay = random.uniform(min_ms / 1000, max_ms / 1000)
        await asyncio.sleep(delay)

    async def simulate_mouse_movement(self, page: Page) -> None:
        """Simulate realistic mouse movements"""
        viewport = page.viewport_size
        if not viewport:
            viewport = {'width': 1920, 'height': 1080}

        # Generate random path
        num_moves = random.randint(3, 8)
        for _ in range(num_moves):
            x = random.randint(0, viewport['width'])
            y = random.randint(0, viewport['height'])
            await page.mouse.move(x, y)
            await asyncio.sleep(random.uniform(0.05, 0.15))

    async def simulate_scrolling(self, page: Page) -> None:
        """Simulate human-like scrolling behavior"""
        scroll_count = random.randint(2, 5)
        for _ in range(scroll_count):
            # Random scroll distance
            distance = random.randint(200, 600)
            await page.evaluate(f'window.scrollBy(0, {distance})')
            await asyncio.sleep(random.uniform(0.3, 0.8))

        # Scroll back to top
        await page.evaluate('window.scrollTo(0, 0)')
        await asyncio.sleep(random.uniform(0.2, 0.5))

    def get_random_user_agent(self) -> str:
        """Get random but realistic user agent"""
        return self.ua.random

    async def handle_cloudflare_challenge(self, page: Page, timeout: int = 30000) -> bool:
        """Wait for Cloudflare challenge to complete"""
        try:
            # Check for Cloudflare challenge indicators
            cloudflare_selectors = [
                '#cf-challenge-running',
                '.cf-browser-verification',
                '#challenge-running',
                '.ray_id'
            ]

            # Wait for challenge to disappear
            for selector in cloudflare_selectors:
                try:
                    await page.wait_for_selector(
                        selector,
                        state='hidden',
                        timeout=timeout
                    )
                    logger.info("Cloudflare challenge passed")
                    return True
                except Exception:
                    continue

            # Additional wait for page to stabilize
            await asyncio.sleep(2)
            return True

        except Exception as e:
            logger.warning(f"Cloudflare challenge handling failed: {e}")
            return False

    async def check_for_captcha(self, page: Page) -> bool:
        """Check if page contains CAPTCHA"""
        captcha_indicators = [
            'recaptcha',
            'g-recaptcha',
            'h-captcha',
            'captcha',
            'challenge'
        ]

        content = await page.content()
        content_lower = content.lower()

        for indicator in captcha_indicators:
            if indicator in content_lower:
                logger.warning(f"CAPTCHA detected: {indicator}")
                return True

        return False

    async def get_enhanced_context_options(self) -> Dict[str, Any]:
        """Get enhanced browser context options with anti-detection"""
        fingerprint = random.choice(self.fingerprints)

        return {
            'viewport': {
                'width': fingerprint['screen']['width'],
                'height': fingerprint['screen']['height']
            },
            'user_agent': self.get_random_user_agent(),
            'locale': 'en-US',
            'timezone_id': 'America/New_York',
            'permissions': ['geolocation', 'notifications'],
            'geolocation': {
                'latitude': 40.7128,
                'longitude': -74.0060
            },
            'color_scheme': 'light',
            'extra_http_headers': {
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            'java_script_enabled': True,
            'bypass_csp': True,
            'ignore_https_errors': True
        }

    async def setup_request_interception(self, page: Page,
                                        block_resources: Optional[List[str]] = None) -> None:
        """Setup request interception to block unnecessary resources"""
        if block_resources is None:
            block_resources = ['image', 'stylesheet', 'font', 'media']

        async def handle_route(route):
            if route.request.resource_type in block_resources:
                await route.abort()
            else:
                await route.continue_()

        await page.route('**/*', handle_route)

    async def wait_for_stable_network(self, page: Page,
                                      timeout: int = 5000,
                                      max_connections: int = 2) -> None:
        """Wait for network to become stable"""
        try:
            await page.wait_for_load_state('networkidle', timeout=timeout)
        except Exception as e:
            logger.debug(f"Network idle timeout: {e}")
            await asyncio.sleep(2)
