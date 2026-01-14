from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

# Import base from main database module to avoid conflicts
from ..database import Base

class AgentWorkflow(Base):
    __tablename__ = 'agent_workflows'

    id = Column(Integer, primary_key=True)
    agent_id = Column(Integer, nullable=False)  # Removed FK constraint for now
    user_id = Column(Integer, nullable=False)  # User identifier from JWT auth

    # Workflow data
    name = Column(String(255), nullable=False, default='Workflow')
    nodes = Column(JSON, nullable=False, default=list)  # React Flow nodes
    edges = Column(JSON, nullable=False, default=list)  # React Flow edges

    # Service versioning
    service_version = Column(String(10), default='v1')

    # Metadata
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    workflow_nodes = relationship("WorkflowNode", back_populates="workflow", cascade="all, delete-orphan")
    # Removed schedules relationship due to SQLite FK constraints
    
    def to_dict(self):
        return {
            'id': self.id,
            'agent_id': self.agent_id,
            'user_id': self.user_id,
            'name': self.name,
            'nodes': self.nodes,
            'edges': self.edges,
            'service_version': self.service_version,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class WorkflowNode(Base):
    __tablename__ = 'workflow_nodes'
    
    id = Column(String(255), primary_key=True)  # React Flow node ID
    workflow_id = Column(Integer, ForeignKey('agent_workflows.id'), nullable=False)
    
    # Node data
    node_type = Column(String(50), nullable=False)  # 'webSource', 'action', etc.
    position_x = Column(Float, nullable=False)
    position_y = Column(Float, nullable=False)
    data = Column(JSON, nullable=False, default=dict)  # Node-specific data
    
    # Configuration
    configured = Column(Boolean, default=False)
    monitoring_job_id = Column(Integer, nullable=True)  # Removed FK constraint
    
    # Metadata
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    workflow = relationship("AgentWorkflow", back_populates="workflow_nodes")
    
    def to_dict(self):
        return {
            'id': self.id,
            'workflow_id': self.workflow_id,
            'type': self.node_type,
            'position': {'x': self.position_x, 'y': self.position_y},
            'data': self.data,
            'configured': self.configured,
            'monitoring_job_id': self.monitoring_job_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

# Pydantic models for API
class WorkflowCreate(BaseModel):
    name: str
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    agent_id: Optional[int] = None

class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    nodes: Optional[List[Dict[str, Any]]] = None
    edges: Optional[List[Dict[str, Any]]] = None

class WorkflowResponse(BaseModel):
    id: int
    agent_id: Optional[int]
    user_id: int
    name: str
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    service_version: str
    created_at: Optional[str]
    updated_at: Optional[str]

    class Config:
        from_attributes = True
        
    @classmethod
    def from_orm(cls, obj):
        """Custom method to handle datetime serialization"""
        return cls(
            id=obj.id,
            agent_id=obj.agent_id,
            user_id=obj.user_id,
            name=obj.name,
            nodes=obj.nodes,
            edges=obj.edges,
            service_version=obj.service_version,
            created_at=obj.created_at.isoformat() if obj.created_at else None,
            updated_at=obj.updated_at.isoformat() if obj.updated_at else None
        )