from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from datetime import datetime
from ..models import WorkflowExecution, NodeExecution, ExecutionCreate, ExecutionResponse, NodeExecutionResponse
from ..models.workflow import AgentWorkflow
from ..database import get_db
from ..auth import get_current_user, AuthUser
from ..services.execution_service import ExecutionService
import logging

router = APIRouter(prefix="/v1", tags=["executions"])
logger = logging.getLogger(__name__)

@router.get("/executions/")
async def get_executions(
    agent_id: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get execution history for a specific agent (query parameter endpoint)"""
    executions = db.query(WorkflowExecution).filter(
        WorkflowExecution.agent_id == agent_id,
        WorkflowExecution.user_id == current_user.user_id
    ).order_by(WorkflowExecution.started_at.desc()).limit(20).all()
    
    return {
        "success": True,
        "executions": [execution.to_dict() for execution in executions]
    }

# Workflow execution endpoints
@router.post("/workflows/{workflow_id}/execute")
async def execute_workflow(
    workflow_id: int,
    execution_data: Dict[str, Any],
    background_tasks: BackgroundTasks,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Execute a workflow"""
    # Get workflow
    workflow = db.query(AgentWorkflow).filter(
        AgentWorkflow.id == workflow_id,
        AgentWorkflow.user_id == current_user.user_id
    ).first()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Create execution record
    execution = WorkflowExecution(
        agent_id=workflow.agent_id,
        user_id=current_user.user_id,
        workflow_nodes=workflow.nodes,
        workflow_edges=workflow.edges,
        status='running',
        api_version='v1'
    )
    
    db.add(execution)
    db.commit()
    db.refresh(execution)
    
    # Start execution in background
    execution_service = ExecutionService(db)
    background_tasks.add_task(
        execution_service.execute_workflow_async,
        execution.id,
        execution_data.get('inputs', {})
    )
    
    return {
        "success": True,
        "execution_id": execution.id,
        "status": "started"
    }

@router.get("/executions/{execution_id}/status")
async def get_execution_status(
    execution_id: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get execution status"""
    execution = db.query(WorkflowExecution).filter(
        WorkflowExecution.id == execution_id,
        WorkflowExecution.user_id == current_user.user_id
    ).first()
    
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    return {
        "execution_id": execution.id,
        "status": execution.status,
        "started_at": execution.started_at.isoformat() if execution.started_at else None,
        "completed_at": execution.completed_at.isoformat() if execution.completed_at else None,
        "error_message": execution.error_message
    }

@router.get("/executions/{execution_id}/results")
async def get_execution_results(
    execution_id: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get execution results"""
    execution = db.query(WorkflowExecution).filter(
        WorkflowExecution.id == execution_id,
        WorkflowExecution.user_id == current_user.user_id
    ).first()
    
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    # Get all node executions
    node_executions = db.query(NodeExecution).filter(
        NodeExecution.execution_id == execution_id
    ).all()
    
    results = {}
    for node_exec in node_executions:
        results[node_exec.node_id] = {
            "status": node_exec.status,
            "output_data": node_exec.output_data,
            "error_message": node_exec.error_message,
            "node_specific_data": node_exec.node_specific_data,
            "completed_at": node_exec.completed_at.isoformat() if node_exec.completed_at else None
        }
    
    return {
        "execution_id": execution.id,
        "status": execution.status,
        "results": results,
        "completed_at": execution.completed_at.isoformat() if execution.completed_at else None
    }

@router.get("/executions/{execution_id}/logs")
async def get_execution_logs(
    execution_id: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get execution logs"""
    execution = db.query(WorkflowExecution).filter(
        WorkflowExecution.id == execution_id,
        WorkflowExecution.user_id == current_user.user_id
    ).first()
    
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    # Get all node executions with their logs
    node_executions = db.query(NodeExecution).filter(
        NodeExecution.execution_id == execution_id
    ).order_by(NodeExecution.started_at).all()
    
    logs = []
    for node_exec in node_executions:
        logs.append({
            "timestamp": node_exec.started_at.isoformat() if node_exec.started_at else None,
            "node_id": node_exec.node_id,
            "node_type": node_exec.node_type,
            "status": node_exec.status,
            "message": f"Node {node_exec.node_id} ({node_exec.node_type}) {node_exec.status}",
            "error": node_exec.error_message
        })
    
    return {
        "execution_id": execution.id,
        "logs": logs
    }

@router.delete("/executions/{execution_id}")
async def delete_execution(
    execution_id: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an execution"""
    execution = db.query(WorkflowExecution).filter(
        WorkflowExecution.id == execution_id,
        WorkflowExecution.user_id == current_user.user_id
    ).first()
    
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    db.delete(execution)
    db.commit()
    
    return {"success": True}

# Legacy agent-based endpoints for backward compatibility
@router.get("/agents/{agent_id}/executions")
async def get_agent_executions(
    agent_id: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get execution history for a specific agent (legacy endpoint)"""
    executions = db.query(WorkflowExecution).filter(
        WorkflowExecution.agent_id == agent_id,
        WorkflowExecution.user_id == current_user.user_id
    ).order_by(WorkflowExecution.started_at.desc()).limit(20).all()
    
    return {
        "success": True,
        "executions": [execution.to_dict() for execution in executions]
    }

@router.post("/agents/{agent_id}/executions")
async def create_agent_execution(
    agent_id: int,
    execution_data: dict,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new workflow execution for an agent (legacy endpoint)"""
    execution = WorkflowExecution(
        agent_id=agent_id,
        user_id=current_user.user_id,
        workflow_nodes=execution_data.get('workflow_nodes', []),
        workflow_edges=execution_data.get('workflow_edges', []),
        status='running',
        api_version='v1'
    )
    
    db.add(execution)
    db.commit()
    db.refresh(execution)
    
    return {
        "success": True,
        "execution": execution.to_dict()
    }

@router.post("/executions/{execution_id}/nodes")
async def create_node_execution(
    execution_id: int,
    node_data: dict,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a node execution record (legacy endpoint)"""
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
        status='running'
    )
    
    # Set node-specific data
    node_specific_data = _extract_node_specific_data(node_data)
    node_execution.node_specific_data = node_specific_data if node_specific_data else None
    
    db.add(node_execution)
    db.commit()
    db.refresh(node_execution)
    
    return {
        "success": True,
        "node_execution": node_execution.to_dict()
    }

@router.put("/executions/nodes/{node_execution_id}")
async def update_node_execution(
    node_execution_id: int,
    node_data: dict,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a node execution with results (legacy endpoint)"""
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
    
    return {
        "success": True,
        "node_execution": node_execution.to_dict()
    }

@router.put("/executions/{execution_id}")
async def update_execution(
    execution_id: int,
    execution_data: dict,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update execution status (legacy endpoint)"""
    execution = db.query(WorkflowExecution).filter(
        WorkflowExecution.id == execution_id,
        WorkflowExecution.user_id == current_user.user_id
    ).first()
    
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    execution.completed_at = datetime.utcnow()
    execution.status = execution_data.get('status', 'completed')
    execution.error_message = execution_data.get('error_message')
    
    db.commit()
    
    return {
        "success": True,
        "execution": execution.to_dict()
    }

@router.get("/agents/{agent_id}/nodes/{node_id}/executions")
async def get_node_execution_history(
    agent_id: int,
    node_id: str,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get execution history for a specific node (legacy endpoint)"""
    node_executions = db.query(NodeExecution).join(WorkflowExecution).filter(
        NodeExecution.node_id == node_id,
        WorkflowExecution.agent_id == agent_id,
        WorkflowExecution.user_id == current_user.user_id
    ).order_by(NodeExecution.started_at.desc()).limit(50).all()
    
    logger.info(f"Found {len(node_executions)} executions for node {node_id}")
    
    return {
        "success": True,
        "executions": [execution.to_dict() for execution in node_executions]
    }

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
    elif node_type == 'linearRegression':
        output_data = update_data.get('output_data', {})
        if isinstance(output_data, dict):
            current_data['model_metrics'] = output_data.get('metrics')
            current_data['model_features'] = output_data.get('features')
            current_data['model_coefficients'] = output_data.get('coefficients')
            current_data['preprocessing_notes'] = output_data.get('preprocessing_notes')
        current_data['ai_tokens_used'] = update_data.get('ai_tokens_used')
    elif node_type == 'httpRequest':
        current_data['status_code'] = update_data.get('status_code')
        current_data['response_time'] = update_data.get('response_time')
        current_data['response_size'] = update_data.get('response_size')
        current_data['response_headers'] = update_data.get('response_headers')