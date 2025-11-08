"""
Metrics Collector Module

Collects and aggregates workflow execution metrics.
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, field, asdict
from collections import defaultdict
import statistics

logger = logging.getLogger(__name__)


@dataclass
class ExecutionMetrics:
    """Metrics for a single execution."""
    workflow_id: int
    execution_id: int
    user_id: int
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_ms: float = 0.0
    status: str = "running"
    node_count: int = 0
    success_count: int = 0
    failure_count: int = 0
    total_cost: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)


class MetricsCollector:
    """
    Collects and aggregates workflow execution metrics.

    Tracks execution statistics, success rates, and performance data.
    """

    def __init__(self, retention_days: int = 30):
        """
        Initialize metrics collector.

        Args:
            retention_days: Days to retain metrics data
        """
        self.retention_days = retention_days

        # Store metrics by execution_id
        self.executions: Dict[int, ExecutionMetrics] = {}

        # Aggregated statistics
        self.workflow_stats: Dict[int, Dict[str, Any]] = defaultdict(lambda: {
            'total_executions': 0,
            'successful_executions': 0,
            'failed_executions': 0,
            'total_duration_ms': 0.0,
            'total_cost': 0.0,
            'avg_duration_ms': 0.0,
            'success_rate': 0.0
        })

        logger.info("Metrics collector initialized")

    async def record_execution_start(
        self,
        workflow_id: int,
        execution_id: int,
        user_id: int,
        node_count: int = 0
    ):
        """
        Record the start of an execution.

        Args:
            workflow_id: Workflow ID
            execution_id: Execution ID
            user_id: User ID
            node_count: Number of nodes in workflow
        """
        metrics = ExecutionMetrics(
            workflow_id=workflow_id,
            execution_id=execution_id,
            user_id=user_id,
            started_at=datetime.utcnow(),
            node_count=node_count,
            status="running"
        )

        self.executions[execution_id] = metrics

        logger.info(
            f"Recorded execution start: workflow={workflow_id}, "
            f"execution={execution_id}"
        )

    async def record_execution_complete(
        self,
        execution_id: int,
        status: str,
        success_count: int = 0,
        failure_count: int = 0,
        total_cost: float = 0.0
    ):
        """
        Record the completion of an execution.

        Args:
            execution_id: Execution ID
            status: Final status (completed, failed, etc.)
            success_count: Number of successful nodes
            failure_count: Number of failed nodes
            total_cost: Total execution cost
        """
        if execution_id not in self.executions:
            logger.warning(f"Execution {execution_id} not found in metrics")
            return

        metrics = self.executions[execution_id]
        metrics.completed_at = datetime.utcnow()
        metrics.status = status
        metrics.success_count = success_count
        metrics.failure_count = failure_count
        metrics.total_cost = total_cost

        # Calculate duration
        if metrics.started_at and metrics.completed_at:
            duration = metrics.completed_at - metrics.started_at
            metrics.duration_ms = duration.total_seconds() * 1000

        # Update workflow statistics
        await self._update_workflow_stats(metrics)

        logger.info(
            f"Recorded execution complete: execution={execution_id}, "
            f"status={status}, duration={metrics.duration_ms:.2f}ms"
        )

    async def _update_workflow_stats(self, metrics: ExecutionMetrics):
        """Update aggregated workflow statistics."""
        workflow_id = metrics.workflow_id
        stats = self.workflow_stats[workflow_id]

        stats['total_executions'] += 1

        if metrics.status == 'completed':
            stats['successful_executions'] += 1
        else:
            stats['failed_executions'] += 1

        stats['total_duration_ms'] += metrics.duration_ms
        stats['total_cost'] += metrics.total_cost

        # Calculate averages
        if stats['total_executions'] > 0:
            stats['avg_duration_ms'] = (
                stats['total_duration_ms'] / stats['total_executions']
            )
            stats['success_rate'] = (
                stats['successful_executions'] / stats['total_executions'] * 100
            )

    async def get_execution_metrics(
        self,
        execution_id: int
    ) -> Optional[Dict[str, Any]]:
        """
        Get metrics for a specific execution.

        Args:
            execution_id: Execution ID

        Returns:
            Metrics dict or None
        """
        if execution_id not in self.executions:
            return None

        metrics = self.executions[execution_id]
        result = asdict(metrics)

        # Convert datetime to ISO string
        result['started_at'] = metrics.started_at.isoformat()
        if metrics.completed_at:
            result['completed_at'] = metrics.completed_at.isoformat()

        return result

    async def get_workflow_stats(self, workflow_id: int) -> Dict[str, Any]:
        """
        Get aggregated statistics for a workflow.

        Args:
            workflow_id: Workflow ID

        Returns:
            Statistics dict
        """
        return dict(self.workflow_stats.get(workflow_id, {}))

    async def get_user_stats(self, user_id: int) -> Dict[str, Any]:
        """
        Get aggregated statistics for a user.

        Args:
            user_id: User ID

        Returns:
            Statistics dict
        """
        user_executions = [
            m for m in self.executions.values()
            if m.user_id == user_id
        ]

        if not user_executions:
            return {
                'total_executions': 0,
                'total_workflows': 0,
                'total_cost': 0.0
            }

        total_cost = sum(m.total_cost for m in user_executions)
        successful = sum(1 for m in user_executions if m.status == 'completed')
        unique_workflows = len(set(m.workflow_id for m in user_executions))

        return {
            'total_executions': len(user_executions),
            'successful_executions': successful,
            'failed_executions': len(user_executions) - successful,
            'success_rate': (successful / len(user_executions) * 100) if user_executions else 0,
            'total_workflows': unique_workflows,
            'total_cost': total_cost
        }

    async def get_time_series_data(
        self,
        workflow_id: Optional[int] = None,
        user_id: Optional[int] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        interval_minutes: int = 60
    ) -> List[Dict[str, Any]]:
        """
        Get time-series execution data.

        Args:
            workflow_id: Optional workflow filter
            user_id: Optional user filter
            start_time: Start time for data
            end_time: End time for data
            interval_minutes: Time interval for aggregation

        Returns:
            List of time-bucketed metrics
        """
        # Filter executions
        executions = list(self.executions.values())

        if workflow_id is not None:
            executions = [e for e in executions if e.workflow_id == workflow_id]

        if user_id is not None:
            executions = [e for e in executions if e.user_id == user_id]

        if start_time:
            executions = [e for e in executions if e.started_at >= start_time]

        if end_time:
            executions = [e for e in executions if e.started_at <= end_time]

        # Group by time interval
        interval = timedelta(minutes=interval_minutes)
        buckets = defaultdict(list)

        for execution in executions:
            bucket_time = execution.started_at - (
                execution.started_at - datetime.min
            ) % interval

            buckets[bucket_time].append(execution)

        # Aggregate per bucket
        time_series = []

        for bucket_time in sorted(buckets.keys()):
            bucket_executions = buckets[bucket_time]

            completed = [e for e in bucket_executions if e.completed_at]
            successful = [e for e in completed if e.status == 'completed']

            time_series.append({
                'timestamp': bucket_time.isoformat(),
                'total_executions': len(bucket_executions),
                'successful_executions': len(successful),
                'failed_executions': len(completed) - len(successful),
                'running_executions': len(bucket_executions) - len(completed),
                'avg_duration_ms': statistics.mean(
                    [e.duration_ms for e in completed]
                ) if completed else 0,
                'total_cost': sum(e.total_cost for e in bucket_executions)
            })

        return time_series

    async def get_system_overview(self) -> Dict[str, Any]:
        """
        Get system-wide overview metrics.

        Returns:
            Overview metrics dict
        """
        all_executions = list(self.executions.values())

        if not all_executions:
            return {
                'total_executions': 0,
                'total_workflows': 0,
                'total_users': 0,
                'total_cost': 0.0
            }

        completed = [e for e in all_executions if e.completed_at]
        successful = [e for e in completed if e.status == 'completed']

        return {
            'total_executions': len(all_executions),
            'running_executions': len(all_executions) - len(completed),
            'completed_executions': len(completed),
            'successful_executions': len(successful),
            'failed_executions': len(completed) - len(successful),
            'success_rate': (len(successful) / len(completed) * 100) if completed else 0,
            'total_workflows': len(set(e.workflow_id for e in all_executions)),
            'total_users': len(set(e.user_id for e in all_executions)),
            'avg_duration_ms': statistics.mean(
                [e.duration_ms for e in completed]
            ) if completed else 0,
            'total_cost': sum(e.total_cost for e in all_executions),
            'total_nodes_executed': sum(e.node_count for e in all_executions)
        }

    async def cleanup_old_metrics(self):
        """Remove metrics older than retention period."""
        cutoff_date = datetime.utcnow() - timedelta(days=self.retention_days)

        old_executions = [
            exec_id for exec_id, metrics in self.executions.items()
            if metrics.started_at < cutoff_date
        ]

        for exec_id in old_executions:
            del self.executions[exec_id]

        logger.info(f"Cleaned up {len(old_executions)} old metrics")

    async def export_metrics(
        self,
        format: str = "json"
    ) -> str:
        """
        Export all metrics.

        Args:
            format: Export format (json, csv)

        Returns:
            Exported data as string
        """
        if format == "json":
            import json

            data = {
                'executions': {
                    exec_id: await self.get_execution_metrics(exec_id)
                    for exec_id in self.executions.keys()
                },
                'workflow_stats': dict(self.workflow_stats)
            }

            return json.dumps(data, indent=2)

        else:
            raise ValueError(f"Unsupported format: {format}")
