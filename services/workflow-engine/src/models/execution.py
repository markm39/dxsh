from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

# Import base from main database module to avoid conflicts
from ..database import Base

class WorkflowExecution(Base):
    __tablename__ = 'workflow_executions'
    
    id = Column(Integer, primary_key=True)
    agent_id = Column(Integer, nullable=False)  # Removed FK constraint for now
    user_id = Column(Integer, nullable=False)  # User identifier from JWT auth
    
    # Execution metadata
    started_at = Column(DateTime, default=func.now())
    completed_at = Column(DateTime)
    status = Column(String(20), default='running')  # running, completed, failed
    error_message = Column(Text, nullable=True)
    
    # API versioning
    api_version = Column(String(10), default='v1')
    
    # Workflow snapshot
    workflow_nodes = Column(JSON, nullable=False, default=list)  # Node configuration at time of execution
    workflow_edges = Column(JSON, nullable=False, default=list)  # Edge configuration at time of execution
    
    # Relationships
    node_executions = relationship("NodeExecution", back_populates="execution", cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            'id': self.id,
            'agent_id': self.agent_id,
            'user_id': self.user_id,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'status': self.status,
            'error_message': self.error_message,
            'api_version': self.api_version,
            'workflow_nodes': self.workflow_nodes,
            'workflow_edges': self.workflow_edges,
            'node_executions': [ne.to_dict() for ne in self.node_executions]
        }

class NodeExecution(Base):
    __tablename__ = 'node_executions'
    
    id = Column(Integer, primary_key=True)
    execution_id = Column(Integer, ForeignKey('workflow_executions.id'), nullable=False)
    node_id = Column(String(255), nullable=False)  # React Flow node ID
    node_type = Column(String(50), nullable=False)  # 'webSource', 'aiProcessor'
    
    # Execution timing
    started_at = Column(DateTime, default=func.now())
    completed_at = Column(DateTime)
    status = Column(String(20), default='running')  # running, completed, failed
    error_message = Column(Text, nullable=True)
    
    # Input/Output data
    input_config = Column(JSON, nullable=True)  # Configuration used (URLs, selectors, prompts, etc.)
    output_data = Column(JSON, nullable=True)   # Results produced
    
    # Node-specific data (JSONB for flexibility)
    node_specific_data = Column(JSON, nullable=True)  # All node-specific fields stored as JSON
    
    # Relationships
    execution = relationship("WorkflowExecution", back_populates="node_executions")
    
    def to_dict(self):
        result = {
            'id': self.id,
            'execution_id': self.execution_id,
            'node_id': self.node_id,
            'node_type': self.node_type,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'status': self.status,
            'error_message': self.error_message,
            'input_config': self.input_config,
            'output_data': self.output_data,
            'node_specific_data': self.node_specific_data or {}
        }
        
        # For backward compatibility, include node-specific fields at top level
        if self.node_specific_data:
            result.update(self.node_specific_data)
            
        return result

# Pydantic models for API
class ExecutionCreate(BaseModel):
    workflow_id: int
    inputs: Optional[Dict[str, Any]] = {}

class ExecutionResponse(BaseModel):
    id: int
    agent_id: Optional[int]
    user_id: int
    started_at: Optional[str]
    completed_at: Optional[str]
    status: str
    error_message: Optional[str]
    api_version: str
    workflow_nodes: List[Dict[str, Any]]
    workflow_edges: List[Dict[str, Any]]

    class Config:
        from_attributes = True

class NodeExecutionResponse(BaseModel):
    id: int
    execution_id: int
    node_id: str
    node_type: str
    started_at: Optional[str]
    completed_at: Optional[str]
    status: str
    error_message: Optional[str]
    input_config: Optional[Dict[str, Any]]
    output_data: Optional[Dict[str, Any]]
    node_specific_data: Optional[Dict[str, Any]]

    class Config:
        from_attributes = True