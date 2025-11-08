"""
API endpoints for scheduled workflow execution management.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from datetime import datetime
from croniter import croniter
import logging

from ..database import get_db
from ..models.schedule import Schedule, ScheduledExecution
from ..auth import get_current_user, AuthUser
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v1/schedules", tags=["schedules"])
logger = logging.getLogger(__name__)


class ScheduleCreate(BaseModel):
    """Schema for creating a schedule"""
    workflow_id: int
    name: str
    description: Optional[str] = None
    cron_expression: str = Field(..., description="Cron expression (e.g., '0 9 * * *')")
    timezone: str = "UTC"
    is_active: bool = True
    max_retries: int = 0
    retry_delay_seconds: int = 60
    input_params: dict = {}


class ScheduleUpdate(BaseModel):
    """Schema for updating a schedule"""
    name: Optional[str] = None
    description: Optional[str] = None
    cron_expression: Optional[str] = None
    timezone: Optional[str] = None
    is_active: Optional[bool] = None
    max_retries: Optional[int] = None
    retry_delay_seconds: Optional[int] = None
    input_params: Optional[dict] = None


class ScheduleResponse(BaseModel):
    """Schema for schedule response"""
    id: int
    workflow_id: int
    name: str
    description: Optional[str]
    cron_expression: str
    timezone: str
    is_active: bool
    max_retries: int
    retry_delay_seconds: int
    input_params: dict
    created_at: datetime
    updated_at: datetime
    last_run_at: Optional[datetime]
    last_run_status: Optional[str]
    next_run_at: Optional[datetime]
    total_runs: int
    successful_runs: int
    failed_runs: int

    class Config:
        from_attributes = True


def validate_cron_expression(cron_expr: str) -> bool:
    """Validate cron expression"""
    try:
        croniter(cron_expr)
        return True
    except Exception:
        return False


def calculate_next_run(cron_expr: str, timezone: str = "UTC") -> datetime:
    """Calculate next run time from cron expression"""
    try:
        cron = croniter(cron_expr, datetime.now())
        return cron.get_next(datetime)
    except Exception as e:
        logger.error(f"Failed to calculate next run: {e}")
        return None


@router.post("/", response_model=ScheduleResponse)
async def create_schedule(
    schedule_data: ScheduleCreate,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new workflow schedule"""
    try:
        # Validate cron expression
        if not validate_cron_expression(schedule_data.cron_expression):
            raise HTTPException(
                status_code=400,
                detail="Invalid cron expression"
            )

        # Calculate next run
        next_run = calculate_next_run(
            schedule_data.cron_expression,
            schedule_data.timezone
        )

        # Create schedule
        schedule = Schedule(
            workflow_id=schedule_data.workflow_id,
            name=schedule_data.name,
            description=schedule_data.description,
            cron_expression=schedule_data.cron_expression,
            timezone=schedule_data.timezone,
            is_active=schedule_data.is_active,
            max_retries=schedule_data.max_retries,
            retry_delay_seconds=schedule_data.retry_delay_seconds,
            input_params=schedule_data.input_params,
            created_by=current_user.user_id,
            next_run_at=next_run
        )

        db.add(schedule)
        db.commit()
        db.refresh(schedule)

        logger.info(f"Created schedule {schedule.id} for workflow {schedule_data.workflow_id}")

        return schedule

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=List[ScheduleResponse])
async def list_schedules(
    workflow_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all schedules"""
    try:
        query = db.query(Schedule)

        if workflow_id:
            query = query.filter(Schedule.workflow_id == workflow_id)

        if is_active is not None:
            query = query.filter(Schedule.is_active == is_active)

        schedules = query.order_by(desc(Schedule.created_at)).all()

        return schedules

    except Exception as e:
        logger.error(f"Failed to list schedules: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(
    schedule_id: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get schedule by ID"""
    try:
        schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()

        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")

        return schedule

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: int,
    schedule_update: ScheduleUpdate,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a schedule"""
    try:
        schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()

        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")

        # Update fields
        update_data = schedule_update.dict(exclude_unset=True)

        # Validate cron if being updated
        if 'cron_expression' in update_data:
            if not validate_cron_expression(update_data['cron_expression']):
                raise HTTPException(
                    status_code=400,
                    detail="Invalid cron expression"
                )
            # Recalculate next run
            schedule.next_run_at = calculate_next_run(
                update_data['cron_expression'],
                update_data.get('timezone', schedule.timezone)
            )

        for key, value in update_data.items():
            setattr(schedule, key, value)

        schedule.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(schedule)

        logger.info(f"Updated schedule {schedule_id}")

        return schedule

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{schedule_id}")
async def delete_schedule(
    schedule_id: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a schedule"""
    try:
        schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()

        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")

        db.delete(schedule)
        db.commit()

        logger.info(f"Deleted schedule {schedule_id}")

        return {"message": "Schedule deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{schedule_id}/toggle")
async def toggle_schedule(
    schedule_id: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Toggle schedule active status"""
    try:
        schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()

        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")

        schedule.is_active = not schedule.is_active
        schedule.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(schedule)

        logger.info(f"Toggled schedule {schedule_id} to active={schedule.is_active}")

        return {"is_active": schedule.is_active}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to toggle schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{schedule_id}/history")
async def get_schedule_history(
    schedule_id: int,
    limit: int = 50,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get execution history for a schedule"""
    try:
        schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()

        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")

        executions = db.query(ScheduledExecution).filter(
            ScheduledExecution.schedule_id == schedule_id
        ).order_by(desc(ScheduledExecution.scheduled_time)).limit(limit).all()

        return {
            "schedule_id": schedule_id,
            "executions": [
                {
                    "id": exec.id,
                    "scheduled_time": exec.scheduled_time,
                    "actual_start_time": exec.actual_start_time,
                    "end_time": exec.end_time,
                    "status": exec.status,
                    "error_message": exec.error_message,
                    "retry_count": exec.retry_count
                }
                for exec in executions
            ]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get schedule history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{schedule_id}/run-now")
async def run_schedule_now(
    schedule_id: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Trigger immediate execution of a scheduled workflow"""
    try:
        schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()

        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")

        # Import execution service
        from ..services.execution_service import ExecutionService

        # Execute workflow
        execution_service = ExecutionService(db)
        result = await execution_service.execute_workflow(
            workflow_id=schedule.workflow_id,
            params=schedule.input_params
        )

        logger.info(f"Manually triggered schedule {schedule_id}")

        return {
            "message": "Workflow execution triggered",
            "execution_id": result.get("execution_id")
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to run schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))
