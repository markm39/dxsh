from app import db
from datetime import datetime
import hashlib
import json


class MonitoringJob(db.Model):
    __tablename__ = 'monitoring_jobs'
    
    id = db.Column(db.Integer, primary_key=True)
    agent_id = db.Column(db.Integer, db.ForeignKey('workflow_agents.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    url = db.Column(db.String(2048), nullable=False)
    selectors = db.Column(db.JSON, nullable=False)  # List of {selector, attribute, label}
    frequency = db.Column(db.Integer, default=3600)  # Check interval in seconds
    change_threshold = db.Column(db.Float, default=0.1)  # Minimum change percentage
    
    # Monitoring state
    is_active = db.Column(db.Boolean, default=True)
    last_check = db.Column(db.DateTime)
    last_content_hash = db.Column(db.String(64))
    consecutive_failures = db.Column(db.Integer, default=0)
    
    # Stats
    total_checks = db.Column(db.Integer, default=0)
    total_changes_detected = db.Column(db.Integer, default=0)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    agent = db.relationship('WorkflowAgent', backref='monitoring_jobs')
    user = db.relationship('User', foreign_keys=[user_id], backref='monitoring_jobs')
    change_records = db.relationship('ChangeRecord', backref='monitoring_job', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'agent_id': self.agent_id,
            'name': self.name,
            'url': self.url,
            'selectors': self.selectors,
            'frequency': self.frequency,
            'change_threshold': self.change_threshold,
            'is_active': self.is_active,
            'last_check': self.last_check.isoformat() if self.last_check else None,
            'consecutive_failures': self.consecutive_failures,
            'total_checks': self.total_checks,
            'total_changes_detected': self.total_changes_detected,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
    
    def calculate_content_hash(self, content):
        """Calculate hash of extracted content"""
        if isinstance(content, dict):
            content_str = json.dumps(content, sort_keys=True)
        else:
            content_str = str(content)
        return hashlib.sha256(content_str.encode()).hexdigest()
    
    def should_trigger_change(self, old_content, new_content):
        """Determine if change is significant enough to trigger"""
        if not old_content:
            return True
            
        # For numeric values, check percentage change
        try:
            old_val = float(old_content)
            new_val = float(new_content)
            if old_val == 0:
                return new_val != 0
            change_pct = abs((new_val - old_val) / old_val)
            return change_pct >= self.change_threshold
        except (ValueError, TypeError):
            # For non-numeric, any change triggers
            return old_content != new_content


class ChangeRecord(db.Model):
    __tablename__ = 'change_records'
    
    id = db.Column(db.Integer, primary_key=True)
    monitoring_job_id = db.Column(db.Integer, db.ForeignKey('monitoring_jobs.id'), nullable=False)
    
    # Change details
    selector = db.Column(db.String(500))
    label = db.Column(db.String(255))
    old_value = db.Column(db.Text)
    new_value = db.Column(db.Text)
    change_type = db.Column(db.String(50))  # 'text', 'numeric', 'added', 'removed'
    
    # Metadata
    detected_at = db.Column(db.DateTime, default=datetime.utcnow)
    notification_sent = db.Column(db.Boolean, default=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'monitoring_job_id': self.monitoring_job_id,
            'selector': self.selector,
            'label': self.label,
            'old_value': self.old_value,
            'new_value': self.new_value,
            'change_type': self.change_type,
            'detected_at': self.detected_at.isoformat(),
            'notification_sent': self.notification_sent
        }
    
    def get_change_summary(self):
        """Get human-readable change summary"""
        if self.change_type == 'added':
            return f"{self.label}: New value added - {self.new_value}"
        elif self.change_type == 'removed':
            return f"{self.label}: Value removed - {self.old_value}"
        elif self.change_type == 'numeric':
            try:
                old = float(self.old_value)
                new = float(self.new_value)
                change_pct = ((new - old) / old) * 100
                direction = "increased" if new > old else "decreased"
                return f"{self.label}: {direction} by {abs(change_pct):.1f}% ({self.old_value} → {self.new_value})"
            except:
                return f"{self.label}: Changed from {self.old_value} to {self.new_value}"
        else:
            return f"{self.label}: Changed from '{self.old_value}' to '{self.new_value}'"