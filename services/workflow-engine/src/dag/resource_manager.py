"""
Resource Manager Module

Tracks and allocates CPU/memory resources for workflow execution.
"""

import logging
import asyncio
from typing import Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime
import psutil

logger = logging.getLogger(__name__)


@dataclass
class ResourceAllocation:
    """Represents a resource allocation for a node."""
    node_id: str
    cpu_cores: float
    memory_mb: float
    allocated_at: datetime


class ResourceManager:
    """
    Manages resource allocation for parallel workflow execution.

    Tracks CPU and memory usage to prevent system overload.
    """

    def __init__(
        self,
        max_cpu_cores: Optional[float] = None,
        max_memory_mb: Optional[float] = None,
        default_cpu_per_node: float = 1.0,
        default_memory_per_node: float = 512.0
    ):
        """
        Initialize resource manager.

        Args:
            max_cpu_cores: Maximum CPU cores to use (None for system total)
            max_memory_mb: Maximum memory in MB (None for 80% of system memory)
            default_cpu_per_node: Default CPU cores per node
            default_memory_per_node: Default memory per node in MB
        """
        # Get system resources
        self.system_cpu_cores = psutil.cpu_count()
        self.system_memory_mb = psutil.virtual_memory().total / (1024 * 1024)

        # Set limits
        self.max_cpu_cores = max_cpu_cores or self.system_cpu_cores
        self.max_memory_mb = max_memory_mb or (self.system_memory_mb * 0.8)

        # Defaults
        self.default_cpu_per_node = default_cpu_per_node
        self.default_memory_per_node = default_memory_per_node

        # Track allocations
        self.allocations: Dict[str, ResourceAllocation] = {}
        self.lock = asyncio.Lock()

        # Current usage
        self.current_cpu_allocated = 0.0
        self.current_memory_allocated = 0.0

        logger.info(
            f"Resource manager initialized - "
            f"CPU: {self.max_cpu_cores} cores, "
            f"Memory: {self.max_memory_mb:.2f} MB"
        )

    async def allocate_resources(
        self,
        node_id: str,
        resources: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Allocate resources for a node.

        Args:
            node_id: Node ID
            resources: Resource requirements dict with 'cpu' and 'memory_mb'

        Returns:
            True if allocation successful, False if insufficient resources
        """
        async with self.lock:
            # Parse resource requirements
            cpu_needed = self._parse_cpu_requirement(resources)
            memory_needed = self._parse_memory_requirement(resources)

            # Check if resources are available
            available_cpu = self.max_cpu_cores - self.current_cpu_allocated
            available_memory = self.max_memory_mb - self.current_memory_allocated

            if cpu_needed > available_cpu or memory_needed > available_memory:
                logger.warning(
                    f"Insufficient resources for node {node_id} - "
                    f"Need: {cpu_needed} CPU, {memory_needed} MB; "
                    f"Available: {available_cpu} CPU, {available_memory} MB"
                )
                # Wait for resources to become available
                await self._wait_for_resources(cpu_needed, memory_needed)

            # Allocate resources
            allocation = ResourceAllocation(
                node_id=node_id,
                cpu_cores=cpu_needed,
                memory_mb=memory_needed,
                allocated_at=datetime.utcnow()
            )

            self.allocations[node_id] = allocation
            self.current_cpu_allocated += cpu_needed
            self.current_memory_allocated += memory_needed

            logger.debug(
                f"Allocated resources for {node_id}: "
                f"{cpu_needed} CPU, {memory_needed} MB - "
                f"Total: {self.current_cpu_allocated}/{self.max_cpu_cores} CPU, "
                f"{self.current_memory_allocated}/{self.max_memory_mb} MB"
            )

            return True

    async def release_resources(self, node_id: str):
        """
        Release resources allocated to a node.

        Args:
            node_id: Node ID
        """
        async with self.lock:
            if node_id not in self.allocations:
                logger.warning(f"No allocation found for node {node_id}")
                return

            allocation = self.allocations[node_id]

            # Release resources
            self.current_cpu_allocated -= allocation.cpu_cores
            self.current_memory_allocated -= allocation.memory_mb

            del self.allocations[node_id]

            logger.debug(
                f"Released resources for {node_id}: "
                f"{allocation.cpu_cores} CPU, {allocation.memory_mb} MB - "
                f"Remaining: {self.current_cpu_allocated}/{self.max_cpu_cores} CPU, "
                f"{self.current_memory_allocated}/{self.max_memory_mb} MB"
            )

    async def _wait_for_resources(self, cpu_needed: float, memory_needed: float):
        """
        Wait for resources to become available.

        Args:
            cpu_needed: CPU cores needed
            memory_needed: Memory in MB needed
        """
        max_wait_seconds = 300  # 5 minutes max wait
        wait_interval = 0.1  # Check every 100ms
        total_waited = 0.0

        while total_waited < max_wait_seconds:
            # Release lock temporarily to allow other operations
            self.lock.release()
            await asyncio.sleep(wait_interval)
            await self.lock.acquire()

            total_waited += wait_interval

            # Check if resources are now available
            available_cpu = self.max_cpu_cores - self.current_cpu_allocated
            available_memory = self.max_memory_mb - self.current_memory_allocated

            if cpu_needed <= available_cpu and memory_needed <= available_memory:
                logger.debug(f"Resources became available after {total_waited:.2f}s")
                return

        logger.warning(
            f"Timed out waiting for resources after {total_waited}s - "
            f"proceeding anyway"
        )

    def _parse_cpu_requirement(self, resources: Optional[Dict[str, Any]]) -> float:
        """
        Parse CPU requirement from resources dict.

        Args:
            resources: Resources dict

        Returns:
            CPU cores needed
        """
        if not resources:
            return self.default_cpu_per_node

        cpu = resources.get('cpu', self.default_cpu_per_node)

        # Handle string formats like "2 cores" or "1.5"
        if isinstance(cpu, str):
            cpu = cpu.lower().replace('cores', '').replace('core', '').strip()
            try:
                cpu = float(cpu)
            except ValueError:
                cpu = self.default_cpu_per_node

        return float(cpu)

    def _parse_memory_requirement(self, resources: Optional[Dict[str, Any]]) -> float:
        """
        Parse memory requirement from resources dict.

        Args:
            resources: Resources dict

        Returns:
            Memory in MB needed
        """
        if not resources:
            return self.default_memory_per_node

        memory = resources.get('memory_mb', resources.get('memory', self.default_memory_per_node))

        # Handle string formats like "1GB", "512MB"
        if isinstance(memory, str):
            memory = memory.upper().strip()

            if 'GB' in memory:
                memory = float(memory.replace('GB', '').strip()) * 1024
            elif 'MB' in memory:
                memory = float(memory.replace('MB', '').strip())
            else:
                try:
                    memory = float(memory)
                except ValueError:
                    memory = self.default_memory_per_node

        return float(memory)

    def get_resource_usage(self) -> Dict[str, Any]:
        """
        Get current resource usage statistics.

        Returns:
            Dict with resource usage info
        """
        cpu_percent = (self.current_cpu_allocated / self.max_cpu_cores * 100) if self.max_cpu_cores > 0 else 0
        memory_percent = (self.current_memory_allocated / self.max_memory_mb * 100) if self.max_memory_mb > 0 else 0

        return {
            'cpu': {
                'allocated': self.current_cpu_allocated,
                'total': self.max_cpu_cores,
                'percent_used': cpu_percent,
                'available': self.max_cpu_cores - self.current_cpu_allocated
            },
            'memory': {
                'allocated_mb': self.current_memory_allocated,
                'total_mb': self.max_memory_mb,
                'percent_used': memory_percent,
                'available_mb': self.max_memory_mb - self.current_memory_allocated
            },
            'allocations': len(self.allocations),
            'active_nodes': list(self.allocations.keys())
        }

    def get_system_resources(self) -> Dict[str, Any]:
        """
        Get current system resource utilization.

        Returns:
            Dict with system resource info
        """
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')

        return {
            'cpu': {
                'percent': cpu_percent,
                'count': self.system_cpu_cores
            },
            'memory': {
                'total_mb': memory.total / (1024 * 1024),
                'available_mb': memory.available / (1024 * 1024),
                'percent': memory.percent,
                'used_mb': memory.used / (1024 * 1024)
            },
            'disk': {
                'total_gb': disk.total / (1024 * 1024 * 1024),
                'used_gb': disk.used / (1024 * 1024 * 1024),
                'free_gb': disk.free / (1024 * 1024 * 1024),
                'percent': disk.percent
            }
        }

    async def can_allocate(
        self,
        cpu_needed: float,
        memory_needed: float
    ) -> bool:
        """
        Check if resources can be allocated without waiting.

        Args:
            cpu_needed: CPU cores needed
            memory_needed: Memory in MB needed

        Returns:
            True if resources are immediately available
        """
        async with self.lock:
            available_cpu = self.max_cpu_cores - self.current_cpu_allocated
            available_memory = self.max_memory_mb - self.current_memory_allocated

            return cpu_needed <= available_cpu and memory_needed <= available_memory

    async def reset(self):
        """Reset all allocations (use with caution)."""
        async with self.lock:
            self.allocations.clear()
            self.current_cpu_allocated = 0.0
            self.current_memory_allocated = 0.0
            logger.info("Resource manager reset")
