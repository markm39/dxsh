"""
Circuit Breaker Module

Implements circuit breaker pattern using pybreaker for fault tolerance.
"""

import logging
from typing import Callable, Any, Optional, Dict
from enum import Enum
from datetime import datetime
from pybreaker import CircuitBreaker, CircuitBreakerError
import asyncio

logger = logging.getLogger(__name__)


class CircuitBreakerState(Enum):
    """Circuit breaker states."""
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreakerManager:
    """
    Manages circuit breakers for different services/endpoints.

    Prevents cascading failures by failing fast when services are down.
    """

    def __init__(
        self,
        fail_max: int = 5,
        timeout_duration: int = 60,
        expected_exception: type = Exception
    ):
        """
        Initialize circuit breaker manager.

        Args:
            fail_max: Number of failures before opening circuit
            timeout_duration: Seconds to wait before trying again
            expected_exception: Exception type that triggers circuit
        """
        self.fail_max = fail_max
        self.timeout_duration = timeout_duration
        self.expected_exception = expected_exception

        # Circuit breakers by name
        self.breakers: Dict[str, CircuitBreaker] = {}

        logger.info(
            f"Circuit breaker manager initialized - "
            f"fail_max: {fail_max}, timeout: {timeout_duration}s"
        )

    def get_breaker(self, name: str) -> CircuitBreaker:
        """
        Get or create a circuit breaker.

        Args:
            name: Circuit breaker name (e.g., service name)

        Returns:
            CircuitBreaker instance
        """
        if name not in self.breakers:
            self.breakers[name] = CircuitBreaker(
                fail_max=self.fail_max,
                timeout_duration=self.timeout_duration,
                expected_exception=self.expected_exception,
                name=name,
                listeners=[self._create_listener(name)]
            )
            logger.info(f"Created circuit breaker: {name}")

        return self.breakers[name]

    def _create_listener(self, name: str):
        """
        Create a listener for circuit breaker state changes.

        Args:
            name: Circuit breaker name

        Returns:
            Listener object
        """
        class CircuitBreakerListener:
            def state_change(self, cb, old_state, new_state):
                logger.warning(
                    f"Circuit breaker '{name}' state changed: "
                    f"{old_state.name} -> {new_state.name}"
                )

            def before_call(self, cb, func, *args, **kwargs):
                logger.debug(f"Circuit breaker '{name}' calling function")

            def failure(self, cb, exc):
                logger.error(
                    f"Circuit breaker '{name}' recorded failure: {exc}"
                )

            def success(self, cb):
                logger.debug(f"Circuit breaker '{name}' recorded success")

        return CircuitBreakerListener()

    async def call_async(
        self,
        name: str,
        func: Callable,
        *args,
        fallback: Optional[Callable] = None,
        **kwargs
    ) -> Any:
        """
        Call an async function through circuit breaker.

        Args:
            name: Circuit breaker name
            func: Async function to call
            *args: Function arguments
            fallback: Optional fallback function if circuit is open
            **kwargs: Function keyword arguments

        Returns:
            Function result or fallback result

        Raises:
            CircuitBreakerError: If circuit is open and no fallback
        """
        breaker = self.get_breaker(name)

        try:
            # Wrap async function for circuit breaker
            @breaker
            async def wrapped():
                return await func(*args, **kwargs)

            return await wrapped()

        except CircuitBreakerError as e:
            logger.error(
                f"Circuit breaker '{name}' is open: {e}"
            )

            if fallback:
                logger.info(f"Executing fallback for '{name}'")
                if asyncio.iscoroutinefunction(fallback):
                    return await fallback(*args, **kwargs)
                else:
                    return fallback(*args, **kwargs)

            raise

    def call_sync(
        self,
        name: str,
        func: Callable,
        *args,
        fallback: Optional[Callable] = None,
        **kwargs
    ) -> Any:
        """
        Call a sync function through circuit breaker.

        Args:
            name: Circuit breaker name
            func: Function to call
            *args: Function arguments
            fallback: Optional fallback function if circuit is open
            **kwargs: Function keyword arguments

        Returns:
            Function result or fallback result

        Raises:
            CircuitBreakerError: If circuit is open and no fallback
        """
        breaker = self.get_breaker(name)

        try:
            @breaker
            def wrapped():
                return func(*args, **kwargs)

            return wrapped()

        except CircuitBreakerError as e:
            logger.error(
                f"Circuit breaker '{name}' is open: {e}"
            )

            if fallback:
                logger.info(f"Executing fallback for '{name}'")
                return fallback(*args, **kwargs)

            raise

    def decorator(self, name: str, fallback: Optional[Callable] = None):
        """
        Decorator for protecting functions with circuit breaker.

        Args:
            name: Circuit breaker name
            fallback: Optional fallback function

        Returns:
            Decorated function
        """
        breaker = self.get_breaker(name)

        def decorator_wrapper(func):
            if asyncio.iscoroutinefunction(func):
                async def async_wrapper(*args, **kwargs):
                    try:
                        @breaker
                        async def wrapped():
                            return await func(*args, **kwargs)

                        return await wrapped()

                    except CircuitBreakerError as e:
                        logger.error(f"Circuit breaker '{name}' is open")

                        if fallback:
                            if asyncio.iscoroutinefunction(fallback):
                                return await fallback(*args, **kwargs)
                            else:
                                return fallback(*args, **kwargs)

                        raise

                return async_wrapper
            else:
                def sync_wrapper(*args, **kwargs):
                    try:
                        @breaker
                        def wrapped():
                            return func(*args, **kwargs)

                        return wrapped()

                    except CircuitBreakerError as e:
                        logger.error(f"Circuit breaker '{name}' is open")

                        if fallback:
                            return fallback(*args, **kwargs)

                        raise

                return sync_wrapper

        return decorator_wrapper

    def get_state(self, name: str) -> Optional[CircuitBreakerState]:
        """
        Get current state of a circuit breaker.

        Args:
            name: Circuit breaker name

        Returns:
            Current state or None if breaker doesn't exist
        """
        if name not in self.breakers:
            return None

        breaker = self.breakers[name]
        state_name = breaker.current_state.name.lower()

        return CircuitBreakerState(state_name)

    def reset(self, name: str) -> bool:
        """
        Reset a circuit breaker to closed state.

        Args:
            name: Circuit breaker name

        Returns:
            True if reset successful
        """
        if name not in self.breakers:
            logger.warning(f"Circuit breaker '{name}' not found")
            return False

        try:
            breaker = self.breakers[name]

            # Close the circuit breaker
            if hasattr(breaker, '_state_storage'):
                breaker._state_storage.state = breaker._state_storage.STATE_CLOSED
                breaker._state_storage.counter = 0

            logger.info(f"Reset circuit breaker '{name}'")
            return True

        except Exception as e:
            logger.error(f"Failed to reset circuit breaker '{name}': {e}")
            return False

    def get_statistics(self, name: Optional[str] = None) -> Dict[str, Any]:
        """
        Get statistics for circuit breakers.

        Args:
            name: Optional specific circuit breaker name

        Returns:
            Statistics dict
        """
        if name:
            if name not in self.breakers:
                return {}

            breaker = self.breakers[name]
            return {
                'name': name,
                'state': breaker.current_state.name.lower(),
                'fail_counter': breaker.fail_counter,
                'fail_max': self.fail_max,
                'timeout_duration': self.timeout_duration
            }

        # Return stats for all breakers
        stats = {
            'total_breakers': len(self.breakers),
            'breakers': {}
        }

        for breaker_name, breaker in self.breakers.items():
            stats['breakers'][breaker_name] = {
                'state': breaker.current_state.name.lower(),
                'fail_counter': breaker.fail_counter,
                'fail_max': self.fail_max
            }

        return stats

    def get_all_states(self) -> Dict[str, str]:
        """
        Get states of all circuit breakers.

        Returns:
            Dict mapping breaker names to states
        """
        return {
            name: breaker.current_state.name.lower()
            for name, breaker in self.breakers.items()
        }

    def close(self, name: str) -> bool:
        """
        Manually close a circuit breaker.

        Args:
            name: Circuit breaker name

        Returns:
            True if successful
        """
        return self.reset(name)

    def open(self, name: str) -> bool:
        """
        Manually open a circuit breaker.

        Args:
            name: Circuit breaker name

        Returns:
            True if successful
        """
        if name not in self.breakers:
            logger.warning(f"Circuit breaker '{name}' not found")
            return False

        try:
            breaker = self.breakers[name]

            # Open the circuit breaker by setting fail counter to max
            if hasattr(breaker, '_state_storage'):
                breaker._state_storage.state = breaker._state_storage.STATE_OPEN
                breaker._state_storage.opened_at = datetime.utcnow()

            logger.info(f"Manually opened circuit breaker '{name}'")
            return True

        except Exception as e:
            logger.error(f"Failed to open circuit breaker '{name}': {e}")
            return False
