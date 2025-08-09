"""
Node Executors Package

Contains executor classes for different node types in the workflow engine.
Each executor handles the actual execution logic for specific node types.
"""

from .base_executor import BaseExecutor
from .web_source_executor import WebSourceExecutor

__all__ = ['BaseExecutor', 'WebSourceExecutor']