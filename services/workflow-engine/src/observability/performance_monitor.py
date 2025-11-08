"""
Performance Monitor Module

Monitors system performance and resource utilization.
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import psutil
import asyncio

logger = logging.getLogger(__name__)


@dataclass
class PerformanceSnapshot:
    """Snapshot of system performance at a point in time."""
    timestamp: datetime
    cpu_percent: float
    memory_percent: float
    memory_used_mb: float
    memory_available_mb: float
    disk_percent: float
    disk_used_gb: float
    disk_free_gb: float
    network_sent_mb: float
    network_recv_mb: float
    active_connections: int
    active_executions: int


class PerformanceMonitor:
    """
    Monitors system performance and resource utilization.

    Tracks CPU, memory, disk, and network metrics.
    """

    def __init__(
        self,
        snapshot_interval_seconds: int = 60,
        retention_hours: int = 24
    ):
        """
        Initialize performance monitor.

        Args:
            snapshot_interval_seconds: Interval for taking snapshots
            retention_hours: Hours to retain snapshots
        """
        self.snapshot_interval_seconds = snapshot_interval_seconds
        self.retention_hours = retention_hours

        # Performance snapshots
        self.snapshots: List[PerformanceSnapshot] = []

        # Initial network counters
        self.initial_network = psutil.net_io_counters()

        # Background task
        self.monitor_task = None

        # Alert thresholds
        self.thresholds = {
            'cpu_percent': 80.0,
            'memory_percent': 85.0,
            'disk_percent': 90.0
        }

        logger.info("Performance monitor initialized")

    async def start(self):
        """Start performance monitoring."""
        self.monitor_task = asyncio.create_task(self._monitor_loop())
        logger.info("Performance monitor started")

    async def stop(self):
        """Stop performance monitoring."""
        if self.monitor_task:
            self.monitor_task.cancel()
            try:
                await self.monitor_task
            except asyncio.CancelledError:
                pass
        logger.info("Performance monitor stopped")

    async def _monitor_loop(self):
        """Background monitoring loop."""
        while True:
            try:
                await asyncio.sleep(self.snapshot_interval_seconds)
                await self.take_snapshot()
                await self._cleanup_old_snapshots()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in monitor loop: {e}")

    async def take_snapshot(
        self,
        active_connections: int = 0,
        active_executions: int = 0
    ) -> PerformanceSnapshot:
        """
        Take a performance snapshot.

        Args:
            active_connections: Number of active connections
            active_executions: Number of active executions

        Returns:
            Performance snapshot
        """
        try:
            # CPU
            cpu_percent = psutil.cpu_percent(interval=1)

            # Memory
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            memory_used_mb = memory.used / (1024 * 1024)
            memory_available_mb = memory.available / (1024 * 1024)

            # Disk
            disk = psutil.disk_usage('/')
            disk_percent = disk.percent
            disk_used_gb = disk.used / (1024 * 1024 * 1024)
            disk_free_gb = disk.free / (1024 * 1024 * 1024)

            # Network
            network = psutil.net_io_counters()
            network_sent_mb = (
                network.bytes_sent - self.initial_network.bytes_sent
            ) / (1024 * 1024)
            network_recv_mb = (
                network.bytes_recv - self.initial_network.bytes_recv
            ) / (1024 * 1024)

            snapshot = PerformanceSnapshot(
                timestamp=datetime.utcnow(),
                cpu_percent=cpu_percent,
                memory_percent=memory_percent,
                memory_used_mb=memory_used_mb,
                memory_available_mb=memory_available_mb,
                disk_percent=disk_percent,
                disk_used_gb=disk_used_gb,
                disk_free_gb=disk_free_gb,
                network_sent_mb=network_sent_mb,
                network_recv_mb=network_recv_mb,
                active_connections=active_connections,
                active_executions=active_executions
            )

            self.snapshots.append(snapshot)

            # Check thresholds
            await self._check_thresholds(snapshot)

            return snapshot

        except Exception as e:
            logger.error(f"Failed to take performance snapshot: {e}")
            raise

    async def _check_thresholds(self, snapshot: PerformanceSnapshot):
        """Check if performance metrics exceed thresholds."""
        if snapshot.cpu_percent > self.thresholds['cpu_percent']:
            logger.warning(
                f"CPU usage high: {snapshot.cpu_percent:.1f}% "
                f"(threshold: {self.thresholds['cpu_percent']}%)"
            )

        if snapshot.memory_percent > self.thresholds['memory_percent']:
            logger.warning(
                f"Memory usage high: {snapshot.memory_percent:.1f}% "
                f"(threshold: {self.thresholds['memory_percent']}%)"
            )

        if snapshot.disk_percent > self.thresholds['disk_percent']:
            logger.warning(
                f"Disk usage high: {snapshot.disk_percent:.1f}% "
                f"(threshold: {self.thresholds['disk_percent']}%)"
            )

    async def _cleanup_old_snapshots(self):
        """Remove snapshots older than retention period."""
        cutoff_time = datetime.utcnow() - timedelta(hours=self.retention_hours)

        self.snapshots = [
            s for s in self.snapshots
            if s.timestamp >= cutoff_time
        ]

    async def get_current_metrics(self) -> Dict[str, Any]:
        """
        Get current performance metrics.

        Returns:
            Current metrics dict
        """
        snapshot = await self.take_snapshot()
        result = asdict(snapshot)
        result['timestamp'] = snapshot.timestamp.isoformat()
        return result

    async def get_metrics_history(
        self,
        hours: int = 1
    ) -> List[Dict[str, Any]]:
        """
        Get performance metrics history.

        Args:
            hours: Number of hours of history

        Returns:
            List of snapshots
        """
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)

        history = [
            s for s in self.snapshots
            if s.timestamp >= cutoff_time
        ]

        return [
            {**asdict(s), 'timestamp': s.timestamp.isoformat()}
            for s in history
        ]

    async def get_average_metrics(
        self,
        hours: int = 1
    ) -> Dict[str, Any]:
        """
        Get average performance metrics over time period.

        Args:
            hours: Number of hours to average

        Returns:
            Average metrics dict
        """
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)

        recent = [
            s for s in self.snapshots
            if s.timestamp >= cutoff_time
        ]

        if not recent:
            return {}

        return {
            'avg_cpu_percent': sum(s.cpu_percent for s in recent) / len(recent),
            'avg_memory_percent': sum(s.memory_percent for s in recent) / len(recent),
            'avg_disk_percent': sum(s.disk_percent for s in recent) / len(recent),
            'avg_active_connections': sum(s.active_connections for s in recent) / len(recent),
            'avg_active_executions': sum(s.active_executions for s in recent) / len(recent),
            'period_hours': hours,
            'snapshot_count': len(recent)
        }

    async def get_peak_metrics(
        self,
        hours: int = 24
    ) -> Dict[str, Any]:
        """
        Get peak performance metrics.

        Args:
            hours: Number of hours to analyze

        Returns:
            Peak metrics dict
        """
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)

        recent = [
            s for s in self.snapshots
            if s.timestamp >= cutoff_time
        ]

        if not recent:
            return {}

        return {
            'peak_cpu_percent': max(s.cpu_percent for s in recent),
            'peak_memory_percent': max(s.memory_percent for s in recent),
            'peak_disk_percent': max(s.disk_percent for s in recent),
            'peak_active_connections': max(s.active_connections for s in recent),
            'peak_active_executions': max(s.active_executions for s in recent),
            'period_hours': hours
        }

    async def set_threshold(self, metric: str, value: float):
        """
        Set alert threshold for a metric.

        Args:
            metric: Metric name
            value: Threshold value
        """
        if metric in self.thresholds:
            self.thresholds[metric] = value
            logger.info(f"Set {metric} threshold to {value}")

    async def get_health_status(self) -> Dict[str, Any]:
        """
        Get overall system health status.

        Returns:
            Health status dict
        """
        current = await self.get_current_metrics()

        health_score = 100.0

        # Deduct from health score based on resource usage
        if current['cpu_percent'] > 80:
            health_score -= 20
        elif current['cpu_percent'] > 60:
            health_score -= 10

        if current['memory_percent'] > 85:
            health_score -= 30
        elif current['memory_percent'] > 70:
            health_score -= 15

        if current['disk_percent'] > 90:
            health_score -= 25
        elif current['disk_percent'] > 75:
            health_score -= 10

        # Determine status
        if health_score >= 80:
            status = "healthy"
        elif health_score >= 60:
            status = "degraded"
        else:
            status = "critical"

        return {
            'status': status,
            'health_score': max(0, health_score),
            'cpu_percent': current['cpu_percent'],
            'memory_percent': current['memory_percent'],
            'disk_percent': current['disk_percent'],
            'timestamp': current['timestamp']
        }

    async def get_resource_trends(
        self,
        hours: int = 6
    ) -> Dict[str, str]:
        """
        Get resource usage trends.

        Args:
            hours: Number of hours to analyze

        Returns:
            Trends dict with 'increasing', 'decreasing', or 'stable'
        """
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)

        recent = [
            s for s in self.snapshots
            if s.timestamp >= cutoff_time
        ]

        if len(recent) < 2:
            return {
                'cpu': 'stable',
                'memory': 'stable',
                'disk': 'stable'
            }

        # Simple trend detection (compare first half vs second half)
        mid = len(recent) // 2
        first_half = recent[:mid]
        second_half = recent[mid:]

        def get_trend(first, second):
            if second > first * 1.1:
                return 'increasing'
            elif second < first * 0.9:
                return 'decreasing'
            else:
                return 'stable'

        avg_cpu_first = sum(s.cpu_percent for s in first_half) / len(first_half)
        avg_cpu_second = sum(s.cpu_percent for s in second_half) / len(second_half)

        avg_mem_first = sum(s.memory_percent for s in first_half) / len(first_half)
        avg_mem_second = sum(s.memory_percent for s in second_half) / len(second_half)

        avg_disk_first = sum(s.disk_percent for s in first_half) / len(first_half)
        avg_disk_second = sum(s.disk_percent for s in second_half) / len(second_half)

        return {
            'cpu': get_trend(avg_cpu_first, avg_cpu_second),
            'memory': get_trend(avg_mem_first, avg_mem_second),
            'disk': get_trend(avg_disk_first, avg_disk_second)
        }
