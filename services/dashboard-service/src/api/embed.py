"""
Embed API endpoints for dashboard service

Public endpoints for embedding dashboards/widgets in iframes
No authentication required for read-only access
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
import logging

from ..database import get_db
from ..models.dashboard import Dashboard, DashboardWidget
from ..services.workflow_client import WorkflowClient

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize workflow client
workflow_client = WorkflowClient()

@router.get("/embed/dashboards/{dashboard_id}")
async def get_embedded_dashboard(
    dashboard_id: int,
    db: Session = Depends(get_db)
):
    """Get dashboard for embedding (public access)"""
    try:
        dashboard = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")
            
        return {
            "id": dashboard.id,
            "name": dashboard.name,
            "display_settings": dashboard.display_settings,
            "created_at": dashboard.created_at.isoformat() if dashboard.created_at else None,
            "updated_at": dashboard.updated_at.isoformat() if dashboard.updated_at else None
        }
        
    except Exception as e:
        logger.error(f"Error getting embedded dashboard {dashboard_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/embed/dashboards/{dashboard_id}/widgets")
async def get_embedded_dashboard_widgets(
    dashboard_id: int,
    db: Session = Depends(get_db)
):
    """Get dashboard widgets for embedding (public access)"""
    try:
        # Verify dashboard exists
        dashboard = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")
            
        widgets = db.query(DashboardWidget).filter(
            DashboardWidget.dashboard_id == dashboard_id
        ).all()
        
        return [{
            "id": widget.id,
            "dashboard_id": widget.dashboard_id,
            "agent_id": widget.agent_id,
            "node_id": widget.node_id,
            "widget_type": widget.type,  # Use 'type' field from model
            "widget_config": widget.config,  # Use 'config' field from model
            "position": widget.position,
            "size": widget.position,  # Model doesn't have 'size', use position for now
            "created_at": widget.created_at.isoformat() if widget.created_at else None,
            "updated_at": widget.updated_at.isoformat() if widget.updated_at else None
        } for widget in widgets]
        
    except Exception as e:
        logger.error(f"Error getting embedded dashboard widgets for {dashboard_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/embed/widgets/{widget_id}/data")
async def get_embedded_widget_data(
    widget_id: int,
    db: Session = Depends(get_db)
):
    """Get widget data for embedding (public access)"""
    try:
        widget = db.query(DashboardWidget).filter(DashboardWidget.id == widget_id).first()
        if not widget:
            raise HTTPException(status_code=404, detail="Widget not found")
            
        # Get node execution data from workflow service
        node_data = await workflow_client.get_node_execution_data(
            widget.agent_id, 
            widget.node_id
        )
        
        return {
            "widget_id": widget.id,
            "widget_type": widget.type,  # Use 'type' field from model
            "widget_config": widget.config,  # Use 'config' field from model
            "data": node_data,
            "last_updated": widget.updated_at.isoformat() if widget.updated_at else None
        }
        
    except Exception as e:
        logger.error(f"Error getting embedded widget data for {widget_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/embed/dashboards/{dashboard_id}/preview")
async def get_dashboard_preview(
    dashboard_id: int,
    width: Optional[int] = Query(800, description="Preview width in pixels"),
    height: Optional[int] = Query(600, description="Preview height in pixels"),
    db: Session = Depends(get_db)
):
    """Get dashboard preview data for embedding"""
    try:
        # Get dashboard info
        dashboard = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")
            
        # Get all widgets for this dashboard
        widgets = db.query(DashboardWidget).filter(
            DashboardWidget.dashboard_id == dashboard_id
        ).all()
        
        # Build preview data
        preview_data = {
            "dashboard": {
                "id": dashboard.id,
                "name": dashboard.name,
                "display_settings": dashboard.display_settings
            },
            "widgets": [],
            "preview_settings": {
                "width": width,
                "height": height,
                "responsive": True
            }
        }
        
        # Add widget previews (without data to keep response fast)
        for widget in widgets:
            preview_data["widgets"].append({
                "id": widget.id,
                "widget_type": widget.type,  # Use 'type' field from model
                "widget_config": widget.config,  # Use 'config' field from model
                "position": widget.position,
                "size": widget.position,  # Model doesn't have separate size field
                "data_available": bool(widget.agent_id and widget.node_id)
            })
            
        return preview_data
        
    except Exception as e:
        logger.error(f"Error getting dashboard preview for {dashboard_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")