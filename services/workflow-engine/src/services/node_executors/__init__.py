from .base_executor import BaseNodeExecutor, NodeExecutionResult
from .web_source_executor import WebSourceExecutor

# For backward compatibility
BaseExecutor = BaseNodeExecutor

__all__ = [
    'BaseNodeExecutor',
    'BaseExecutor',
    'NodeExecutionResult',
    'WebSourceExecutor'
]