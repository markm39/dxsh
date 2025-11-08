"""
Unit tests for scheduled workflow execution.
"""

import pytest
from datetime import datetime
from croniter import croniter

from src.models.schedule import Schedule
from src.tasks.scheduled_tasks import execute_scheduled_workflow


class TestScheduleModel:
    """Test Schedule model"""

    def test_schedule_creation(self):
        """Test creating a schedule"""
        schedule = Schedule(
            workflow_id=1,
            name="Daily Report",
            cron_expression="0 9 * * *",
            timezone="UTC",
            is_active=True
        )

        assert schedule.workflow_id == 1
        assert schedule.name == "Daily Report"
        assert schedule.cron_expression == "0 9 * * *"
        assert schedule.is_active == True

    def test_cron_validation(self):
        """Test cron expression validation"""
        # Valid cron
        assert croniter.is_valid("0 9 * * *")
        assert croniter.is_valid("*/5 * * * *")
        assert croniter.is_valid("0 0 1 * *")

        # Invalid cron
        assert not croniter.is_valid("invalid")
        assert not croniter.is_valid("9999 * * * *")


class TestScheduleAPI:
    """Test schedule API endpoints"""

    def test_schedule_repr(self):
        """Test schedule string representation"""
        schedule = Schedule(
            id=1,
            workflow_id=5,
            cron_expression="0 9 * * *"
        )

        repr_str = repr(schedule)
        assert "Schedule" in repr_str
        assert "id=1" in repr_str
        assert "workflow_id=5" in repr_str


@pytest.mark.asyncio
class TestCeleryTasks:
    """Test Celery tasks"""

    async def test_task_signature(self):
        """Test that task has correct signature"""
        assert execute_scheduled_workflow is not None
        assert callable(execute_scheduled_workflow)
