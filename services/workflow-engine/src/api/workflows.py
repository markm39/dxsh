from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List
from ..models.workflow import AgentWorkflow, WorkflowNode, WorkflowCreate, WorkflowUpdate, WorkflowResponse
from ..models import WorkflowExecution, NodeExecution
from ..database import get_db
from ..auth import get_current_user, AuthUser
import logging

router = APIRouter(prefix="/v1/workflows", tags=["workflows"])
logger = logging.getLogger(__name__)

@router.get("/")
async def get_workflows(
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all workflows for the authenticated user"""
    workflows = db.query(AgentWorkflow).filter(
        AgentWorkflow.user_id == current_user.user_id
    ).order_by(AgentWorkflow.updated_at.desc()).all()
    
    # Return in the format the frontend expects
    return {
        "success": True,
        "agents": [WorkflowResponse.from_orm(workflow).dict() for workflow in workflows]
    }

@router.post("/")
async def create_workflow(
    workflow: WorkflowCreate,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new workflow"""
    # If no agent_id provided, auto-create an agent for this workflow
    agent_id = workflow.agent_id
    if agent_id is None:
        # For now, use a simple incrementing agent_id based on user workflows
        # In production, you might want to create actual agent records
        existing_count = db.query(AgentWorkflow).filter(
            AgentWorkflow.user_id == current_user.user_id
        ).count()
        agent_id = existing_count + 1
    
    db_workflow = AgentWorkflow(
        name=workflow.name,
        nodes=workflow.nodes,
        edges=workflow.edges,
        agent_id=agent_id,
        user_id=current_user.user_id,
        service_version="v1"
    )
    
    db.add(db_workflow)
    db.commit()
    db.refresh(db_workflow)
    
    # Return in the format the frontend expects
    return {
        "success": True,
        "agent": WorkflowResponse.from_orm(db_workflow).dict()
    }

@router.get("/{workflow_id}")
async def get_workflow(
    workflow_id: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific workflow"""
    workflow = db.query(AgentWorkflow).filter(
        AgentWorkflow.id == workflow_id,
        AgentWorkflow.user_id == current_user.user_id
    ).first()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    return {
        "success": True,
        "workflow": WorkflowResponse.from_orm(workflow).dict()
    }

@router.put("/{workflow_id}")
async def update_workflow(
    workflow_id: int,
    workflow_update: WorkflowUpdate,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a workflow"""
    workflow = db.query(AgentWorkflow).filter(
        AgentWorkflow.id == workflow_id,
        AgentWorkflow.user_id == current_user.user_id
    ).first()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Update fields if provided
    if workflow_update.name is not None:
        workflow.name = workflow_update.name
    if workflow_update.nodes is not None:
        workflow.nodes = workflow_update.nodes
        # Update individual workflow nodes
        _update_workflow_nodes(workflow, workflow_update.nodes, db)
    if workflow_update.edges is not None:
        workflow.edges = workflow_update.edges
    
    db.commit()
    db.refresh(workflow)
    
    return {
        "success": True,
        "workflow": WorkflowResponse.from_orm(workflow).dict()
    }

@router.delete("/{workflow_id}")
async def delete_workflow(
    workflow_id: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a workflow"""
    workflow = db.query(AgentWorkflow).filter(
        AgentWorkflow.id == workflow_id,
        AgentWorkflow.user_id == current_user.user_id
    ).first()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    db.delete(workflow)
    db.commit()
    
    return {"success": True}

# Legacy agent-based endpoints for backward compatibility
@router.get("/agents/{agent_id}/workflow")
async def get_agent_workflow(
    agent_id: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get workflow for a specific agent (legacy endpoint)"""
    workflow = db.query(AgentWorkflow).filter(
        AgentWorkflow.agent_id == agent_id,
        AgentWorkflow.user_id == current_user.user_id
    ).first()
    
    if not workflow:
        # Create default workflow for backward compatibility
        workflow = AgentWorkflow(
            agent_id=agent_id,
            user_id=current_user.user_id,
            name=f"Agent {agent_id} Workflow",
            nodes=[],
            edges=[],
            service_version="v1"
        )
        db.add(workflow)
        db.commit()
        db.refresh(workflow)
    
    logger.info(f"Retrieved workflow for agent {agent_id} with {len(workflow.nodes)} nodes")
    return WorkflowResponse.from_orm(workflow).dict()

@router.put("/agents/{agent_id}/workflow")
async def update_agent_workflow(
    agent_id: int,
    workflow_data: dict,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update workflow for a specific agent (legacy endpoint)"""
    workflow = db.query(AgentWorkflow).filter(
        AgentWorkflow.agent_id == agent_id,
        AgentWorkflow.user_id == current_user.user_id
    ).first()
    
    if not workflow:
        workflow = AgentWorkflow(
            agent_id=agent_id,
            user_id=current_user.user_id,
            name=f"Agent {agent_id} Workflow",
            service_version="v1"
        )
        db.add(workflow)
        db.flush()
    
    # Update workflow data
    if 'nodes' in workflow_data:
        logger.info(f"Updating workflow with {len(workflow_data['nodes'])} nodes")
        workflow.nodes = workflow_data['nodes']
        _update_workflow_nodes(workflow, workflow_data['nodes'], db)
    
    if 'edges' in workflow_data:
        workflow.edges = workflow_data['edges']
    
    if 'name' in workflow_data:
        workflow.name = workflow_data['name']
    
    db.commit()
    db.refresh(workflow)
    
    return WorkflowResponse.from_orm(workflow).dict()

@router.put("/agents/{agent_id}/workflow/nodes/{node_id}")
async def update_workflow_node(
    agent_id: int,
    node_id: str,
    node_data: dict,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a specific workflow node (legacy endpoint)"""
    workflow = db.query(AgentWorkflow).filter(
        AgentWorkflow.agent_id == agent_id,
        AgentWorkflow.user_id == current_user.user_id
    ).first()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Get node
    node = db.query(WorkflowNode).filter(
        WorkflowNode.id == node_id,
        WorkflowNode.workflow_id == workflow.id
    ).first()
    
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    # Update node data
    if 'data' in node_data:
        node.data = node_data['data']
    
    if 'configured' in node_data:
        node.configured = node_data['configured']
    
    if 'monitoring_job_id' in node_data:
        node.monitoring_job_id = node_data['monitoring_job_id']
    
    # Also update the workflow's nodes array
    workflow_nodes = workflow.nodes or []
    for i, workflow_node in enumerate(workflow_nodes):
        if workflow_node.get('id') == node_id:
            if 'data' in node_data:
                workflow_nodes[i]['data'] = node_data['data']
            break
    
    workflow.nodes = workflow_nodes
    db.commit()
    
    return {"success": True, "node": node.to_dict()}

@router.delete("/agents/{agent_id}/workflow/nodes/{node_id}")
async def delete_workflow_node(
    agent_id: int,
    node_id: str,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a workflow node (legacy endpoint)"""
    logger.info(f"🗑️ Backend: Deleting node {node_id} from agent {agent_id} for user {current_user.user_id}")
    
    workflow = db.query(AgentWorkflow).filter(
        AgentWorkflow.agent_id == agent_id,
        AgentWorkflow.user_id == current_user.user_id
    ).first()
    
    if not workflow:
        logger.error(f"🗑️ Backend: Workflow not found for agent {agent_id}")
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    logger.info(f"🗑️ Backend: Found workflow {workflow.id} with {len(workflow.nodes or [])} nodes")
    
    # Delete node record
    node = db.query(WorkflowNode).filter(
        WorkflowNode.id == node_id,
        WorkflowNode.workflow_id == workflow.id
    ).first()
    
    if node:
        logger.info(f"🗑️ Backend: Deleting WorkflowNode record for {node_id}")
        db.delete(node)
    else:
        logger.warning(f"🗑️ Backend: WorkflowNode record not found for {node_id}")
    
    # Remove from workflow nodes array
    workflow_nodes = workflow.nodes or []
    original_count = len(workflow_nodes)
    workflow.nodes = [n for n in workflow_nodes if n.get('id') != node_id]
    new_count = len(workflow.nodes)
    
    logger.info(f"🗑️ Backend: Removed from nodes JSON array: {original_count} -> {new_count}")
    
    # Remove from workflow edges array
    workflow_edges = workflow.edges or []
    original_edge_count = len(workflow_edges)
    workflow.edges = [
        e for e in workflow_edges 
        if e.get('source') != node_id and e.get('target') != node_id
    ]
    new_edge_count = len(workflow.edges)
    
    logger.info(f"🗑️ Backend: Removed from edges JSON array: {original_edge_count} -> {new_edge_count}")
    
    db.commit()
    logger.info(f"🗑️ Backend: Database commit completed for node {node_id}")
    
    return {"success": True}

@router.delete("/{workflow_id}/nodes/{node_id}")
async def delete_workflow_node_by_id(
    workflow_id: int,
    node_id: str,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a workflow node by workflow ID (new API)"""
    logger.info(f"🗑️ Backend: Deleting node {node_id} from workflow {workflow_id} for user {current_user.user_id}")
    
    workflow = db.query(AgentWorkflow).filter(
        AgentWorkflow.id == workflow_id,
        AgentWorkflow.user_id == current_user.user_id
    ).first()
    
    if not workflow:
        logger.error(f"🗑️ Backend: Workflow not found for id {workflow_id}")
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    logger.info(f"🗑️ Backend: Found workflow {workflow.id} with {len(workflow.nodes or [])} nodes")
    
    # Delete node record
    node = db.query(WorkflowNode).filter(
        WorkflowNode.id == node_id,
        WorkflowNode.workflow_id == workflow.id
    ).first()
    
    if node:
        logger.info(f"🗑️ Backend: Deleting WorkflowNode record for {node_id}")
        db.delete(node)
    else:
        logger.warning(f"🗑️ Backend: WorkflowNode record not found for {node_id}")
    
    # Remove from workflow nodes array
    workflow_nodes = workflow.nodes or []
    original_count = len(workflow_nodes)
    workflow.nodes = [n for n in workflow_nodes if n.get('id') != node_id]
    new_count = len(workflow.nodes)
    
    logger.info(f"🗑️ Backend: Removed from nodes JSON array: {original_count} -> {new_count}")
    
    # Remove from workflow edges array
    workflow_edges = workflow.edges or []
    original_edge_count = len(workflow_edges)
    workflow.edges = [
        e for e in workflow_edges 
        if e.get('source') != node_id and e.get('target') != node_id
    ]
    new_edge_count = len(workflow.edges)
    
    logger.info(f"🗑️ Backend: Removed from edges JSON array: {original_edge_count} -> {new_edge_count}")
    
    db.commit()
    logger.info(f"🗑️ Backend: Database commit completed for node {node_id}")
    
    return {"success": True}

def _update_workflow_nodes(workflow: AgentWorkflow, nodes: List[dict], db: Session):
    """Update individual workflow node records"""
    for node_data in nodes:
        # Get or create workflow node
        node = db.query(WorkflowNode).filter(
            WorkflowNode.id == node_data['id'],
            WorkflowNode.workflow_id == workflow.id
        ).first()
        
        if not node:
            node = WorkflowNode(
                id=node_data['id'],
                workflow_id=workflow.id,
                node_type=node_data.get('type', 'unknown'),
                position_x=node_data.get('position', {}).get('x', 0),
                position_y=node_data.get('position', {}).get('y', 0),
                data=node_data.get('data', {}),
                configured=node_data.get('data', {}).get('configured', False)
            )
            db.add(node)
        else:
            # Update existing node
            node.node_type = node_data.get('type', node.node_type)
            node.position_x = node_data.get('position', {}).get('x', node.position_x)
            node.position_y = node_data.get('position', {}).get('y', node.position_y)
            node.data = node_data.get('data', node.data)
            node.configured = node_data.get('data', {}).get('configured', node.configured)