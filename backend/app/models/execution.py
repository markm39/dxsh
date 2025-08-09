from app import db
from datetime import datetime
import json


class WorkflowExecution(db.Model):
    __tablename__ = 'workflow_executions'
    
    id = db.Column(db.Integer, primary_key=True)
    agent_id = db.Column(db.Integer, db.ForeignKey('workflow_agents.id'), nullable=False)
    user_id = db.Column(db.Integer, nullable=False)  # User identifier from JWT auth
    
    # Execution metadata
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    status = db.Column(db.String(20), default='running')  # running, completed, failed
    error_message = db.Column(db.Text, nullable=True)
    
    # Workflow snapshot
    workflow_nodes = db.Column(db.JSON, nullable=False, default=list)  # Node configuration at time of execution
    workflow_edges = db.Column(db.JSON, nullable=False, default=list)  # Edge configuration at time of execution
    
    # Relationships (removed conflicting agent backref)
    node_executions = db.relationship('NodeExecution', back_populates='execution', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'agent_id': self.agent_id,
            'started_at': self.started_at.isoformat(),
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'status': self.status,
            'error_message': self.error_message,
            'workflow_nodes': self.workflow_nodes,
            'workflow_edges': self.workflow_edges,
            'node_executions': [ne.to_dict() for ne in self.node_executions]
        }


class NodeExecution(db.Model):
    __tablename__ = 'node_executions'
    
    id = db.Column(db.Integer, primary_key=True)
    execution_id = db.Column(db.Integer, db.ForeignKey('workflow_executions.id'), nullable=False)
    node_id = db.Column(db.String(255), nullable=False)  # React Flow node ID
    node_type = db.Column(db.String(50), nullable=False)  # 'webSource', 'aiProcessor'
    
    # Execution timing
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    status = db.Column(db.String(20), default='running')  # running, completed, failed
    error_message = db.Column(db.Text, nullable=True)
    
    # Input/Output data
    input_config = db.Column(db.JSON, nullable=True)  # Configuration used (URLs, selectors, prompts, etc.)
    output_data = db.Column(db.JSON, nullable=True)   # Results produced
    
    # Node-specific data (JSONB for flexibility - see JSONB_MIGRATION.md for details)
    node_specific_data = db.Column(db.JSON, nullable=True)  # All node-specific fields stored as JSON
    
    # Relationships
    execution = db.relationship('WorkflowExecution', back_populates='node_executions')
    
    def to_dict(self):
        result = {
            'id': self.id,
            'execution_id': self.execution_id,
            'node_id': self.node_id,
            'node_type': self.node_type,
            'started_at': self.started_at.isoformat(),
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'status': self.status,
            'error_message': self.error_message,
            'input_config': self.input_config,
            'output_data': self.output_data,
            'node_specific_data': self.node_specific_data or {}
        }
        
        # For backward compatibility, include node-specific fields at top level
        # This can be removed once all frontend code uses node_specific_data
        if self.node_specific_data:
            result.update(self.node_specific_data)
            
        return result