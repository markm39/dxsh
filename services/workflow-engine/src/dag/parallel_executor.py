"""
Parallel Executor Module

Executes workflow DAGs with maximum parallelism using asyncio.
"""

import logging
import asyncio
from typing import List, Dict, Any, Callable, Optional, Set
from datetime import datetime
from dataclasses import dataclass

from .dag_analyzer import DAGAnalyzer
from .resource_manager import ResourceManager

logger = logging.getLogger(__name__)


@dataclass
class NodeExecutionResult:
    """Result of a node execution."""
    node_id: str
    success: bool
    data: Any
    error: Optional[str] = None
    execution_time_ms: float = 0.0
    metadata: Optional[Dict[str, Any]] = None


class ParallelExecutor:
    """
    Executes workflow DAGs with parallel node execution.

    Automatically identifies and executes independent nodes concurrently.
    """

    def __init__(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        resource_manager: Optional[ResourceManager] = None,
        max_concurrent: Optional[int] = None
    ):
        """
        Initialize parallel executor.

        Args:
            nodes: List of workflow nodes
            edges: List of workflow edges
            resource_manager: Resource manager for allocation (creates default if None)
            max_concurrent: Maximum concurrent executions (None for unlimited)
        """
        self.nodes = nodes
        self.edges = edges
        self.analyzer = DAGAnalyzer(nodes, edges)
        self.resource_manager = resource_manager or ResourceManager()
        self.max_concurrent = max_concurrent
        self.semaphore = asyncio.Semaphore(max_concurrent) if max_concurrent else None

    async def execute(
        self,
        node_executor: Callable,
        input_data: Optional[Dict[str, Any]] = None,
        on_node_complete: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """
        Execute the workflow DAG with maximum parallelism.

        Args:
            node_executor: Async function to execute a single node
            input_data: Initial input data for the workflow
            on_node_complete: Optional callback when a node completes

        Returns:
            Dict with execution results
        """
        try:
            logger.info(f"Starting parallel execution of {len(self.nodes)} nodes")

            # Validate DAG
            validation = self.analyzer.validate_dag()
            if not validation['is_valid']:
                errors = [
                    issue['message']
                    for issue in validation['issues']
                    if issue['severity'] == 'error'
                ]
                return {
                    'success': False,
                    'error': f"Invalid DAG: {'; '.join(errors)}",
                    'validation_issues': validation['issues']
                }

            # Get execution levels
            levels = self.analyzer.get_execution_levels()

            logger.info(
                f"Executing {len(levels)} levels with "
                f"max parallelism of {max(len(level) for level in levels)}"
            )

            # Track execution state
            node_results = {}
            node_data = {}
            start_time = datetime.utcnow()

            # Execute levels sequentially, nodes within level in parallel
            for level_idx, level in enumerate(levels):
                logger.info(
                    f"Executing level {level_idx + 1}/{len(levels)} "
                    f"with {len(level)} nodes"
                )

                # Execute all nodes in this level concurrently
                level_results = await self._execute_level(
                    level=level,
                    node_executor=node_executor,
                    node_data=node_data,
                    input_data=input_data,
                    on_node_complete=on_node_complete
                )

                # Store results
                for node_id, result in level_results.items():
                    node_results[node_id] = result

                    if result.success:
                        node_data[node_id] = result.data
                    else:
                        logger.error(
                            f"Node {node_id} failed: {result.error}"
                        )

            end_time = datetime.utcnow()
            total_time = (end_time - start_time).total_seconds() * 1000

            # Determine overall success
            failed_nodes = [
                node_id for node_id, result in node_results.items()
                if not result.success
            ]

            overall_success = len(failed_nodes) == 0

            # Calculate statistics
            node_times = [
                result.execution_time_ms
                for result in node_results.values()
            ]

            result = {
                'success': overall_success,
                'total_execution_time_ms': total_time,
                'node_results': {
                    node_id: {
                        'success': result.success,
                        'data': result.data,
                        'error': result.error,
                        'execution_time_ms': result.execution_time_ms,
                        'metadata': result.metadata
                    }
                    for node_id, result in node_results.items()
                },
                'failed_nodes': failed_nodes,
                'statistics': {
                    'total_nodes': len(self.nodes),
                    'execution_levels': len(levels),
                    'avg_node_time_ms': sum(node_times) / len(node_times) if node_times else 0,
                    'max_node_time_ms': max(node_times) if node_times else 0,
                    'min_node_time_ms': min(node_times) if node_times else 0
                }
            }

            logger.info(
                f"Parallel execution completed in {total_time:.2f}ms "
                f"({len(failed_nodes)} failures)"
            )

            return result

        except Exception as e:
            logger.error(f"Parallel execution failed: {e}")
            return {
                'success': False,
                'error': f"Execution failed: {str(e)}"
            }

    async def _execute_level(
        self,
        level: List[str],
        node_executor: Callable,
        node_data: Dict[str, Any],
        input_data: Optional[Dict[str, Any]],
        on_node_complete: Optional[Callable]
    ) -> Dict[str, NodeExecutionResult]:
        """
        Execute all nodes in a level concurrently.

        Args:
            level: List of node IDs in this level
            node_executor: Function to execute nodes
            node_data: Data from previously executed nodes
            input_data: Workflow input data
            on_node_complete: Callback for node completion

        Returns:
            Dict mapping node_id to execution result
        """
        # Get node objects
        node_map = {node['id']: node for node in self.nodes}

        # Create tasks for all nodes in this level
        tasks = []
        for node_id in level:
            node = node_map[node_id]
            task = self._execute_single_node(
                node=node,
                node_executor=node_executor,
                node_data=node_data,
                input_data=input_data,
                on_node_complete=on_node_complete
            )
            tasks.append((node_id, task))

        # Execute all tasks concurrently
        results = await asyncio.gather(
            *[task for _, task in tasks],
            return_exceptions=True
        )

        # Map results back to node IDs
        level_results = {}
        for (node_id, _), result in zip(tasks, results):
            if isinstance(result, Exception):
                level_results[node_id] = NodeExecutionResult(
                    node_id=node_id,
                    success=False,
                    data=None,
                    error=str(result)
                )
            else:
                level_results[node_id] = result

        return level_results

    async def _execute_single_node(
        self,
        node: Dict[str, Any],
        node_executor: Callable,
        node_data: Dict[str, Any],
        input_data: Optional[Dict[str, Any]],
        on_node_complete: Optional[Callable]
    ) -> NodeExecutionResult:
        """
        Execute a single node with resource management.

        Args:
            node: Node to execute
            node_executor: Executor function
            node_data: Available node data
            input_data: Workflow input
            on_node_complete: Completion callback

        Returns:
            Node execution result
        """
        node_id = node['id']
        start_time = datetime.utcnow()

        try:
            # Apply semaphore if max_concurrent is set
            if self.semaphore:
                async with self.semaphore:
                    result = await self._do_execute_node(
                        node, node_executor, node_data, input_data
                    )
            else:
                result = await self._do_execute_node(
                    node, node_executor, node_data, input_data
                )

            end_time = datetime.utcnow()
            execution_time = (end_time - start_time).total_seconds() * 1000

            # Update execution time if not already set
            if result.execution_time_ms == 0:
                result.execution_time_ms = execution_time

            # Call completion callback
            if on_node_complete:
                try:
                    await on_node_complete(node_id, result)
                except Exception as e:
                    logger.error(f"Error in completion callback: {e}")

            return result

        except Exception as e:
            end_time = datetime.utcnow()
            execution_time = (end_time - start_time).total_seconds() * 1000

            logger.error(f"Error executing node {node_id}: {e}")

            return NodeExecutionResult(
                node_id=node_id,
                success=False,
                data=None,
                error=str(e),
                execution_time_ms=execution_time
            )

    async def _do_execute_node(
        self,
        node: Dict[str, Any],
        node_executor: Callable,
        node_data: Dict[str, Any],
        input_data: Optional[Dict[str, Any]]
    ) -> NodeExecutionResult:
        """
        Actually execute the node.

        Args:
            node: Node to execute
            node_executor: Executor function
            node_data: Available node data
            input_data: Workflow input

        Returns:
            Execution result
        """
        node_id = node['id']

        # Prepare node input from dependencies
        node_input = {}

        if input_data:
            node_input['workflow_input'] = input_data

        # Add data from dependencies
        dependencies = self.analyzer.adjacency_list.get(node_id, [])
        for dep_id in dependencies:
            if dep_id in node_data:
                node_input[f'input_from_{dep_id}'] = node_data[dep_id]

        # Request resources
        resources_needed = node.get('resources', {})
        allocated = await self.resource_manager.allocate_resources(
            node_id, resources_needed
        )

        try:
            # Execute the node
            result = await node_executor(node, node_input)

            # Convert dict result to NodeExecutionResult if needed
            if isinstance(result, dict):
                result = NodeExecutionResult(
                    node_id=node_id,
                    success=result.get('success', False),
                    data=result.get('data'),
                    error=result.get('error'),
                    metadata=result.get('metadata')
                )

            return result

        finally:
            # Release resources
            if allocated:
                await self.resource_manager.release_resources(node_id)

    async def execute_subgraph(
        self,
        node_ids: List[str],
        node_executor: Callable,
        input_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute a subgraph of nodes.

        Args:
            node_ids: List of node IDs to execute
            node_executor: Executor function
            input_data: Input data

        Returns:
            Execution results
        """
        # Filter nodes and edges for subgraph
        subgraph_nodes = [
            node for node in self.nodes if node['id'] in node_ids
        ]

        subgraph_edges = [
            edge for edge in self.edges
            if edge.get('source') in node_ids and edge.get('target') in node_ids
        ]

        # Create new executor for subgraph
        subgraph_executor = ParallelExecutor(
            nodes=subgraph_nodes,
            edges=subgraph_edges,
            resource_manager=self.resource_manager,
            max_concurrent=self.max_concurrent
        )

        # Execute subgraph
        return await subgraph_executor.execute(node_executor, input_data)

    def get_parallelism_report(self) -> Dict[str, Any]:
        """
        Get a report on parallelism opportunities.

        Returns:
            Dict with parallelism analysis
        """
        return self.analyzer.analyze_parallelism()
