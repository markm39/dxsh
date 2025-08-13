"""
Execution API endpoints for node executions
Handles individual node execution requests from the frontend
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import logging
import json
from datetime import datetime

from ..auth import get_current_user, AuthUser
from ..database import get_db
from ..models.execution import WorkflowExecution, NodeExecution

router = APIRouter(prefix="/api/v1/executions", tags=["executions-api"])
logger = logging.getLogger(__name__)

@router.post("/{execution_id}/nodes")
async def create_node_execution(
    execution_id: int,
    request: Request,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a node execution for a workflow execution
    """
    try:
        # Get request data
        request_data = await request.json()
        
        # Get the parent execution
        execution = db.query(WorkflowExecution).filter(
            WorkflowExecution.id == execution_id,
            WorkflowExecution.user_id == current_user.user_id
        ).first()
        
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")
        
        # Extract node execution data
        node_id = request_data.get('node_id')
        node_type = request_data.get('node_type')
        input_config = request_data.get('input_config', {})
        
        if not node_id or not node_type:
            raise HTTPException(status_code=400, detail="node_id and node_type are required")
        
        logger.info(f"Creating node execution for node {node_id} in execution {execution_id}")
        
        # Create node execution record
        node_execution = NodeExecution(
            execution_id=execution_id,
            node_id=node_id,
            node_type=node_type,
            input_config=input_config,
            status='pending',
            started_at=datetime.utcnow()
        )
        
        db.add(node_execution)
        db.commit()
        db.refresh(node_execution)
        
        logger.info(f"Created node execution {node_execution.id} for node {node_id}")
        
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
        raise HTTPException(status_code=500, detail=f"Failed to create node execution: {str(e)}")

@router.get("/{execution_id}/nodes")
async def get_node_executions(
    execution_id: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all node executions for a workflow execution
    """
    try:
        # Verify execution belongs to user
        execution = db.query(WorkflowExecution).filter(
            WorkflowExecution.id == execution_id,
            WorkflowExecution.user_id == current_user.user_id
        ).first()
        
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")
        
        # Get node executions
        node_executions = db.query(NodeExecution).filter(
            NodeExecution.execution_id == execution_id
        ).order_by(NodeExecution.started_at.desc()).all()
        
        execution_list = []
        for node_exec in node_executions:
            execution_list.append({
                "id": node_exec.id,
                "execution_id": node_exec.execution_id,
                "node_id": node_exec.node_id,
                "node_type": node_exec.node_type,
                "status": node_exec.status,
                "started_at": node_exec.started_at.isoformat() if node_exec.started_at else None,
                "completed_at": node_exec.completed_at.isoformat() if node_exec.completed_at else None,
                "error_message": node_exec.error_message,
                "output_data": node_exec.output_data
            })
        
        return {
            "success": True,
            "node_executions": execution_list,
            "total": len(execution_list)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get node executions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{execution_id}/nodes/{node_execution_id}")
async def get_node_execution_details(
    execution_id: int,
    node_execution_id: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed node execution results
    """
    try:
        # Verify execution belongs to user
        execution = db.query(WorkflowExecution).filter(
            WorkflowExecution.id == execution_id,
            WorkflowExecution.user_id == current_user.user_id
        ).first()
        
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")
        
        # Get node execution
        node_execution = db.query(NodeExecution).filter(
            NodeExecution.id == node_execution_id,
            NodeExecution.execution_id == execution_id
        ).first()
        
        if not node_execution:
            raise HTTPException(status_code=404, detail="Node execution not found")
        
        return {
            "success": True,
            "node_execution": {
                "id": node_execution.id,
                "execution_id": node_execution.execution_id,
                "node_id": node_execution.node_id,
                "node_type": node_execution.node_type,
                "status": node_execution.status,
                "input_config": node_execution.input_config,
                "output_data": node_execution.output_data,
                "error_message": node_execution.error_message,
                "node_specific_data": node_execution.node_specific_data,
                "started_at": node_execution.started_at.isoformat() if node_execution.started_at else None,
                "completed_at": node_execution.completed_at.isoformat() if node_execution.completed_at else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get node execution details: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{execution_id}/nodes/{node_execution_id}")
async def update_node_execution(
    execution_id: int,
    node_execution_id: int,
    request: Request,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update node execution status and results
    """
    try:
        # Get request data
        request_data = await request.json()
        
        # Verify execution belongs to user
        execution = db.query(WorkflowExecution).filter(
            WorkflowExecution.id == execution_id,
            WorkflowExecution.user_id == current_user.user_id
        ).first()
        
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")
        
        # Get node execution
        node_execution = db.query(NodeExecution).filter(
            NodeExecution.id == node_execution_id,
            NodeExecution.execution_id == execution_id
        ).first()
        
        if not node_execution:
            raise HTTPException(status_code=404, detail="Node execution not found")
        
        # Update node execution
        if 'status' in request_data:
            node_execution.status = request_data['status']
        if 'output_data' in request_data:
            node_execution.output_data = request_data['output_data']
        if 'error_message' in request_data:
            node_execution.error_message = request_data['error_message']
        if 'node_specific_data' in request_data:
            node_execution.node_specific_data = request_data['node_specific_data']
        
        # Set completion time if status is completed or failed
        if request_data.get('status') in ['completed', 'failed']:
            node_execution.completed_at = datetime.utcnow()
        
        db.commit()
        db.refresh(node_execution)
        
        return {
            "success": True,
            "node_execution": {
                "id": node_execution.id,
                "status": node_execution.status,
                "completed_at": node_execution.completed_at.isoformat() if node_execution.completed_at else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update node execution: {e}")
        raise HTTPException(status_code=500, detail=str(e))