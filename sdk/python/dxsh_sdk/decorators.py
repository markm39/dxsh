"""
Decorators Module

Decorators for node input/output and registration.
"""

from typing import Callable, Dict, Any, Optional
from functools import wraps
import inspect


def node(
    node_type: str,
    name: str,
    description: str = "",
    category: str = "custom"
):
    """
    Decorator to register a function as a custom node.

    Args:
        node_type: Unique node type identifier
        name: Display name for the node
        description: Node description
        category: Node category

    Returns:
        Decorated function

    Example:
        @node(
            node_type="text_upper",
            name="Text Uppercase",
            description="Converts text to uppercase"
        )
        async def uppercase_node(input_data):
            text = input_data.get('text', '')
            return text.upper()
    """
    def decorator(func: Callable) -> Callable:
        # Store metadata on function
        func._node_metadata = {
            'type': node_type,
            'name': name,
            'description': description,
            'category': category,
            'input_params': getattr(func, '_input_params', {}),
            'output_params': getattr(func, '_output_params', {})
        }

        @wraps(func)
        async def wrapper(*args, **kwargs):
            return await func(*args, **kwargs)

        # Copy metadata to wrapper
        wrapper._node_metadata = func._node_metadata

        return wrapper

    return decorator


def input_param(
    name: str,
    param_type: str,
    description: str = "",
    required: bool = True,
    default: Any = None
):
    """
    Decorator to define an input parameter for a node.

    Args:
        name: Parameter name
        param_type: Parameter type (string, number, boolean, object, array)
        description: Parameter description
        required: Whether parameter is required
        default: Default value if not required

    Returns:
        Decorated function

    Example:
        @input_param('text', 'string', 'Text to process', required=True)
        @input_param('uppercase', 'boolean', 'Convert to uppercase', default=False)
        @node('text_processor', 'Text Processor')
        async def process_text(input_data):
            text = input_data['text']
            if input_data.get('uppercase', False):
                text = text.upper()
            return text
    """
    def decorator(func: Callable) -> Callable:
        if not hasattr(func, '_input_params'):
            func._input_params = {}

        func._input_params[name] = {
            'type': param_type,
            'description': description,
            'required': required,
            'default': default
        }

        # Update metadata if it exists
        if hasattr(func, '_node_metadata'):
            func._node_metadata['input_params'] = func._input_params

        return func

    return decorator


def output_param(
    param_type: str,
    description: str = ""
):
    """
    Decorator to define the output type for a node.

    Args:
        param_type: Output type (string, number, boolean, object, array)
        description: Output description

    Returns:
        Decorated function

    Example:
        @output_param('string', 'Processed text')
        @node('text_processor', 'Text Processor')
        async def process_text(input_data):
            return input_data['text'].upper()
    """
    def decorator(func: Callable) -> Callable:
        func._output_params = {
            'type': param_type,
            'description': description
        }

        # Update metadata if it exists
        if hasattr(func, '_node_metadata'):
            func._node_metadata['output_params'] = func._output_params

        return func

    return decorator


def validate_schema(input_schema: Dict[str, Any], output_schema: Dict[str, Any]):
    """
    Decorator to add validation to node execution.

    Args:
        input_schema: Input validation schema
        output_schema: Output validation schema

    Returns:
        Decorated function
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(input_data: Dict[str, Any], *args, **kwargs):
            # Validate inputs
            for field, config in input_schema.items():
                if config.get('required', False) and field not in input_data:
                    raise ValueError(f"Missing required input: {field}")

            # Execute function
            result = await func(input_data, *args, **kwargs)

            # Validate output
            expected_type = output_schema.get('type')
            if expected_type:
                if not _check_type(result, expected_type):
                    raise ValueError(
                        f"Invalid output type: expected {expected_type}, "
                        f"got {type(result).__name__}"
                    )

            return result

        return wrapper

    return decorator


def _check_type(value: Any, expected_type: str) -> bool:
    """Check if value matches expected type."""
    type_mapping = {
        'string': str,
        'number': (int, float),
        'boolean': bool,
        'object': dict,
        'array': list,
        'any': object
    }

    expected_python_type = type_mapping.get(expected_type, object)
    return isinstance(value, expected_python_type)


def async_node(func: Callable) -> Callable:
    """
    Decorator to ensure function is async.

    Args:
        func: Function to wrap

    Returns:
        Async function
    """
    if inspect.iscoroutinefunction(func):
        return func

    @wraps(func)
    async def wrapper(*args, **kwargs):
        return func(*args, **kwargs)

    return wrapper


def retry(max_attempts: int = 3, delay_seconds: float = 1.0):
    """
    Decorator to add retry logic to node execution.

    Args:
        max_attempts: Maximum retry attempts
        delay_seconds: Delay between retries

    Returns:
        Decorated function
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            import asyncio

            last_exception = None

            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e

                    if attempt < max_attempts - 1:
                        await asyncio.sleep(delay_seconds)
                    else:
                        raise last_exception

            raise last_exception

        return wrapper

    return decorator


def cache_result(ttl_seconds: int = 300):
    """
    Decorator to cache node results.

    Args:
        ttl_seconds: Time to live for cached results

    Returns:
        Decorated function
    """
    cache = {}

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(input_data: Dict[str, Any], *args, **kwargs):
            import time
            import json

            # Create cache key from input data
            cache_key = json.dumps(input_data, sort_keys=True)

            # Check cache
            if cache_key in cache:
                cached_data, cached_time = cache[cache_key]

                if time.time() - cached_time < ttl_seconds:
                    return cached_data

            # Execute and cache
            result = await func(input_data, *args, **kwargs)
            cache[cache_key] = (result, time.time())

            return result

        return wrapper

    return decorator


def timeout(seconds: float):
    """
    Decorator to add timeout to node execution.

    Args:
        seconds: Timeout in seconds

    Returns:
        Decorated function
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            import asyncio

            try:
                return await asyncio.wait_for(
                    func(*args, **kwargs),
                    timeout=seconds
                )
            except asyncio.TimeoutError:
                raise TimeoutError(
                    f"Node execution exceeded timeout of {seconds}s"
                )

        return wrapper

    return decorator
