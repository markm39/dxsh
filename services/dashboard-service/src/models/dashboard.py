"""
Dashboard and Widget Models for Dashboard Service

Models for dashboard management and widget-node connections
Adapted for microservice architecture with external service references
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, JSON, Boolean, Index
from sqlalchemy.orm import relationship
from ..database import Base


class Dashboard(Base):
    """Dashboard model - represents a collection of widgets"""
    __tablename__ = 'dashboards'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)  # Reference to user service
    name = Column(String(255), nullable=False)
    description = Column(Text)
    
    # Display settings for all widgets in this dashboard
    display_settings = Column(JSON, default={
        'showWidgetHeaders': True,
        'showWidgetFooters': True,
        'compactMode': False,
        'theme': 'default'
    })
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    widgets = relationship('DashboardWidget', backref='dashboard', cascade='all, delete-orphan')
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_dashboard_user', 'user_id'),
    )
    
    def to_dict(self):
        """Convert dashboard to dictionary"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'description': self.description,
            'display_settings': self.display_settings or {
                'showWidgetHeaders': True,
                'showWidgetFooters': True,
                'compactMode': False,
                'theme': 'default'
            },
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'widgets': [widget.to_dict() for widget in self.widgets]
        }


class DashboardWidget(Base):
    """Dashboard Widget model - represents a widget connected to a workflow node"""
    __tablename__ = 'dashboard_widgets'
    
    id = Column(Integer, primary_key=True)
    dashboard_id = Column(Integer, ForeignKey('dashboards.id'), nullable=False)
    
    # Widget configuration
    type = Column(String(50), nullable=False)  # chart, metric, table, etc.
    title = Column(String(255), nullable=False)
    description = Column(Text)
    
    # Position and layout
    position = Column(JSON, nullable=False, default={
        'x': 0, 'y': 0, 'w': 6, 'h': 4
    })
    
    # Connection to workflow node (references to workflow-engine service)
    agent_id = Column(Integer)  # Reference to workflow agent in workflow-engine service
    node_id = Column(String(255))  # Node ID within the workflow
    
    # Widget-specific configuration
    config = Column(JSON, default={})
    
    # Data settings
    refresh_on_workflow_complete = Column(Boolean, default=True)
    refresh_interval = Column(Integer)  # In seconds, null means no auto-refresh
    
    # Cached data from last execution
    cached_data = Column(JSON)
    last_updated = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_widget_dashboard', 'dashboard_id'),
        Index('idx_widget_agent_node', 'agent_id', 'node_id'),
    )
    
    def to_dict(self):
        """Convert widget to dictionary"""
        # Get display settings from config, with defaults
        show_header = self.config.get('showHeader', True) if self.config else True
        show_footer = self.config.get('showFooter', True) if self.config else True
        
        return {
            'id': self.id,
            'dashboard_id': self.dashboard_id,
            'type': self.type,
            'title': self.title,
            'description': self.description,
            'position': self.position,
            'showHeader': show_header,
            'showFooter': show_footer,
            'dataSource': {
                'agentId': self.agent_id,
                'nodeId': self.node_id,
                'refreshOnWorkflowComplete': self.refresh_on_workflow_complete,
                'refreshInterval': self.refresh_interval
            } if self.agent_id else None,
            'config': self.config,
            'cachedData': self.cached_data,
            'lastUpdated': self.last_updated.isoformat() if self.last_updated else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def update_cached_data(self, data, session):
        """Update the cached data for this widget"""
        self.cached_data = data
        self.last_updated = datetime.utcnow()
        session.commit()