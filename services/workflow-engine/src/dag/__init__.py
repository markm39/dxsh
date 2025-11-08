"""
DAG (Directed Acyclic Graph) Execution Module

Provides advanced parallel execution capabilities for workflows.
"""

from .dag_analyzer import DAGAnalyzer
from .parallel_executor import ParallelExecutor
from .resource_manager import ResourceManager

__all__ = [
    'DAGAnalyzer',
    'ParallelExecutor',
    'ResourceManager'
]
