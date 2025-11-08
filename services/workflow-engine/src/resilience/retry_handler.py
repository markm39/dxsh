"""
Retry Handler Module

Provides configurable retry logic with exponential backoff using tenacity.
"""

import logging
from typing import Callable, Any, Optional, List, Type
from dataclasses import dataclass
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
    after_log,
    RetryError
)
import asyncio

logger = logging.getLogger(__name__)


@dataclass
class RetryConfig:
    """Configuration for retry behavior."""
    max_attempts: int = 3
    min_wait_seconds: float = 1.0
    max_wait_seconds: float = 60.0
    exponential_multiplier: float = 2.0
    retry_on_exceptions: Optional[List[Type[Exception]]] = None
    retry_on_status_codes: Optional[List[int]] = None


class RetryHandler:
    """
    Handles retry logic with exponential backoff.

    Supports both sync and async functions with configurable retry strategies.
    """

    def __init__(self, config: Optional[RetryConfig] = None):
        """
        Initialize retry handler.

        Args:
            config: Retry configuration (uses defaults if None)
        """
        self.config = config or RetryConfig()

        # Default exceptions to retry on
        self.default_retry_exceptions = (
            ConnectionError,
            TimeoutError,
            OSError
        )

    def with_retry(self, func: Callable, *args, **kwargs) -> Any:
        """
        Execute a function with retry logic (sync).

        Args:
            func: Function to execute
            *args: Function arguments
            **kwargs: Function keyword arguments

        Returns:
            Function result

        Raises:
            RetryError: If all retries exhausted
        """
        retry_exceptions = tuple(
            self.config.retry_on_exceptions or self.default_retry_exceptions
        )

        @retry(
            stop=stop_after_attempt(self.config.max_attempts),
            wait=wait_exponential(
                multiplier=self.config.exponential_multiplier,
                min=self.config.min_wait_seconds,
                max=self.config.max_wait_seconds
            ),
            retry=retry_if_exception_type(retry_exceptions),
            before_sleep=before_sleep_log(logger, logging.WARNING),
            after=after_log(logger, logging.INFO)
        )
        def _wrapped():
            return func(*args, **kwargs)

        try:
            return _wrapped()
        except RetryError as e:
            logger.error(f"All retry attempts exhausted: {e}")
            raise

    async def with_retry_async(
        self,
        func: Callable,
        *args,
        **kwargs
    ) -> Any:
        """
        Execute an async function with retry logic.

        Args:
            func: Async function to execute
            *args: Function arguments
            **kwargs: Function keyword arguments

        Returns:
            Function result

        Raises:
            RetryError: If all retries exhausted
        """
        retry_exceptions = tuple(
            self.config.retry_on_exceptions or self.default_retry_exceptions
        )

        @retry(
            stop=stop_after_attempt(self.config.max_attempts),
            wait=wait_exponential(
                multiplier=self.config.exponential_multiplier,
                min=self.config.min_wait_seconds,
                max=self.config.max_wait_seconds
            ),
            retry=retry_if_exception_type(retry_exceptions),
            before_sleep=before_sleep_log(logger, logging.WARNING),
            after=after_log(logger, logging.INFO)
        )
        async def _wrapped():
            return await func(*args, **kwargs)

        try:
            return await _wrapped()
        except RetryError as e:
            logger.error(f"All retry attempts exhausted: {e}")
            raise

    def decorator(self, **retry_kwargs):
        """
        Decorator for adding retry logic to functions.

        Args:
            **retry_kwargs: Override retry configuration

        Returns:
            Decorated function
        """
        config = RetryConfig(**retry_kwargs) if retry_kwargs else self.config

        retry_exceptions = tuple(
            config.retry_on_exceptions or self.default_retry_exceptions
        )

        def decorator_wrapper(func):
            if asyncio.iscoroutinefunction(func):
                @retry(
                    stop=stop_after_attempt(config.max_attempts),
                    wait=wait_exponential(
                        multiplier=config.exponential_multiplier,
                        min=config.min_wait_seconds,
                        max=config.max_wait_seconds
                    ),
                    retry=retry_if_exception_type(retry_exceptions),
                    before_sleep=before_sleep_log(logger, logging.WARNING),
                    after=after_log(logger, logging.INFO)
                )
                async def async_wrapper(*args, **kwargs):
                    return await func(*args, **kwargs)

                return async_wrapper
            else:
                @retry(
                    stop=stop_after_attempt(config.max_attempts),
                    wait=wait_exponential(
                        multiplier=config.exponential_multiplier,
                        min=config.min_wait_seconds,
                        max=config.max_wait_seconds
                    ),
                    retry=retry_if_exception_type(retry_exceptions),
                    before_sleep=before_sleep_log(logger, logging.WARNING),
                    after=after_log(logger, logging.INFO)
                )
                def sync_wrapper(*args, **kwargs):
                    return func(*args, **kwargs)

                return sync_wrapper

        return decorator_wrapper

    async def execute_with_retry(
        self,
        func: Callable,
        *args,
        on_retry: Optional[Callable] = None,
        **kwargs
    ) -> Any:
        """
        Execute function with retry and custom retry callback.

        Args:
            func: Function to execute
            *args: Function arguments
            on_retry: Optional callback called before each retry
            **kwargs: Function keyword arguments

        Returns:
            Function result
        """
        retry_exceptions = tuple(
            self.config.retry_on_exceptions or self.default_retry_exceptions
        )

        attempt = 0
        last_exception = None

        while attempt < self.config.max_attempts:
            try:
                if asyncio.iscoroutinefunction(func):
                    return await func(*args, **kwargs)
                else:
                    return func(*args, **kwargs)

            except retry_exceptions as e:
                attempt += 1
                last_exception = e

                if attempt >= self.config.max_attempts:
                    logger.error(
                        f"Max retry attempts ({self.config.max_attempts}) reached"
                    )
                    raise

                # Calculate wait time
                wait_time = min(
                    self.config.min_wait_seconds * (
                        self.config.exponential_multiplier ** (attempt - 1)
                    ),
                    self.config.max_wait_seconds
                )

                logger.warning(
                    f"Attempt {attempt} failed: {str(e)}. "
                    f"Retrying in {wait_time:.2f}s..."
                )

                # Call retry callback if provided
                if on_retry:
                    if asyncio.iscoroutinefunction(on_retry):
                        await on_retry(attempt, e, wait_time)
                    else:
                        on_retry(attempt, e, wait_time)

                # Wait before retry
                await asyncio.sleep(wait_time)

        if last_exception:
            raise last_exception

    def should_retry_http_status(self, status_code: int) -> bool:
        """
        Check if HTTP status code should trigger retry.

        Args:
            status_code: HTTP status code

        Returns:
            True if should retry
        """
        if self.config.retry_on_status_codes:
            return status_code in self.config.retry_on_status_codes

        # Default retry on 5xx and specific 4xx codes
        return status_code >= 500 or status_code in [408, 429]

    def create_custom_retry(
        self,
        max_attempts: int = 3,
        min_wait: float = 1.0,
        max_wait: float = 60.0,
        exceptions: Optional[List[Type[Exception]]] = None
    ):
        """
        Create a custom retry decorator.

        Args:
            max_attempts: Maximum retry attempts
            min_wait: Minimum wait time in seconds
            max_wait: Maximum wait time in seconds
            exceptions: Exceptions to retry on

        Returns:
            Retry decorator
        """
        retry_exceptions = tuple(exceptions or self.default_retry_exceptions)

        return retry(
            stop=stop_after_attempt(max_attempts),
            wait=wait_exponential(
                multiplier=self.config.exponential_multiplier,
                min=min_wait,
                max=max_wait
            ),
            retry=retry_if_exception_type(retry_exceptions),
            before_sleep=before_sleep_log(logger, logging.WARNING),
            after=after_log(logger, logging.INFO)
        )
