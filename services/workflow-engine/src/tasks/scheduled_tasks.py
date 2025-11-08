"""
Celery tasks for scheduled workflow execution.
"""

from celery import Task
from datetime import datetime
from sqlalchemy.orm import Session
import logging

from ..celery_app import celery_app
from ..database import SessionLocal
from ..models.schedule import Schedule, ScheduledExecution

logger = logging.getLogger(__name__)


class DatabaseTask(Task):
    """Base task that provides database session"""
    _db = None

    @property
    def db(self) -> Session:
        if self._db is None:
            self._db = SessionLocal()
        return self._db

    def after_return(self, *args, **kwargs):
        if self._db is not None:
            self._db.close()
            self._db = None


@celery_app.task(base=DatabaseTask, bind=True, max_retries=3)
def execute_scheduled_workflow(self, schedule_id: int, scheduled_time: datetime):
    """Execute a scheduled workflow"""
    db = self.db

    try:
        # Get schedule
        schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
        if not schedule or not schedule.is_active:
            logger.warning(f"Schedule {schedule_id} not found or inactive")
            return {"status": "skipped", "reason": "schedule_inactive"}

        # Create execution record
        execution_record = ScheduledExecution(
            schedule_id=schedule_id,
            scheduled_time=scheduled_time,
            actual_start_time=datetime.utcnow(),
            status='running'
        )
        db.add(execution_record)
        db.commit()

        logger.info(f"Starting scheduled execution for schedule {schedule_id}")

        # Execute workflow
        from ..services.execution_service import ExecutionService
        execution_service = ExecutionService(db)

        result = execution_service.execute_workflow_sync(
            workflow_id=schedule.workflow_id,
            params=schedule.input_params
        )

        # Update execution record
        execution_record.end_time = datetime.utcnow()
        execution_record.status = 'completed' if result.get('success') else 'failed'
        execution_record.execution_id = result.get('execution_id')

        if not result.get('success'):
            execution_record.error_message = result.get('error', 'Unknown error')

        # Update schedule stats
        schedule.last_run_at = datetime.utcnow()
        schedule.last_run_status = execution_record.status
        schedule.total_runs += 1

        if execution_record.status == 'completed':
            schedule.successful_runs += 1
        else:
            schedule.failed_runs += 1

        db.commit()

        logger.info(f"Completed scheduled execution for schedule {schedule_id}")

        return {
            "status": "success",
            "execution_id": result.get('execution_id'),
            "schedule_id": schedule_id
        }

    except Exception as e:
        logger.error(f"Error executing scheduled workflow: {e}")

        # Update execution record on failure
        try:
            execution_record.end_time = datetime.utcnow()
            execution_record.status = 'failed'
            execution_record.error_message = str(e)
            execution_record.retry_count += 1

            schedule.last_run_status = 'failed'
            schedule.failed_runs += 1

            db.commit()
        except Exception as update_error:
            logger.error(f"Failed to update execution record: {update_error}")
            db.rollback()

        # Retry if configured
        if schedule and schedule.max_retries > execution_record.retry_count:
            raise self.retry(exc=e, countdown=schedule.retry_delay_seconds)

        return {"status": "error", "error": str(e)}


@celery_app.task(base=DatabaseTask, bind=True)
def sync_schedules_to_beat(self):
    """Sync database schedules to Celery Beat"""
    db = self.db

    try:
        # Get all active schedules
        schedules = db.query(Schedule).filter(Schedule.is_active == True).all()

        # Update Celery Beat schedule
        beat_schedule = {}

        for schedule in schedules:
            from croniter import croniter
            from datetime import datetime

            # Create crontab from cron expression
            cron_parts = schedule.cron_expression.split()

            if len(cron_parts) == 5:
                minute, hour, day_of_month, month, day_of_week = cron_parts

                beat_schedule[f'schedule_{schedule.id}'] = {
                    'task': 'src.tasks.scheduled_tasks.execute_scheduled_workflow',
                    'schedule': crontab(
                        minute=minute,
                        hour=hour,
                        day_of_month=day_of_month,
                        month_of_year=month,
                        day_of_week=day_of_week
                    ),
                    'args': (schedule.id, datetime.utcnow())
                }

                # Update next_run_at
                cron = croniter(schedule.cron_expression, datetime.utcnow())
                schedule.next_run_at = cron.get_next(datetime)

        db.commit()

        # Update Celery Beat configuration
        celery_app.conf.beat_schedule = beat_schedule

        logger.info(f"Synced {len(schedules)} schedules to Celery Beat")

        return {"status": "success", "schedules_synced": len(schedules)}

    except Exception as e:
        logger.error(f"Error syncing schedules: {e}")
        return {"status": "error", "error": str(e)}


@celery_app.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    """Setup periodic tasks when Celery starts"""
    # Sync schedules every 5 minutes
    sender.add_periodic_task(
        300.0,
        sync_schedules_to_beat.s(),
        name='sync-schedules'
    )
