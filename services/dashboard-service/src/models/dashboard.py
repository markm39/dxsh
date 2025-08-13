"""
Dashboard and Widget Models for Dashboard Service

Models for dashboard management and widget-node connections
Adapted for microservice architecture with external service references
"""

from datetime import datetime, timedelta
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, JSON, Boolean, Index, ARRAY
from sqlalchemy.orm import relationship
from ..database import Base
import secrets
import string


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


class EmbedToken(Base):
    """Embed token model - provides secure access to embedded dashboards/widgets"""
    __tablename__ = 'embed_tokens'
    
    id = Column(Integer, primary_key=True)
    token = Column(String(255), unique=True, nullable=False)
    
    # What this token provides access to (either dashboard or widget, not both)
    dashboard_id = Column(Integer, ForeignKey('dashboards.id'), nullable=True)
    widget_id = Column(Integer, ForeignKey('dashboard_widgets.id'), nullable=True)
    
    # Token metadata
    name = Column(String(255))  # User-friendly name for the token
    description = Column(Text)
    
    # Security settings
    expires_at = Column(DateTime, nullable=True)  # null = never expires
    allowed_domains = Column(JSON, default=[])  # ['*.example.com', 'app.mysite.com']
    allowed_ips = Column(JSON, default=[])  # ['192.168.1.0/24', '10.0.0.1']
    
    # Usage tracking
    usage_count = Column(Integer, default=0)
    max_usage = Column(Integer, nullable=True)  # null = unlimited
    last_used_at = Column(DateTime, nullable=True)
    
    # Creation metadata
    created_by = Column(Integer, nullable=False)  # User ID who created this token
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    dashboard = relationship('Dashboard', backref='embed_tokens')
    widget = relationship('DashboardWidget', backref='embed_tokens')
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_embed_token', 'token'),
        Index('idx_embed_dashboard', 'dashboard_id'),
        Index('idx_embed_widget', 'widget_id'),
        Index('idx_embed_creator', 'created_by'),
    )
    
    @classmethod
    def generate_token(cls, length=32):
        """Generate a secure random token"""
        alphabet = string.ascii_letters + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(length))
    
    def is_expired(self):
        """Check if token is expired"""
        if not self.expires_at:
            return False
        return datetime.utcnow() > self.expires_at
    
    def is_usage_exceeded(self):
        """Check if token usage limit is exceeded"""
        if not self.max_usage:
            return False
        return self.usage_count >= self.max_usage
    
    def is_valid(self):
        """Check if token is valid (not expired and not usage exceeded)"""
        return not self.is_expired() and not self.is_usage_exceeded()
    
    def increment_usage(self, session):
        """Increment usage count and update last used timestamp"""
        self.usage_count += 1
        self.last_used_at = datetime.utcnow()
        session.commit()
    
    def to_dict(self):
        """Convert embed token to dictionary"""
        return {
            'id': self.id,
            'token': self.token,
            'name': self.name,
            'description': self.description,
            'dashboard_id': self.dashboard_id,
            'widget_id': self.widget_id,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'allowed_domains': self.allowed_domains or [],
            'allowed_ips': self.allowed_ips or [],
            'usage_count': self.usage_count,
            'max_usage': self.max_usage,
            'last_used_at': self.last_used_at.isoformat() if self.last_used_at else None,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'is_valid': self.is_valid(),
            'is_expired': self.is_expired(),
            'is_usage_exceeded': self.is_usage_exceeded()
        }