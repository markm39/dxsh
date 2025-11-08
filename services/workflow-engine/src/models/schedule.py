"""
Database models for scheduled workflow execution.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .workflow import Base


class Schedule(Base):
    """Scheduled workflow execution model"""
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)

    # Schedule configuration
    cron_expression = Column(String, nullable=False)
    timezone = Column(String, default="UTC")

    # Execution settings
    is_active = Column(Boolean, default=True)
    max_retries = Column(Integer, default=0)
    retry_delay_seconds = Column(Integer, default=60)

    # Input parameters for workflow
    input_params = Column(JSON, default={})

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String, nullable=True)

    # Statistics
    last_run_at = Column(DateTime, nullable=True)
    last_run_status = Column(String, nullable=True)
    total_runs = Column(Integer, default=0)
    successful_runs = Column(Integer, default=0)
    failed_runs = Column(Integer, default=0)

    # Next scheduled run
    next_run_at = Column(DateTime, nullable=True)

    # Relationships
    workflow = relationship("Workflow", back_populates="schedules")
    executions = relationship("ScheduledExecution", back_populates="schedule")

    def __repr__(self):
        return f"<Schedule(id={self.id}, workflow_id={self.workflow_id}, cron='{self.cron_expression}')>"


class ScheduledExecution(Base):
    """Record of scheduled workflow executions"""
    __tablename__ = "scheduled_executions"

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("schedules.id"), nullable=False)
    execution_id = Column(Integer, ForeignKey("executions.id"), nullable=True)

    # Execution details
    scheduled_time = Column(DateTime, nullable=False)
    actual_start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    status = Column(String, nullable=False)  # pending, running, completed, failed, skipped

    # Error information
    error_message = Column(String, nullable=True)
    retry_count = Column(Integer, default=0)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    schedule = relationship("Schedule", back_populates="executions")

    def __repr__(self):
        return f"<ScheduledExecution(id={self.id}, schedule_id={self.schedule_id}, status='{self.status}')>"
