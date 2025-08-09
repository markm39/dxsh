from app import db
from datetime import datetime


class AgentWorkflow(db.Model):
    __tablename__ = 'agent_workflows'
    
    id = db.Column(db.Integer, primary_key=True)
    agent_id = db.Column(db.Integer, db.ForeignKey('workflow_agents.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Workflow data
    name = db.Column(db.String(255), nullable=False, default='Workflow')
    nodes = db.Column(db.JSON, nullable=False, default=list)  # React Flow nodes
    edges = db.Column(db.JSON, nullable=False, default=list)  # React Flow edges
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    agent = db.relationship('WorkflowAgent', backref='workflows')
    user = db.relationship('User', foreign_keys=[user_id], backref='workflows')
    
    def to_dict(self):
        return {
            'id': self.id,
            'agent_id': self.agent_id,
            'name': self.name,
            'nodes': self.nodes,
            'edges': self.edges,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }


class WorkflowNode(db.Model):
    __tablename__ = 'workflow_nodes'
    
    id = db.Column(db.String(255), primary_key=True)  # React Flow node ID
    workflow_id = db.Column(db.Integer, db.ForeignKey('agent_workflows.id'), nullable=False)
    
    # Node data
    node_type = db.Column(db.String(50), nullable=False)  # 'webSource', 'action', etc.
    position_x = db.Column(db.Float, nullable=False)
    position_y = db.Column(db.Float, nullable=False)
    data = db.Column(db.JSON, nullable=False, default=dict)  # Node-specific data
    
    # Configuration
    configured = db.Column(db.Boolean, default=False)
    monitoring_job_id = db.Column(db.Integer, db.ForeignKey('monitoring_jobs.id'), nullable=True)
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    workflow = db.relationship('AgentWorkflow', backref='workflow_nodes')
    monitoring_job = db.relationship('MonitoringJob', backref='workflow_nodes')
    
    def to_dict(self):
        return {
            'id': self.id,
            'workflow_id': self.workflow_id,
            'type': self.node_type,
            'position': {'x': self.position_x, 'y': self.position_y},
            'data': self.data,
            'configured': self.configured,
            'monitoring_job_id': self.monitoring_job_id,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }