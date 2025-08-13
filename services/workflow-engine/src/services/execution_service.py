"""
Workflow Execution Service - FastAPI version

Handles the execution of workflow graphs, including node dependency resolution,
data passing between nodes, and execution orchestration.

Adapted from the working Flask implementation.
"""

import asyncio
import logging
from typing import Dict, Any, List, Optional, Set
from dataclasses import dataclass
from datetime import datetime
from sqlalchemy.orm import Session
from ..models import WorkflowExecution, NodeExecution, AgentWorkflow
from .node_executors import WebSourceExecutor
from .node_executors.ai_processor_executor import AiProcessorExecutor
from .node_executors.http_request_executor import HttpRequestExecutor
from .node_executors.file_node_executor import FileNodeExecutor
from .node_executors.data_structuring_executor import DataStructuringExecutor
from .node_executors.chart_generation_executor import ChartGenerationExecutor
from .node_executors.ml_executor import MLExecutor
from .node_executors.postgres_executor import PostgresExecutor
from .node_executors.random_forest_executor import RandomForestExecutor

logger = logging.getLogger(__name__)

# Import NodeExecutionResult from base_executor to ensure consistency
from .node_executors.base_executor import NodeExecutionResult

class ExecutionService:
    """Service for executing workflows with proper dependency resolution"""
    
    def __init__(self, db: Session):
        self.db = db
        self.current_workflow_execution_id = None  # Track current execution context
        # Registry of node executors - All 9 node types
        self.node_executors = {
            'webSource': WebSourceExecutor,
            'aiProcessor': AiProcessorExecutor,
            'httpRequest': HttpRequestExecutor,
            'fileNode': FileNodeExecutor,
            'dataStructuring': DataStructuringExecutor,
            'chartGenerator': ChartGenerationExecutor,
            'linearRegression': MLExecutor,
            'postgres': PostgresExecutor,
            'randomForest': RandomForestExecutor
        }
    
    async def execute_workflow_async(self, execution_id: int, input_data: Optional[Dict] = None):
        """Execute a workflow asynchronously"""
        try:
            execution = self.db.query(WorkflowExecution).filter(
                WorkflowExecution.id == execution_id
            ).first()
            
            if not execution:
                logger.error(f"Execution {execution_id} not found")
                return
            
            logger.info(f"Starting execution {execution_id} with {len(execution.workflow_nodes)} nodes")
            
            # Set execution context
            self.current_workflow_execution_id = execution_id
            
            # Parse workflow definition
            nodes = execution.workflow_nodes
            edges = execution.workflow_edges
            
            if not nodes:
                execution.completed_at = datetime.utcnow()
                execution.status = 'failed'
                execution.error_message = 'Invalid workflow definition - missing nodes'
                self.db.commit()
                return
            
            # Execute the workflow
            start_time = datetime.utcnow()
            result = await self._execute_node_graph(nodes, edges, input_data)
            end_time = datetime.utcnow()
            
            # Update execution record
            execution.status = 'completed' if result['success'] else 'failed'
            execution.completed_at = end_time
            if not result['success']:
                execution.error_message = result.get('error', 'Workflow execution failed')
            
            self.db.commit()
            
            execution_time = (end_time - start_time).total_seconds() * 1000
            logger.info(f"Workflow execution completed in {execution_time:.2f}ms")
            
        except Exception as e:
            logger.error(f"Error executing workflow {execution_id}: {e}")
            execution = self.db.query(WorkflowExecution).filter(
                WorkflowExecution.id == execution_id
            ).first()
            if execution:
                execution.completed_at = datetime.utcnow()
                execution.status = 'failed'
                execution.error_message = str(e)
                self.db.commit()
    
    async def _execute_node_graph(self, nodes: List[Dict], edges: List[Dict], input_data: Optional[Dict] = None) -> Dict[str, Any]:
        """Execute a graph of nodes with proper dependency resolution"""
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
                    # Continue execution even if a node fails
            
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
        """Build a dependency graph from workflow edges"""
        dependencies = {node['id']: [] for node in nodes}
        
        for edge in edges:
            source_id = edge.get('source')
            target_id = edge.get('target')
            
            if source_id and target_id and target_id in dependencies:
                dependencies[target_id].append(source_id)
        
        return dependencies
    
    def _topological_sort(self, nodes: List[Dict], dependencies: Dict[str, List[str]]) -> Optional[List[Dict]]:
        """Topologically sort nodes based on dependencies"""
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
        """Prepare input data for a node based on its dependencies"""
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
        """Execute a single node"""
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
            
            # If result is already a NodeExecutionResult, just update the execution time
            if isinstance(result, NodeExecutionResult):
                result.execution_time_ms = execution_time
                
                # Save node execution result to database
                await self._save_node_execution(node_id, result, start_time, end_time, node_type)
                
                return result
            
            # Otherwise, assume it's a dictionary and convert to NodeExecutionResult
            node_result = NodeExecutionResult(
                node_id=node_id,
                success=result.get('success', False),
                data=result.get('data'),
                error=result.get('error'),
                metadata=result.get('metadata'),
                execution_time_ms=execution_time
            )
            
            # Save node execution result to database
            await self._save_node_execution(node_id, node_result, start_time, end_time, node_type)
            
            return node_result
            
        except Exception as e:
            end_time = datetime.utcnow()
            execution_time = (end_time - start_time).total_seconds() * 1000
            
            logger.error(f"Error executing node {node_id}: {e}")
            error_result = NodeExecutionResult(
                node_id=node_id,
                success=False,
                data=None,
                error=str(e),
                execution_time_ms=execution_time
            )
            
            # Save failed execution to database
            await self._save_node_execution(node_id, error_result, start_time, end_time, node_type)
            
            return error_result
    
    async def _save_node_execution(self, node_id: str, result: NodeExecutionResult, start_time: datetime, end_time: datetime, node_type: str):
        """Save node execution result to database"""
        try:
            # Skip if no workflow execution context
            if not self.current_workflow_execution_id:
                logger.warning(f"No workflow execution ID set - cannot save node execution for {node_id}")
                return
            
            # Handle database session errors
            try:
                # Try to commit any pending changes first
                self.db.commit()
            except Exception:
                # If there's an error, rollback and continue
                self.db.rollback()
            
            # Create node execution record
            node_execution = NodeExecution(
                node_id=node_id,
                node_type=node_type,  # Added node_type field
                execution_id=self.current_workflow_execution_id,  # Fixed field name
                status='completed' if result.success else 'failed',
                started_at=start_time,
                completed_at=end_time,
                output_data=result.data,
                error_message=result.error,
                node_specific_data=result.metadata or {}  # Fixed field name
            )
            
            # Save to database
            self.db.add(node_execution)
            self.db.commit()
            
            logger.info(f"✅ Saved node execution: {node_id} - Success: {result.success} - WF Exec ID: {self.current_workflow_execution_id}")
            
        except Exception as e:
            logger.error(f"Error saving node execution for {node_id}: {e}")
            # Rollback on error
            try:
                self.db.rollback()
            except:
                pass
    
    async def execute_single_node_by_id(self, workflow_id: int, node_id: str, user_id: int, input_data: Optional[Dict] = None) -> Dict[str, Any]:
        """Execute a single node from a workflow (useful for testing)"""
        try:
            # Load workflow
            workflow = self.db.query(AgentWorkflow).filter(
                AgentWorkflow.id == workflow_id,
                AgentWorkflow.user_id == user_id
            ).first()
            
            if not workflow:
                return {
                    'success': False,
                    'error': f'Workflow {workflow_id} not found or access denied'
                }
            
            # Find the node
            nodes = workflow.nodes or []
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
            
            # Create a temporary workflow execution context for single node execution
            # This allows the node execution to be saved properly
            from ..models import WorkflowExecution
            temp_execution = WorkflowExecution(
                agent_id=workflow_id,
                user_id=user_id,
                workflow_nodes=[target_node],
                workflow_edges=[],
                status='running'
            )
            self.db.add(temp_execution)
            self.db.commit()
            
            # Set execution context
            self.current_workflow_execution_id = temp_execution.id
            
            # Execute the single node
            result = await self._execute_single_node(target_node, input_data or {})
            
            # Update temp execution status
            temp_execution.status = 'completed' if result.success else 'failed'
            temp_execution.completed_at = datetime.utcnow()
            if not result.success:
                temp_execution.error_message = result.error
            self.db.commit()
            
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