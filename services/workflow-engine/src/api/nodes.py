from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..models import NodeExecution, WorkflowExecution
from ..database import get_db
from ..auth import get_current_user, AuthUser
import logging

router = APIRouter(prefix="/v1/nodes", tags=["nodes"])
logger = logging.getLogger(__name__)

@router.get("/{agent_id}/{node_id}/output")
async def get_node_output(
    agent_id: int,
    node_id: str,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the latest output data for a specific workflow node"""
    # Get the latest node execution for this agent and node
    node_execution = db.query(NodeExecution).join(WorkflowExecution).filter(
        NodeExecution.node_id == node_id,
        WorkflowExecution.agent_id == agent_id,
        WorkflowExecution.user_id == current_user.user_id,
        NodeExecution.status == 'completed'
    ).order_by(NodeExecution.completed_at.desc()).first()
    
    if not node_execution:
        raise HTTPException(status_code=404, detail="No execution data found for this node")
    
    if not node_execution.output_data:
        return {
            "success": True,
            "data": None,
            "message": "Node executed but produced no output data"
        }
    
    return {
        "success": True,
        "data": node_execution.output_data,
        "last_executed": node_execution.completed_at.isoformat() if node_execution.completed_at else None,
        "execution_id": node_execution.execution_id
    }