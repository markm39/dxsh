"""
Dxsh Custom Node SDK

Python SDK for creating custom workflow nodes.
"""

from .base_node import BaseNode, NodeExecutionResult
from .decorators import node, input_param, output_param
from .validation import validate_inputs, validate_outputs, ValidationError

__version__ = "1.0.0"

__all__ = [
    'BaseNode',
    'NodeExecutionResult',
    'node',
    'input_param',
    'output_param',
    'validate_inputs',
    'validate_outputs',
    'ValidationError'
]
