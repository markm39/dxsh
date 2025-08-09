# backend/app/models/agent.py
from app import db
from sqlalchemy import Boolean, String, DateTime, Integer, Enum, Text, JSON, Float
from datetime import datetime
import enum

class AgentStatus(enum.Enum):
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    ERROR = "ERROR"
    INACTIVE = "INACTIVE"

class AgentType(enum.Enum):
    DATA_PROCESSING = "DATA_PROCESSING"
    WEB_SCRAPING = "WEB_SCRAPING"
    API_AUTOMATION = "API_AUTOMATION"
    ML_PIPELINE = "ML_PIPELINE"
    CUSTOM = "CUSTOM"
    WORKFLOW = "WORKFLOW"

class TriggerType(enum.Enum):
    DATA_CHANGE = "DATA_CHANGE"
    API_WEBHOOK = "API_WEBHOOK"
    SCHEDULE = "SCHEDULE"
    THRESHOLD = "THRESHOLD"
    FILE_CHANGE = "FILE_CHANGE"
    MANUAL = "MANUAL"

class ActionType(enum.Enum):
    NOTIFY = "NOTIFY"
    PROCESS_DATA = "PROCESS_DATA"
    GENERATE_REPORT = "GENERATE_REPORT"
    UPDATE_DATABASE = "UPDATE_DATABASE"
    SEND_WEBHOOK = "SEND_WEBHOOK"
    TRIGGER_WORKFLOW = "TRIGGER_WORKFLOW"
    EXECUTE_SCRIPT = "EXECUTE_SCRIPT"

class NotificationChannel(enum.Enum):
    EMAIL = "EMAIL"
    SMS = "SMS"
    IN_APP = "IN_APP"
    SLACK = "SLACK"
    DISCORD = "DISCORD"
    WEBHOOK = "WEBHOOK"

class WorkflowAgent(db.Model):
    __tablename__ = 'workflow_agents'
    
    id = db.Column(Integer, primary_key=True)
    name = db.Column(String(255), nullable=False)
    description = db.Column(Text)
    
    # Agent configuration
    agent_type = db.Column(Enum(AgentType), nullable=False, default=AgentType.WORKFLOW)
    status = db.Column(Enum(AgentStatus), nullable=False, default=AgentStatus.INACTIVE)
    
    # Workflow definition
    workflow_data = db.Column(JSON)  # React Flow nodes and edges
    
    # Execution settings
    auto_execute = db.Column(Boolean, default=False)
    execution_interval = db.Column(Integer)  # seconds
    max_executions = db.Column(Integer)
    
    # Trigger configuration
    trigger_type = db.Column(Enum(TriggerType), default=TriggerType.MANUAL)
    trigger_config = db.Column(JSON)
    
    # Action configuration
    actions = db.Column(JSON)  # List of actions to perform
    
    # Notification settings
    notification_channels = db.Column(JSON)  # List of notification channels
    notification_config = db.Column(JSON)
    
    # Metadata
    created_at = db.Column(DateTime, default=datetime.utcnow)
    updated_at = db.Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(String(255))  # User ID
    
    # Relationships
    executions = db.relationship('WorkflowExecution', backref='workflow_agent', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<WorkflowAgent {self.name}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'agent_type': self.agent_type.value if self.agent_type else None,
            'status': self.status.value if self.status else None,
            'workflow_data': self.workflow_data,
            'auto_execute': self.auto_execute,
            'execution_interval': self.execution_interval,
            'max_executions': self.max_executions,
            'trigger_type': self.trigger_type.value if self.trigger_type else None,
            'trigger_config': self.trigger_config,
            'actions': self.actions,
            'notification_channels': self.notification_channels,
            'notification_config': self.notification_config,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'created_by': self.created_by
        }
    
    @classmethod
    def from_dict(cls, data):
        return cls(
            name=data.get('name'),
            description=data.get('description'),
            agent_type=AgentType(data.get('agent_type')) if data.get('agent_type') else AgentType.WORKFLOW,
            status=AgentStatus(data.get('status')) if data.get('status') else AgentStatus.INACTIVE,
            workflow_data=data.get('workflow_data'),
            auto_execute=data.get('auto_execute', False),
            execution_interval=data.get('execution_interval'),
            max_executions=data.get('max_executions'),
            trigger_type=TriggerType(data.get('trigger_type')) if data.get('trigger_type') else TriggerType.MANUAL,
            trigger_config=data.get('trigger_config'),
            actions=data.get('actions'),
            notification_channels=data.get('notification_channels'),
            notification_config=data.get('notification_config'),
            created_by=data.get('created_by')
        )