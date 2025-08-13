"""
Dashboard API Endpoints - FastAPI version

Manages dashboards and widgets, including connections to workflow nodes
Adapted from Flask backend to FastAPI microservice architecture
"""

from fastapi import APIRouter, Depends, HTTPException, status, Response, Header
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
import ipaddress
import fnmatch

from ..database import get_db
from ..models.dashboard import Dashboard, DashboardWidget, EmbedToken
from ..services.workflow_client import WorkflowClient
from ..auth import get_current_user_id, get_current_user


router = APIRouter()
workflow_client = WorkflowClient()


# Pydantic models for request/response
class DashboardCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    display_settings: Optional[dict] = None


class DashboardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    display_settings: Optional[dict] = None


class WidgetCreate(BaseModel):
    type: str
    title: str
    description: Optional[str] = ""
    position: dict
    agent_id: Optional[int] = None
    node_id: Optional[str] = None
    config: Optional[dict] = None
    refresh_on_workflow_complete: Optional[bool] = True
    refresh_interval: Optional[int] = None


class WidgetUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    position: Optional[dict] = None
    agent_id: Optional[int] = None
    node_id: Optional[str] = None
    config: Optional[dict] = None
    refresh_on_workflow_complete: Optional[bool] = None
    refresh_interval: Optional[int] = None


class EmbedTokenCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    dashboard_id: Optional[int] = None
    widget_id: Optional[int] = None
    expires_in_days: Optional[int] = None  # null = never expires
    allowed_domains: Optional[List[str]] = []
    allowed_ips: Optional[List[str]] = []
    max_usage: Optional[int] = None  # null = unlimited


class EmbedTokenUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    expires_in_days: Optional[int] = None
    allowed_domains: Optional[List[str]] = None
    allowed_ips: Optional[List[str]] = None
    max_usage: Optional[int] = None


@router.get("/dashboards")
async def get_dashboards(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get all dashboards for the current user"""
    dashboards = db.query(Dashboard).filter(Dashboard.user_id == current_user_id).all()
    
    return {
        'success': True,
        'data': [dashboard.to_dict() for dashboard in dashboards]
    }


@router.post("/dashboards")
async def create_dashboard(
    dashboard_data: DashboardCreate,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Create a new dashboard"""
    # Create dashboard
    dashboard = Dashboard(
        user_id=current_user_id,
        name=dashboard_data.name,
        description=dashboard_data.description,
        display_settings=dashboard_data.display_settings or {
            'showWidgetHeaders': True,
            'showWidgetFooters': True,
            'compactMode': False,
            'theme': 'default'
        }
    )
    
    db.add(dashboard)
    db.commit()
    db.refresh(dashboard)
    
    return {
        'success': True,
        'data': dashboard.to_dict()
    }


@router.get("/dashboards/{dashboard_id}")
async def get_dashboard(
    dashboard_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get a specific dashboard"""
    dashboard = db.query(Dashboard).filter(
        Dashboard.id == dashboard_id,
        Dashboard.user_id == current_user_id
    ).first()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    return {
        'success': True,
        'data': dashboard.to_dict()
    }


@router.put("/dashboards/{dashboard_id}")
async def update_dashboard(
    dashboard_id: int,
    dashboard_data: DashboardUpdate,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Update a dashboard"""
    dashboard = db.query(Dashboard).filter(
        Dashboard.id == dashboard_id,
        Dashboard.user_id == current_user_id
    ).first()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    # Update fields
    if dashboard_data.name is not None:
        dashboard.name = dashboard_data.name
    if dashboard_data.description is not None:
        dashboard.description = dashboard_data.description
    if dashboard_data.display_settings is not None:
        dashboard.display_settings = dashboard_data.display_settings
    
    dashboard.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(dashboard)
    
    return {
        'success': True,
        'data': dashboard.to_dict()
    }


@router.delete("/dashboards/{dashboard_id}")
async def delete_dashboard(
    dashboard_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Delete a dashboard"""
    dashboard = db.query(Dashboard).filter(
        Dashboard.id == dashboard_id,
        Dashboard.user_id == current_user_id
    ).first()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    db.delete(dashboard)
    db.commit()
    
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/dashboards/{dashboard_id}/widgets")
async def create_widget(
    dashboard_id: int,
    widget_data: WidgetCreate,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Create a widget in a dashboard"""
    # Verify dashboard ownership
    dashboard = db.query(Dashboard).filter(
        Dashboard.id == dashboard_id,
        Dashboard.user_id == current_user_id
    ).first()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    # Validate workflow connection if provided
    if widget_data.agent_id and widget_data.node_id:
        try:
            agent = await workflow_client.get_workflow_agent(widget_data.agent_id)
            if not agent:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Workflow agent not found"
                )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error validating workflow connection: {str(e)}"
            )
    
    # Create widget
    widget = DashboardWidget(
        dashboard_id=dashboard_id,
        type=widget_data.type,
        title=widget_data.title,
        description=widget_data.description,
        position=widget_data.position,
        agent_id=widget_data.agent_id,
        node_id=widget_data.node_id,
        config=widget_data.config or {},
        refresh_on_workflow_complete=widget_data.refresh_on_workflow_complete,
        refresh_interval=widget_data.refresh_interval
    )
    
    db.add(widget)
    db.commit()
    db.refresh(widget)
    
    return {
        'success': True,
        'data': widget.to_dict()
    }


@router.put("/dashboards/{dashboard_id}/widgets/{widget_id}")
async def update_widget(
    dashboard_id: int,
    widget_id: int,
    widget_data: WidgetUpdate,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Update a widget"""
    # Verify dashboard ownership and widget exists
    widget = db.query(DashboardWidget).join(Dashboard).filter(
        DashboardWidget.id == widget_id,
        DashboardWidget.dashboard_id == dashboard_id,
        Dashboard.user_id == current_user_id
    ).first()
    
    if not widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found"
        )
    
    # Update fields
    if widget_data.title is not None:
        widget.title = widget_data.title
    if widget_data.description is not None:
        widget.description = widget_data.description
    if widget_data.position is not None:
        widget.position = widget_data.position
    if widget_data.agent_id is not None:
        widget.agent_id = widget_data.agent_id
    if widget_data.node_id is not None:
        widget.node_id = widget_data.node_id
    if widget_data.config is not None:
        widget.config = widget_data.config
    if widget_data.refresh_on_workflow_complete is not None:
        widget.refresh_on_workflow_complete = widget_data.refresh_on_workflow_complete
    if widget_data.refresh_interval is not None:
        widget.refresh_interval = widget_data.refresh_interval
    
    widget.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(widget)
    
    return {
        'success': True,
        'data': widget.to_dict()
    }


@router.delete("/dashboards/{dashboard_id}/widgets/{widget_id}")
async def delete_widget(
    dashboard_id: int,
    widget_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Delete a widget"""
    # Verify dashboard ownership and widget exists
    widget = db.query(DashboardWidget).join(Dashboard).filter(
        DashboardWidget.id == widget_id,
        DashboardWidget.dashboard_id == dashboard_id,
        Dashboard.user_id == current_user_id
    ).first()
    
    if not widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found"
        )
    
    db.delete(widget)
    db.commit()
    
    return {'success': True}


@router.get("/dashboards/{dashboard_id}/widgets/{widget_id}/data")
async def get_widget_data(
    dashboard_id: int,
    widget_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    """Get data for a specific widget"""
    current_user_id = int(current_user.user_id)
    
    # Verify dashboard ownership and widget exists
    widget = db.query(DashboardWidget).join(Dashboard).filter(
        DashboardWidget.id == widget_id,
        DashboardWidget.dashboard_id == dashboard_id,
        Dashboard.user_id == current_user_id
    ).first()
    
    if not widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found"
        )
    
    # If widget is connected to a workflow node, get fresh data
    if widget.agent_id and widget.node_id:
        try:
            # Extract token from authorization header
            auth_token = None
            if authorization and authorization.startswith("Bearer "):
                auth_token = authorization.split(" ")[1]
            
            node_data = await workflow_client.get_node_execution_data(
                widget.agent_id, 
                widget.node_id,
                auth_token=auth_token
            )
            
            if node_data:
                # Update cached data
                widget.update_cached_data(node_data, db)
                
                return {
                    'success': True,
                    'data': node_data,
                    'cached': False,
                    'lastUpdated': widget.last_updated.isoformat() if widget.last_updated else None
                }
                
        except Exception as e:
            # If we can't get fresh data, fall back to cached data
            pass
    
    # Return cached data
    return {
        'success': True,
        'data': widget.cached_data,
        'cached': True,
        'lastUpdated': widget.last_updated.isoformat() if widget.last_updated else None
    }


# Add missing endpoints that tests expect

@router.get("/dashboards/{dashboard_id}/widgets")
async def get_dashboard_widgets(
    dashboard_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get all widgets for a dashboard"""
    # Verify dashboard ownership
    dashboard = db.query(Dashboard).filter(
        Dashboard.id == dashboard_id,
        Dashboard.user_id == current_user_id
    ).first()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    widgets = db.query(DashboardWidget).filter(
        DashboardWidget.dashboard_id == dashboard_id
    ).all()
    
    return [widget.to_dict() for widget in widgets]


@router.get("/widgets/{widget_id}")
async def get_widget(
    widget_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get a specific widget"""
    widget = db.query(DashboardWidget).join(Dashboard).filter(
        DashboardWidget.id == widget_id,
        Dashboard.user_id == current_user_id
    ).first()
    
    if not widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found"
        )
    
    return widget.to_dict()


@router.put("/widgets/{widget_id}")
async def update_widget_direct(
    widget_id: int,
    widget_data: WidgetUpdate,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Update a widget directly by ID"""
    widget = db.query(DashboardWidget).join(Dashboard).filter(
        DashboardWidget.id == widget_id,
        Dashboard.user_id == current_user_id
    ).first()
    
    if not widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found"
        )
    
    # Update fields
    if widget_data.title is not None:
        widget.title = widget_data.title
    if widget_data.description is not None:
        widget.description = widget_data.description
    if widget_data.position is not None:
        widget.position = widget_data.position
    if widget_data.agent_id is not None:
        widget.agent_id = widget_data.agent_id
    if widget_data.node_id is not None:
        widget.node_id = widget_data.node_id
    if widget_data.config is not None:
        widget.config = widget_data.config
    if widget_data.refresh_on_workflow_complete is not None:
        widget.refresh_on_workflow_complete = widget_data.refresh_on_workflow_complete
    if widget_data.refresh_interval is not None:
        widget.refresh_interval = widget_data.refresh_interval
    
    widget.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(widget)
    
    return widget.to_dict()


@router.delete("/widgets/{widget_id}")
async def delete_widget_direct(
    widget_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Delete a widget directly by ID"""
    widget = db.query(DashboardWidget).join(Dashboard).filter(
        DashboardWidget.id == widget_id,
        Dashboard.user_id == current_user_id
    ).first()
    
    if not widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found"
        )
    
    db.delete(widget)
    db.commit()
    
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/widgets/available-nodes")
async def get_available_nodes(
    current_user_id: int = Depends(get_current_user_id)
):
    """Get available workflow nodes for widget connections"""
    try:
        agents = await workflow_client.get_user_workflow_agents(current_user_id)
        return {
            'success': True,
            'data': agents
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching workflow nodes: {str(e)}"
        )


# ==========================================
# EMBED TOKEN ENDPOINTS
# ==========================================

@router.post("/dashboards/{dashboard_id}/embed-tokens")
async def create_dashboard_embed_token(
    dashboard_id: int,
    token_data: EmbedTokenCreate,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Create an embed token for a dashboard"""
    # Verify dashboard ownership
    dashboard = db.query(Dashboard).filter(
        Dashboard.id == dashboard_id,
        Dashboard.user_id == current_user_id
    ).first()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    # Calculate expiration date
    expires_at = None
    if token_data.expires_in_days:
        expires_at = datetime.utcnow() + timedelta(days=token_data.expires_in_days)
    
    # Create embed token
    embed_token = EmbedToken(
        token=EmbedToken.generate_token(),
        name=token_data.name,
        description=token_data.description,
        dashboard_id=dashboard_id,
        expires_at=expires_at,
        allowed_domains=token_data.allowed_domains or [],
        allowed_ips=token_data.allowed_ips or [],
        max_usage=token_data.max_usage,
        created_by=current_user_id
    )
    
    db.add(embed_token)
    db.commit()
    db.refresh(embed_token)
    
    return {
        'success': True,
        'data': embed_token.to_dict()
    }


@router.post("/widgets/{widget_id}/embed-tokens")
async def create_widget_embed_token(
    widget_id: int,
    token_data: EmbedTokenCreate,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Create an embed token for a widget"""
    # Verify widget ownership
    widget = db.query(DashboardWidget).join(Dashboard).filter(
        DashboardWidget.id == widget_id,
        Dashboard.user_id == current_user_id
    ).first()
    
    if not widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found"
        )
    
    # Calculate expiration date
    expires_at = None
    if token_data.expires_in_days:
        expires_at = datetime.utcnow() + timedelta(days=token_data.expires_in_days)
    
    # Create embed token
    embed_token = EmbedToken(
        token=EmbedToken.generate_token(),
        name=token_data.name,
        description=token_data.description,
        widget_id=widget_id,
        expires_at=expires_at,
        allowed_domains=token_data.allowed_domains or [],
        allowed_ips=token_data.allowed_ips or [],
        max_usage=token_data.max_usage,
        created_by=current_user_id
    )
    
    db.add(embed_token)
    db.commit()
    db.refresh(embed_token)
    
    return {
        'success': True,
        'data': embed_token.to_dict()
    }


@router.get("/embed-tokens")
async def get_embed_tokens(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get all embed tokens created by the current user"""
    tokens = db.query(EmbedToken).filter(EmbedToken.created_by == current_user_id).all()
    
    return {
        'success': True,
        'data': [token.to_dict() for token in tokens]
    }


@router.get("/embed-tokens/{token_id}")
async def get_embed_token(
    token_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get a specific embed token"""
    token = db.query(EmbedToken).filter(
        EmbedToken.id == token_id,
        EmbedToken.created_by == current_user_id
    ).first()
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Embed token not found"
        )
    
    return {
        'success': True,
        'data': token.to_dict()
    }


@router.put("/embed-tokens/{token_id}")
async def update_embed_token(
    token_id: int,
    token_data: EmbedTokenUpdate,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Update an embed token"""
    token = db.query(EmbedToken).filter(
        EmbedToken.id == token_id,
        EmbedToken.created_by == current_user_id
    ).first()
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Embed token not found"
        )
    
    # Update fields
    if token_data.name is not None:
        token.name = token_data.name
    if token_data.description is not None:
        token.description = token_data.description
    if token_data.expires_in_days is not None:
        if token_data.expires_in_days:
            token.expires_at = datetime.utcnow() + timedelta(days=token_data.expires_in_days)
        else:
            token.expires_at = None
    if token_data.allowed_domains is not None:
        token.allowed_domains = token_data.allowed_domains
    if token_data.allowed_ips is not None:
        token.allowed_ips = token_data.allowed_ips
    if token_data.max_usage is not None:
        token.max_usage = token_data.max_usage
    
    token.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(token)
    
    return {
        'success': True,
        'data': token.to_dict()
    }


@router.delete("/embed-tokens/{token_id}")
async def delete_embed_token(
    token_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Delete an embed token"""
    token = db.query(EmbedToken).filter(
        EmbedToken.id == token_id,
        EmbedToken.created_by == current_user_id
    ).first()
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Embed token not found"
        )
    
    db.delete(token)
    db.commit()
    
    return Response(status_code=status.HTTP_204_NO_CONTENT)