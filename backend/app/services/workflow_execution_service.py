"""
Workflow Execution Service

Handles the execution of workflow graphs, including node dependency resolution,
data passing between nodes, and execution orchestration.
"""

import asyncio
import logging
from typing import Dict, Any, List, Optional, Set
from dataclasses import dataclass
from datetime import datetime
from app.executors import WebSourceExecutor
from app.models import Workflow, Execution

logger = logging.getLogger(__name__)

@dataclass
class NodeExecutionResult:
    """Result of executing a single node"""
    node_id: str
    success: bool
    data: Any
    error: Optional[str] = None
    metadata: Optional[Dict] = None
    execution_time_ms: Optional[float] = None

class WorkflowExecutionService:
    """Service for executing workflows with proper dependency resolution"""
    
    def __init__(self):
        self.node_executors = {
            'webSource': WebSourceExecutor
        }
    
    async def execute_workflow(self, workflow_id: int, user_id: int, input_data: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Execute a complete workflow
        
        Args:
            workflow_id: ID of the workflow to execute
            user_id: ID of the user executing the workflow
            input_data: Optional input data for the workflow
            
        Returns:
            Execution result with all node outputs
        """
        try:
            # Load workflow from database
            workflow = Workflow.query.filter_by(id=workflow_id, user_id=user_id).first()
            if not workflow:
                return {
                    'success': False,
                    'error': f'Workflow {workflow_id} not found or access denied'
                }
            
            logger.info(f"Starting execution of workflow '{workflow.name}' (ID: {workflow_id})")
            
            # Create execution record
            execution = Execution(
                workflow_id=workflow_id,
                user_id=user_id,
                status='running',
                started_at=datetime.utcnow()
            )
            
            try:
                from app import db
                db.session.add(execution)
                db.session.commit()
                execution_id = execution.id
            except Exception as e:
                logger.error(f"Failed to create execution record: {e}")
                execution_id = None
            
            # Parse workflow definition
            workflow_def = workflow.definition
            if not workflow_def or 'nodes' not in workflow_def:
                return {
                    'success': False,
                    'error': 'Invalid workflow definition - missing nodes'
                }
            
            nodes = workflow_def['nodes']
            edges = workflow_def.get('edges', [])
            
            # Execute the workflow
            start_time = datetime.utcnow()
            result = await self._execute_node_graph(nodes, edges, input_data)
            end_time = datetime.utcnow()
            
            # Update execution record
            if execution_id:
                try:
                    execution.status = 'completed' if result['success'] else 'failed'
                    execution.completed_at = end_time
                    execution.result = result
                    db.session.commit()
                except Exception as e:
                    logger.error(f"Failed to update execution record: {e}")
            
            execution_time = (end_time - start_time).total_seconds() * 1000
            result['execution_time_ms'] = execution_time
            result['execution_id'] = execution_id
            
            logger.info(f"Workflow execution completed in {execution_time:.2f}ms")
            return result
            
        except Exception as e:
            logger.error(f"Error executing workflow {workflow_id}: {e}")
            
            # Update execution record with error
            if 'execution' in locals() and execution.id:
                try:
                    execution.status = 'failed'
                    execution.completed_at = datetime.utcnow()
                    execution.result = {'success': False, 'error': str(e)}
                    db.session.commit()
                except Exception as db_error:
                    logger.error(f"Failed to update execution record with error: {db_error}")
            
            return {
                'success': False,
                'error': f'Workflow execution failed: {str(e)}'
            }
    
    async def _execute_node_graph(self, nodes: List[Dict], edges: List[Dict], input_data: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Execute a graph of nodes with proper dependency resolution
        """
        try:
            # Build dependency graph
            dependencies = self._build_dependency_graph(nodes, edges)
            
            # Topologically sort nodes for execution order
            execution_order = self._topological_sort(nodes, dependencies)
            
            if not execution_order:
                return {
                    'success': False,
                    'error': 'Circular dependency detected in workflow'
                }
            
            logger.info(f"Execution order: {[node['id'] for node in execution_order]}")
            
            # Execute nodes in order
            node_results = {}
            node_data = {}
            
            for node in execution_order:
                node_id = node['id']
                
                # Prepare input data for this node
                node_input = self._prepare_node_input(node, node_data, dependencies, input_data)
                
                # Execute the node
                result = await self._execute_single_node(node, node_input)
                
                # Store results
                node_results[node_id] = result
                
                if result.success:
                    node_data[node_id] = result.data
                    logger.info(f"Node {node_id} executed successfully")
                else:
                    logger.error(f"Node {node_id} failed: {result.error}")
                    # For now, continue execution even if a node fails
                    # In the future, we might want to add configurable failure handling
            
            # Determine overall success
            failed_nodes = [node_id for node_id, result in node_results.items() if not result.success]
            overall_success = len(failed_nodes) == 0
            
            return {
                'success': overall_success,
                'node_results': {node_id: {
                    'success': result.success,
                    'data': result.data,
                    'error': result.error,
                    'metadata': result.metadata,
                    'execution_time_ms': result.execution_time_ms
                } for node_id, result in node_results.items()},
                'failed_nodes': failed_nodes,
                'output_data': node_data
            }
            
        except Exception as e:
            logger.error(f"Error executing node graph: {e}")
            return {
                'success': False,
                'error': f'Node graph execution failed: {str(e)}'
            }
    
    def _build_dependency_graph(self, nodes: List[Dict], edges: List[Dict]) -> Dict[str, List[str]]:
        """
        Build a dependency graph from workflow edges
        
        Returns:
            Dictionary mapping node_id -> list of node_ids it depends on
        """
        dependencies = {node['id']: [] for node in nodes}
        
        for edge in edges:
            source_id = edge.get('source')
            target_id = edge.get('target')
            
            if source_id and target_id and target_id in dependencies:
                dependencies[target_id].append(source_id)
        
        return dependencies
    
    def _topological_sort(self, nodes: List[Dict], dependencies: Dict[str, List[str]]) -> Optional[List[Dict]]:
        """
        Topologically sort nodes based on dependencies
        
        Returns:
            List of nodes in execution order, or None if circular dependency detected
        """
        # Create a mapping of node_id to node for easy lookup
        node_map = {node['id']: node for node in nodes}
        
        # Initialize in-degree count for each node
        in_degree = {node_id: len(deps) for node_id, deps in dependencies.items()}
        
        # Find nodes with no dependencies
        queue = [node_id for node_id, degree in in_degree.items() if degree == 0]
        result = []
        
        while queue:
            # Take a node with no remaining dependencies
            current_id = queue.pop(0)
            result.append(node_map[current_id])
            
            # For each node that depends on this one, reduce its in-degree
            for node_id, deps in dependencies.items():
                if current_id in deps:
                    in_degree[node_id] -= 1
                    if in_degree[node_id] == 0:
                        queue.append(node_id)
        
        # Check for circular dependencies
        if len(result) != len(nodes):
            logger.error("Circular dependency detected in workflow")
            return None
        
        return result
    
    def _prepare_node_input(self, node: Dict, node_data: Dict, dependencies: Dict[str, List[str]], workflow_input: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Prepare input data for a node based on its dependencies
        """
        node_id = node['id']
        node_input = {}
        
        # Add workflow-level input data
        if workflow_input:
            node_input['workflow_input'] = workflow_input
        
        # Add data from dependent nodes
        node_dependencies = dependencies.get(node_id, [])
        for dep_id in node_dependencies:
            if dep_id in node_data:
                node_input[f'input_from_{dep_id}'] = node_data[dep_id]
        
        return node_input
    
    async def _execute_single_node(self, node: Dict, input_data: Dict[str, Any]) -> NodeExecutionResult:
        """
        Execute a single node
        """
        node_id = node['id']
        node_type = node.get('type')
        
        start_time = datetime.utcnow()
        
        try:
            logger.info(f"Executing node {node_id} (type: {node_type})")
            
            # Get executor for this node type
            executor_class = self.node_executors.get(node_type)
            if not executor_class:
                return NodeExecutionResult(
                    node_id=node_id,
                    success=False,
                    data=None,
                    error=f"No executor found for node type: {node_type}"
                )
            
            # Create executor instance
            executor = executor_class(node)
            
            # Execute the node
            result = await executor.execute(input_data)
            
            end_time = datetime.utcnow()
            execution_time = (end_time - start_time).total_seconds() * 1000
            
            return NodeExecutionResult(
                node_id=node_id,
                success=result.get('success', False),
                data=result.get('data'),
                error=result.get('error'),
                metadata=result.get('metadata'),
                execution_time_ms=execution_time
            )
            
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
    
    async def execute_single_node_by_id(self, workflow_id: int, node_id: str, user_id: int, input_data: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Execute a single node from a workflow (useful for testing)
        """
        try:
            # Load workflow
            workflow = Workflow.query.filter_by(id=workflow_id, user_id=user_id).first()
            if not workflow:
                return {
                    'success': False,
                    'error': f'Workflow {workflow_id} not found or access denied'
                }
            
            # Find the node
            nodes = workflow.definition.get('nodes', [])
            target_node = None
            for node in nodes:
                if node['id'] == node_id:
                    target_node = node
                    break
            
            if not target_node:
                return {
                    'success': False,
                    'error': f'Node {node_id} not found in workflow'
                }
            
            # Execute the single node
            result = await self._execute_single_node(target_node, input_data or {})
            
            return {
                'success': result.success,
                'node_id': result.node_id,
                'data': result.data,
                'error': result.error,
                'metadata': result.metadata,
                'execution_time_ms': result.execution_time_ms
            }
            
        except Exception as e:
            logger.error(f"Error executing single node {node_id}: {e}")
            return {
                'success': False,
                'error': f'Node execution failed: {str(e)}'
            }