"""
Celery application configuration for scheduled workflow execution.
"""

from celery import Celery
from celery.schedules import crontab
from datetime import datetime
import os
import logging

logger = logging.getLogger(__name__)

# Get Redis URL from environment
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

# Create Celery app
celery_app = Celery(
    'dxsh_workflows',
    broker=REDIS_URL,
    backend=REDIS_URL
)

# Configure Celery
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour
    task_soft_time_limit=3000,  # 50 minutes
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
    beat_schedule_filename='/tmp/celerybeat-schedule',
)

# Auto-discover tasks
celery_app.autodiscover_tasks(['src.tasks'])


@celery_app.task(bind=True)
def debug_task(self):
    """Debug task for testing"""
    logger.info(f'Request: {self.request!r}')
    return {'status': 'ok', 'task_id': self.request.id}
