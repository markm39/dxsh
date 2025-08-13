"""
Agent management and execution API endpoints
Handles agent-based workflow execution for linear regression and other ML models
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import logging
import json
from datetime import datetime

from ..auth import get_current_user, AuthUser
from ..database import get_db
from ..models.workflow import AgentWorkflow
from ..models.execution import WorkflowExecution, NodeExecution
from ..services.execution_service import ExecutionService

router = APIRouter(prefix="/api/v1/agents", tags=["agents"])
executions_router = APIRouter(prefix="/api/v1/executions", tags=["executions"])
logger = logging.getLogger(__name__)

# Note: ExecutionService will be initialized per request with database session

@router.post("/{agent_id}/executions")
async def create_agent_execution(
    agent_id: int,
    request: Request,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new execution for an agent/workflow
    This handles ML model training and other workflow executions
    """
    try:
        # Get request body
        request_data = await request.json()
        
        # Extract execution parameters
        workflow_id = request_data.get('workflow_id', agent_id)  # Use agent_id as workflow_id fallback
        node_id = request_data.get('node_id')
        execution_data = request_data.get('execution_data', {})
        
        logger.info(f"Creating execution for agent {agent_id}, workflow {workflow_id}, node {node_id}")
        
        # Get the workflow
        workflow = db.query(AgentWorkflow).filter(
            AgentWorkflow.id == workflow_id,
            AgentWorkflow.user_id == current_user.user_id
        ).first()
        
        if not workflow:
            raise HTTPException(status_code=404, detail=f"Workflow {workflow_id} not found")
        
        # Use workflow nodes and edges directly (they're already JSON in AgentWorkflow)
        workflow_data = {
            'nodes': workflow.nodes or [],
            'edges': workflow.edges or []
        }
        
        # Create execution record
        execution = WorkflowExecution(
            agent_id=workflow_id,  # Using agent_id field
            user_id=current_user.user_id,
            status='running',
            workflow_nodes=workflow_data['nodes'],
            workflow_edges=workflow_data['edges'],
            started_at=datetime.utcnow()
        )
        
        db.add(execution)
        db.commit()
        db.refresh(execution)
        
        logger.info(f"Created execution {execution.id} for workflow {workflow_id}")
        
        # Initialize execution service with database session
        execution_service = ExecutionService(db)
        # Set the current workflow execution context
        execution_service.current_workflow_execution_id = execution.id
        
        # Execute the workflow/node
        try:
            if node_id:
                # Execute specific node from workflow
                result = await execution_service.execute_single_node_by_id(
                    workflow_id=workflow_id,
                    node_id=node_id,
                    user_id=current_user.user_id,
                    input_data=execution_data
                )
            else:
                # Execute full workflow - we need to extract nodes and edges from workflow_data
                nodes = workflow_data.get('nodes', [])
                edges = workflow_data.get('edges', [])
                
                if not nodes:
                    raise Exception("No nodes found in workflow")
                
                result = await execution_service._execute_node_graph(nodes, edges, execution_data)
            
            # Update execution with results
            execution.status = 'completed'
            execution.completed_at = datetime.utcnow()
            # Store results in the node executions rather than the execution itself
            
        except Exception as e:
            # Update execution with error
            execution.status = 'failed'
            execution.error_message = str(e)
            execution.completed_at = datetime.utcnow()
            logger.error(f"Execution {execution.id} failed: {e}")
            result = {'success': False, 'error': str(e)}
            
        db.commit()
        db.refresh(execution)
        
        # Sanitize the result to ensure JSON serialization
        import math
        import numpy as np
        def sanitize_for_json(obj):
            """Recursively clean NaN and Infinity values from nested structures"""
            if isinstance(obj, dict):
                return {k: sanitize_for_json(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [sanitize_for_json(item) for item in obj]
            elif isinstance(obj, (np.ndarray,)):
                return sanitize_for_json(obj.tolist())
            elif isinstance(obj, (np.float32, np.float64, float)):
                if math.isnan(obj) or math.isinf(obj):
                    return None
                return float(obj)
            elif isinstance(obj, (np.int32, np.int64)):
                return int(obj)
            return obj
        
        # Return execution result
        return {
            "success": execution.status == 'completed',
            "execution": {
                "id": execution.id,
                "status": execution.status,
                "started_at": execution.started_at.isoformat() if execution.started_at else None,
                "completed_at": execution.completed_at.isoformat() if execution.completed_at else None,
                "error_message": execution.error_message if execution.status == 'failed' else None
            },
            "result": sanitize_for_json(result) if execution.status == 'completed' else None,
            "error": execution.error_message if execution.status == 'failed' else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create agent execution: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create execution: {str(e)}")

@router.get("/{agent_id}/executions")
async def get_agent_executions(
    agent_id: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get execution history for an agent/workflow
    """
    try:
        # Get executions for this agent/workflow
        executions = db.query(WorkflowExecution).filter(
            WorkflowExecution.agent_id == agent_id,
            WorkflowExecution.user_id == current_user.user_id
        ).order_by(WorkflowExecution.started_at.desc()).limit(50).all()
        
        execution_list = []
        for execution in executions:
            execution_list.append({
                "id": execution.id,
                "agent_id": execution.agent_id,
                "status": execution.status,
                "started_at": execution.started_at.isoformat() if execution.started_at else None,
                "completed_at": execution.completed_at.isoformat() if execution.completed_at else None,
                "error_message": execution.error_message
            })
        
        return {
            "success": True,
            "executions": execution_list,
            "total": len(execution_list)
        }
        
    except Exception as e:
        logger.error(f"Failed to get agent executions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{agent_id}/executions/{execution_id}")
async def get_execution_details(
    agent_id: int,
    execution_id: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed execution results
    """
    try:
        execution = db.query(WorkflowExecution).filter(
            WorkflowExecution.id == execution_id,
            WorkflowExecution.agent_id == agent_id,
            WorkflowExecution.user_id == current_user.user_id
        ).first()
        
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")
        
        return {
            "success": True,
            "execution": {
                "id": execution.id,
                "agent_id": execution.agent_id,
                "status": execution.status,
                "workflow_nodes": execution.workflow_nodes,
                "workflow_edges": execution.workflow_edges,
                "error_message": execution.error_message,
                "started_at": execution.started_at.isoformat() if execution.started_at else None,
                "completed_at": execution.completed_at.isoformat() if execution.completed_at else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get execution details: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{agent_id}/executions/{execution_id}")
async def delete_execution(
    agent_id: int,
    execution_id: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete an execution record
    """
    try:
        execution = db.query(WorkflowExecution).filter(
            WorkflowExecution.id == execution_id,
            WorkflowExecution.agent_id == agent_id,
            WorkflowExecution.user_id == current_user.user_id
        ).first()
        
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")
        
        db.delete(execution)
        db.commit()
        
        return {"success": True, "message": "Execution deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete execution: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{agent_id}/nodes/{node_id}/executions")
async def get_node_executions(
    agent_id: int,
    node_id: str,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get execution history for a specific node within an agent/workflow
    """
    try:
        # Get node executions for this agent and node
        node_executions = db.query(NodeExecution).join(WorkflowExecution).filter(
            WorkflowExecution.agent_id == agent_id,
            WorkflowExecution.user_id == current_user.user_id,
            NodeExecution.node_id == node_id
        ).order_by(NodeExecution.started_at.desc()).limit(50).all()
        
        execution_list = []
        for node_execution in node_executions:
            execution_list.append({
                "id": node_execution.id,
                "execution_id": node_execution.execution_id,
                "node_id": node_execution.node_id,
                "node_type": node_execution.node_type,
                "status": node_execution.status,
                "started_at": node_execution.started_at.isoformat() if node_execution.started_at else None,
                "completed_at": node_execution.completed_at.isoformat() if node_execution.completed_at else None,
                "error_message": node_execution.error_message,
                "output_data": node_execution.output_data,
                "node_specific_data": node_execution.node_specific_data
            })
        
        return {
            "success": True,
            "executions": execution_list,
            "total": len(execution_list),
            "agent_id": agent_id,
            "node_id": node_id
        }
        
    except Exception as e:
        logger.error(f"Failed to get node executions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Node execution endpoints for workflow execution API
@executions_router.post("/{execution_id}/nodes")
async def create_node_execution(
    execution_id: int,
    request: Request,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a node execution record"""
    try:
        # Get request body
        node_data = await request.json()
        
        # Verify execution ownership
        execution = db.query(WorkflowExecution).filter(
            WorkflowExecution.id == execution_id,
            WorkflowExecution.user_id == current_user.user_id
        ).first()
        
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")
        
        # Create node execution record
        node_execution = NodeExecution(
            execution_id=execution_id,
            node_id=node_data['node_id'],
            node_type=node_data['node_type'],
            input_config=node_data.get('input_config'),
            status='running',
            started_at=datetime.utcnow()
        )
        
        # Set node-specific data
        node_specific_data = _extract_node_specific_data(node_data)
        node_execution.node_specific_data = node_specific_data if node_specific_data else None
        
        db.add(node_execution)
        db.commit()
        db.refresh(node_execution)
        
        logger.info(f"Created node execution {node_execution.id} for execution {execution_id}, node {node_data['node_id']}")
        
        return {
            "success": True,
            "node_execution": {
                "id": node_execution.id,
                "execution_id": node_execution.execution_id,
                "node_id": node_execution.node_id,
                "node_type": node_execution.node_type,
                "status": node_execution.status,
                "started_at": node_execution.started_at.isoformat() if node_execution.started_at else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create node execution: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@executions_router.put("/nodes/{node_execution_id}")
async def update_node_execution(
    node_execution_id: int,
    request: Request,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a node execution with results"""
    try:
        # Get request body
        node_data = await request.json()
        
        # Verify ownership through execution
        node_execution = db.query(NodeExecution).join(WorkflowExecution).filter(
            NodeExecution.id == node_execution_id,
            WorkflowExecution.user_id == current_user.user_id
        ).first()
        
        if not node_execution:
            raise HTTPException(status_code=404, detail="Node execution not found")
        
        # Update execution results
        node_execution.completed_at = datetime.utcnow()
        node_execution.status = node_data.get('status', 'completed')
        node_execution.error_message = node_data.get('error_message')
        node_execution.output_data = node_data.get('output_data')
        
        # Update node-specific results
        current_data = node_execution.node_specific_data or {}
        _update_node_specific_data(current_data, node_execution.node_type, node_data)
        
        # Remove None values and update
        current_data = {k: v for k, v in current_data.items() if v is not None}
        node_execution.node_specific_data = current_data if current_data else None
        
        db.commit()
        
        logger.info(f"Updated node execution {node_execution_id} with status {node_execution.status}")
        
        return {
            "success": True,
            "node_execution": {
                "id": node_execution.id,
                "execution_id": node_execution.execution_id,
                "node_id": node_execution.node_id,
                "node_type": node_execution.node_type,
                "status": node_execution.status,
                "started_at": node_execution.started_at.isoformat() if node_execution.started_at else None,
                "completed_at": node_execution.completed_at.isoformat() if node_execution.completed_at else None,
                "error_message": node_execution.error_message,
                "output_data": node_execution.output_data
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update node execution: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def _extract_node_specific_data(node_data: dict) -> dict:
    """Extract node-specific data based on node type"""
    node_specific_data = {}
    node_type = node_data['node_type']
    
    if node_type == 'webSource':
        node_specific_data = {
            'url': node_data.get('url'),
            'selectors': node_data.get('selectors'),
            'loop_config': node_data.get('loopConfig')
        }
    elif node_type == 'aiProcessor':
        node_specific_data = {
            'ai_prompt': node_data.get('ai_prompt'),
            'ai_model': node_data.get('ai_model', 'gpt-4o-mini')
        }
    elif node_type == 'linearRegression':
        node_specific_data = {
            'model_type': node_data.get('model_type', 'linear_regression'),
            'model_name': node_data.get('model_name'),
            'user_instructions': node_data.get('user_instructions'),
            'training_config': node_data.get('training_config')
        }
    elif node_type == 'randomForest':
        node_specific_data = {
            'model_type': node_data.get('model_type', 'random_forest'),
            'model_name': node_data.get('model_name'),
            'user_instructions': node_data.get('user_instructions'),
            'training_config': node_data.get('training_config')
        }
    elif node_type == 'httpRequest':
        node_specific_data = {
            'method': node_data.get('method', 'GET'),
            'url': node_data.get('url'),
            'auth_type': node_data.get('auth_type')
        }
    
    # Remove None values
    return {k: v for k, v in node_specific_data.items() if v is not None}

def _update_node_specific_data(current_data: dict, node_type: str, update_data: dict):
    """Update node-specific data based on node type"""
    if node_type == 'webSource':
        current_data['extracted_data'] = update_data.get('extracted_data')
    elif node_type == 'aiProcessor':
        current_data['ai_output'] = update_data.get('ai_output')
        current_data['ai_tokens_used'] = update_data.get('ai_tokens_used')
    elif node_type in ['linearRegression', 'randomForest']:
        output_data = update_data.get('output_data', {})
        if isinstance(output_data, dict):
            current_data['model_metrics'] = output_data.get('metrics')
            current_data['model_features'] = output_data.get('features')
            current_data['model_coefficients'] = output_data.get('coefficients')
            current_data['feature_importances'] = output_data.get('feature_importances')
            current_data['preprocessing_notes'] = output_data.get('preprocessing_notes')
        current_data['ai_tokens_used'] = update_data.get('ai_tokens_used')
    elif node_type == 'httpRequest':
        current_data['status_code'] = update_data.get('status_code')
        current_data['response_time'] = update_data.get('response_time')
        current_data['response_size'] = update_data.get('response_size')
        current_data['response_headers'] = update_data.get('response_headers')