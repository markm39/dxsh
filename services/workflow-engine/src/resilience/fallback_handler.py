"""
Fallback Handler Module

Provides fallback execution strategies when primary operations fail.
"""

import logging
from typing import Callable, Any, Optional, List, Dict
from enum import Enum
from dataclasses import dataclass
import asyncio

logger = logging.getLogger(__name__)


class FallbackStrategy(Enum):
    """Fallback strategy types."""
    RETURN_DEFAULT = "return_default"
    RETURN_CACHED = "return_cached"
    EXECUTE_ALTERNATIVE = "execute_alternative"
    RETURN_NONE = "return_none"
    RAISE_ERROR = "raise_error"


@dataclass
class FallbackResult:
    """Result of a fallback execution."""
    success: bool
    data: Any
    strategy_used: Optional[FallbackStrategy] = None
    error: Optional[str] = None
    from_cache: bool = False


class FallbackHandler:
    """
    Manages fallback strategies for failed operations.

    Provides various fallback options when primary execution fails.
    """

    def __init__(self, enable_cache: bool = True, cache_ttl_seconds: int = 300):
        """
        Initialize fallback handler.

        Args:
            enable_cache: Whether to enable result caching
            cache_ttl_seconds: Cache TTL in seconds
        """
        self.enable_cache = enable_cache
        self.cache_ttl_seconds = cache_ttl_seconds

        # Simple in-memory cache
        self.cache: Dict[str, Dict[str, Any]] = {}

        logger.info("Fallback handler initialized")

    async def execute_with_fallback(
        self,
        primary_func: Callable,
        *args,
        fallback_strategy: FallbackStrategy = FallbackStrategy.RETURN_NONE,
        fallback_func: Optional[Callable] = None,
        default_value: Any = None,
        cache_key: Optional[str] = None,
        **kwargs
    ) -> FallbackResult:
        """
        Execute function with fallback handling.

        Args:
            primary_func: Primary function to execute
            *args: Function arguments
            fallback_strategy: Strategy to use on failure
            fallback_func: Alternative function for EXECUTE_ALTERNATIVE
            default_value: Default value for RETURN_DEFAULT
            cache_key: Key for caching (for RETURN_CACHED)
            **kwargs: Function keyword arguments

        Returns:
            FallbackResult with execution outcome
        """
        try:
            # Try primary function
            if asyncio.iscoroutinefunction(primary_func):
                result = await primary_func(*args, **kwargs)
            else:
                result = primary_func(*args, **kwargs)

            # Cache successful result if enabled
            if self.enable_cache and cache_key:
                self._cache_result(cache_key, result)

            return FallbackResult(
                success=True,
                data=result,
                strategy_used=None
            )

        except Exception as e:
            logger.warning(f"Primary function failed: {e}. Applying fallback strategy.")
            return await self._apply_fallback(
                error=e,
                fallback_strategy=fallback_strategy,
                fallback_func=fallback_func,
                default_value=default_value,
                cache_key=cache_key,
                args=args,
                kwargs=kwargs
            )

    async def _apply_fallback(
        self,
        error: Exception,
        fallback_strategy: FallbackStrategy,
        fallback_func: Optional[Callable],
        default_value: Any,
        cache_key: Optional[str],
        args: tuple,
        kwargs: dict
    ) -> FallbackResult:
        """
        Apply fallback strategy.

        Args:
            error: The exception that occurred
            fallback_strategy: Strategy to use
            fallback_func: Alternative function
            default_value: Default value
            cache_key: Cache key
            args: Original function args
            kwargs: Original function kwargs

        Returns:
            FallbackResult
        """
        if fallback_strategy == FallbackStrategy.RETURN_DEFAULT:
            logger.info(f"Using fallback: returning default value")
            return FallbackResult(
                success=True,
                data=default_value,
                strategy_used=FallbackStrategy.RETURN_DEFAULT
            )

        elif fallback_strategy == FallbackStrategy.RETURN_CACHED:
            cached_result = self._get_cached_result(cache_key)
            if cached_result is not None:
                logger.info(f"Using fallback: returning cached value")
                return FallbackResult(
                    success=True,
                    data=cached_result,
                    strategy_used=FallbackStrategy.RETURN_CACHED,
                    from_cache=True
                )
            else:
                logger.warning(f"No cached value found, returning None")
                return FallbackResult(
                    success=False,
                    data=None,
                    strategy_used=FallbackStrategy.RETURN_CACHED,
                    error="No cached value available"
                )

        elif fallback_strategy == FallbackStrategy.EXECUTE_ALTERNATIVE:
            if not fallback_func:
                logger.error("No fallback function provided for EXECUTE_ALTERNATIVE")
                return FallbackResult(
                    success=False,
                    data=None,
                    strategy_used=FallbackStrategy.EXECUTE_ALTERNATIVE,
                    error="No fallback function provided"
                )

            try:
                logger.info("Using fallback: executing alternative function")
                if asyncio.iscoroutinefunction(fallback_func):
                    result = await fallback_func(*args, **kwargs)
                else:
                    result = fallback_func(*args, **kwargs)

                return FallbackResult(
                    success=True,
                    data=result,
                    strategy_used=FallbackStrategy.EXECUTE_ALTERNATIVE
                )

            except Exception as fallback_error:
                logger.error(f"Fallback function also failed: {fallback_error}")
                return FallbackResult(
                    success=False,
                    data=None,
                    strategy_used=FallbackStrategy.EXECUTE_ALTERNATIVE,
                    error=str(fallback_error)
                )

        elif fallback_strategy == FallbackStrategy.RETURN_NONE:
            logger.info("Using fallback: returning None")
            return FallbackResult(
                success=True,
                data=None,
                strategy_used=FallbackStrategy.RETURN_NONE
            )

        elif fallback_strategy == FallbackStrategy.RAISE_ERROR:
            logger.error(f"Raising error as per fallback strategy: {error}")
            return FallbackResult(
                success=False,
                data=None,
                strategy_used=FallbackStrategy.RAISE_ERROR,
                error=str(error)
            )

        else:
            logger.error(f"Unknown fallback strategy: {fallback_strategy}")
            return FallbackResult(
                success=False,
                data=None,
                error=f"Unknown fallback strategy: {fallback_strategy}"
            )

    def _cache_result(self, key: str, result: Any):
        """
        Cache a result.

        Args:
            key: Cache key
            result: Result to cache
        """
        import time

        self.cache[key] = {
            'result': result,
            'timestamp': time.time()
        }

        logger.debug(f"Cached result for key: {key}")

    def _get_cached_result(self, key: Optional[str]) -> Optional[Any]:
        """
        Get cached result if available and not expired.

        Args:
            key: Cache key

        Returns:
            Cached result or None
        """
        if not key or not self.enable_cache:
            return None

        if key not in self.cache:
            return None

        import time

        cached = self.cache[key]
        age = time.time() - cached['timestamp']

        if age > self.cache_ttl_seconds:
            # Expired
            del self.cache[key]
            return None

        return cached['result']

    def clear_cache(self, key: Optional[str] = None):
        """
        Clear cache.

        Args:
            key: Specific key to clear, or None to clear all
        """
        if key:
            if key in self.cache:
                del self.cache[key]
                logger.info(f"Cleared cache for key: {key}")
        else:
            self.cache.clear()
            logger.info("Cleared all cache")

    async def execute_with_cascade_fallback(
        self,
        primary_func: Callable,
        *args,
        fallback_functions: List[Callable],
        **kwargs
    ) -> FallbackResult:
        """
        Execute with cascade of fallback functions.

        Tries primary function, then each fallback in order until one succeeds.

        Args:
            primary_func: Primary function
            *args: Function arguments
            fallback_functions: List of fallback functions to try in order
            **kwargs: Function keyword arguments

        Returns:
            FallbackResult
        """
        # Try primary function
        try:
            if asyncio.iscoroutinefunction(primary_func):
                result = await primary_func(*args, **kwargs)
            else:
                result = primary_func(*args, **kwargs)

            return FallbackResult(
                success=True,
                data=result,
                strategy_used=None
            )

        except Exception as e:
            logger.warning(f"Primary function failed: {e}")

        # Try fallback functions in order
        for i, fallback_func in enumerate(fallback_functions):
            try:
                logger.info(f"Trying fallback function {i+1}/{len(fallback_functions)}")

                if asyncio.iscoroutinefunction(fallback_func):
                    result = await fallback_func(*args, **kwargs)
                else:
                    result = fallback_func(*args, **kwargs)

                return FallbackResult(
                    success=True,
                    data=result,
                    strategy_used=FallbackStrategy.EXECUTE_ALTERNATIVE
                )

            except Exception as fallback_error:
                logger.warning(f"Fallback {i+1} failed: {fallback_error}")
                continue

        # All attempts failed
        logger.error("All fallback attempts exhausted")
        return FallbackResult(
            success=False,
            data=None,
            strategy_used=FallbackStrategy.EXECUTE_ALTERNATIVE,
            error="All fallback attempts failed"
        )

    def decorator(
        self,
        fallback_strategy: FallbackStrategy = FallbackStrategy.RETURN_NONE,
        fallback_func: Optional[Callable] = None,
        default_value: Any = None
    ):
        """
        Decorator for adding fallback handling to functions.

        Args:
            fallback_strategy: Strategy to use
            fallback_func: Alternative function
            default_value: Default value

        Returns:
            Decorated function
        """
        def decorator_wrapper(func):
            if asyncio.iscoroutinefunction(func):
                async def async_wrapper(*args, **kwargs):
                    return await self.execute_with_fallback(
                        func,
                        *args,
                        fallback_strategy=fallback_strategy,
                        fallback_func=fallback_func,
                        default_value=default_value,
                        **kwargs
                    )

                return async_wrapper
            else:
                def sync_wrapper(*args, **kwargs):
                    # Convert to async for execute_with_fallback
                    async def async_func(*a, **kw):
                        return func(*a, **kw)

                    loop = asyncio.get_event_loop()
                    return loop.run_until_complete(
                        self.execute_with_fallback(
                            async_func,
                            *args,
                            fallback_strategy=fallback_strategy,
                            fallback_func=fallback_func,
                            default_value=default_value,
                            **kwargs
                        )
                    )

                return sync_wrapper

        return decorator_wrapper

    def get_cache_statistics(self) -> Dict[str, Any]:
        """
        Get cache statistics.

        Returns:
            Statistics dict
        """
        import time

        total_entries = len(self.cache)
        expired_count = 0

        for cached in self.cache.values():
            age = time.time() - cached['timestamp']
            if age > self.cache_ttl_seconds:
                expired_count += 1

        return {
            'total_entries': total_entries,
            'expired_entries': expired_count,
            'active_entries': total_entries - expired_count,
            'cache_enabled': self.enable_cache,
            'ttl_seconds': self.cache_ttl_seconds
        }
