"""
Approval Manager Module

Manages approval requests and state for human-in-the-loop workflows.
"""

import logging
import asyncio
from typing import Dict, Any, Optional, List, Callable
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass, field
import uuid

logger = logging.getLogger(__name__)


class ApprovalStatus(Enum):
    """Status of an approval request."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


@dataclass
class ApprovalRequest:
    """Represents an approval request."""
    id: str
    workflow_execution_id: int
    node_id: str
    user_id: int
    title: str
    description: str
    data: Dict[str, Any]
    status: ApprovalStatus = ApprovalStatus.PENDING
    created_at: datetime = field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class ApprovalManager:
    """
    Manages approval requests for workflows.

    Handles approval lifecycle, notifications, and timeout management.
    """

    def __init__(
        self,
        default_timeout_minutes: int = 60,
        cleanup_interval_seconds: int = 300
    ):
        """
        Initialize approval manager.

        Args:
            default_timeout_minutes: Default timeout for approvals
            cleanup_interval_seconds: Interval for cleanup task
        """
        self.default_timeout_minutes = default_timeout_minutes
        self.cleanup_interval_seconds = cleanup_interval_seconds

        # Store active approvals
        self.approvals: Dict[str, ApprovalRequest] = {}

        # Lock for thread-safe operations
        self.lock = asyncio.Lock()

        # Callbacks for status changes
        self.on_approved_callbacks: List[Callable] = []
        self.on_rejected_callbacks: List[Callable] = []
        self.on_expired_callbacks: List[Callable] = []

        # Background task for cleanup
        self.cleanup_task = None

        logger.info("Approval manager initialized")

    async def start(self):
        """Start background tasks."""
        self.cleanup_task = asyncio.create_task(self._cleanup_loop())
        logger.info("Approval manager started")

    async def stop(self):
        """Stop background tasks."""
        if self.cleanup_task:
            self.cleanup_task.cancel()
            try:
                await self.cleanup_task
            except asyncio.CancelledError:
                pass
        logger.info("Approval manager stopped")

    async def create_approval(
        self,
        workflow_execution_id: int,
        node_id: str,
        user_id: int,
        title: str,
        description: str,
        data: Dict[str, Any],
        timeout_minutes: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> ApprovalRequest:
        """
        Create a new approval request.

        Args:
            workflow_execution_id: Workflow execution ID
            node_id: Node requesting approval
            user_id: User who owns the workflow
            title: Approval title
            description: Approval description
            data: Data to be approved
            timeout_minutes: Override default timeout
            metadata: Additional metadata

        Returns:
            Created approval request
        """
        async with self.lock:
            approval_id = str(uuid.uuid4())

            timeout = timeout_minutes or self.default_timeout_minutes
            expires_at = datetime.utcnow() + timedelta(minutes=timeout)

            approval = ApprovalRequest(
                id=approval_id,
                workflow_execution_id=workflow_execution_id,
                node_id=node_id,
                user_id=user_id,
                title=title,
                description=description,
                data=data,
                expires_at=expires_at,
                metadata=metadata or {}
            )

            self.approvals[approval_id] = approval

            logger.info(
                f"Created approval request {approval_id} for workflow {workflow_execution_id}, "
                f"expires at {expires_at}"
            )

            return approval

    async def approve(
        self,
        approval_id: str,
        approved_by: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Approve a request.

        Args:
            approval_id: Approval request ID
            approved_by: Identifier of approver (email, user ID, etc)
            metadata: Additional approval metadata

        Returns:
            True if approved successfully
        """
        async with self.lock:
            approval = self.approvals.get(approval_id)

            if not approval:
                logger.warning(f"Approval {approval_id} not found")
                return False

            if approval.status != ApprovalStatus.PENDING:
                logger.warning(
                    f"Approval {approval_id} already processed: {approval.status.value}"
                )
                return False

            # Check if expired
            if approval.expires_at and datetime.utcnow() > approval.expires_at:
                approval.status = ApprovalStatus.EXPIRED
                logger.warning(f"Approval {approval_id} has expired")
                await self._trigger_callbacks(self.on_expired_callbacks, approval)
                return False

            # Update approval
            approval.status = ApprovalStatus.APPROVED
            approval.approved_by = approved_by
            approval.approved_at = datetime.utcnow()

            if metadata:
                approval.metadata.update(metadata)

            logger.info(f"Approval {approval_id} approved by {approved_by}")

            # Trigger callbacks
            await self._trigger_callbacks(self.on_approved_callbacks, approval)

            return True

    async def reject(
        self,
        approval_id: str,
        rejected_by: str,
        reason: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Reject a request.

        Args:
            approval_id: Approval request ID
            rejected_by: Identifier of rejector
            reason: Rejection reason
            metadata: Additional metadata

        Returns:
            True if rejected successfully
        """
        async with self.lock:
            approval = self.approvals.get(approval_id)

            if not approval:
                logger.warning(f"Approval {approval_id} not found")
                return False

            if approval.status != ApprovalStatus.PENDING:
                logger.warning(
                    f"Approval {approval_id} already processed: {approval.status.value}"
                )
                return False

            # Update approval
            approval.status = ApprovalStatus.REJECTED
            approval.approved_by = rejected_by
            approval.approved_at = datetime.utcnow()
            approval.rejection_reason = reason

            if metadata:
                approval.metadata.update(metadata)

            logger.info(
                f"Approval {approval_id} rejected by {rejected_by}: {reason}"
            )

            # Trigger callbacks
            await self._trigger_callbacks(self.on_rejected_callbacks, approval)

            return True

    async def cancel(self, approval_id: str) -> bool:
        """
        Cancel an approval request.

        Args:
            approval_id: Approval request ID

        Returns:
            True if cancelled successfully
        """
        async with self.lock:
            approval = self.approvals.get(approval_id)

            if not approval:
                logger.warning(f"Approval {approval_id} not found")
                return False

            if approval.status != ApprovalStatus.PENDING:
                logger.warning(
                    f"Approval {approval_id} cannot be cancelled: {approval.status.value}"
                )
                return False

            approval.status = ApprovalStatus.CANCELLED
            logger.info(f"Approval {approval_id} cancelled")

            return True

    async def get_approval(self, approval_id: str) -> Optional[ApprovalRequest]:
        """
        Get an approval request by ID.

        Args:
            approval_id: Approval request ID

        Returns:
            Approval request or None
        """
        async with self.lock:
            return self.approvals.get(approval_id)

    async def wait_for_approval(
        self,
        approval_id: str,
        poll_interval: float = 1.0,
        max_wait_seconds: Optional[float] = None
    ) -> ApprovalStatus:
        """
        Wait for an approval to be processed.

        Args:
            approval_id: Approval request ID
            poll_interval: Polling interval in seconds
            max_wait_seconds: Maximum wait time (None for no limit)

        Returns:
            Final approval status
        """
        start_time = datetime.utcnow()

        while True:
            approval = await self.get_approval(approval_id)

            if not approval:
                logger.error(f"Approval {approval_id} not found")
                return ApprovalStatus.CANCELLED

            if approval.status != ApprovalStatus.PENDING:
                logger.info(
                    f"Approval {approval_id} completed with status: {approval.status.value}"
                )
                return approval.status

            # Check max wait time
            if max_wait_seconds:
                elapsed = (datetime.utcnow() - start_time).total_seconds()
                if elapsed > max_wait_seconds:
                    logger.warning(
                        f"Max wait time exceeded for approval {approval_id}"
                    )
                    return ApprovalStatus.PENDING

            # Check expiration
            if approval.expires_at and datetime.utcnow() > approval.expires_at:
                await self._mark_expired(approval_id)
                return ApprovalStatus.EXPIRED

            await asyncio.sleep(poll_interval)

    async def _mark_expired(self, approval_id: str):
        """Mark an approval as expired."""
        async with self.lock:
            approval = self.approvals.get(approval_id)

            if approval and approval.status == ApprovalStatus.PENDING:
                approval.status = ApprovalStatus.EXPIRED
                logger.info(f"Approval {approval_id} marked as expired")
                await self._trigger_callbacks(self.on_expired_callbacks, approval)

    async def list_pending_approvals(
        self,
        user_id: Optional[int] = None,
        workflow_execution_id: Optional[int] = None
    ) -> List[ApprovalRequest]:
        """
        List pending approval requests.

        Args:
            user_id: Filter by user ID
            workflow_execution_id: Filter by workflow execution

        Returns:
            List of pending approvals
        """
        async with self.lock:
            pending = []

            for approval in self.approvals.values():
                if approval.status != ApprovalStatus.PENDING:
                    continue

                if user_id and approval.user_id != user_id:
                    continue

                if workflow_execution_id and approval.workflow_execution_id != workflow_execution_id:
                    continue

                pending.append(approval)

            return pending

    async def get_approval_statistics(self) -> Dict[str, Any]:
        """
        Get approval statistics.

        Returns:
            Dict with statistics
        """
        async with self.lock:
            stats = {
                'total': len(self.approvals),
                'by_status': {status.value: 0 for status in ApprovalStatus},
                'pending_count': 0,
                'approved_count': 0,
                'rejected_count': 0,
                'expired_count': 0
            }

            for approval in self.approvals.values():
                stats['by_status'][approval.status.value] += 1

                if approval.status == ApprovalStatus.PENDING:
                    stats['pending_count'] += 1
                elif approval.status == ApprovalStatus.APPROVED:
                    stats['approved_count'] += 1
                elif approval.status == ApprovalStatus.REJECTED:
                    stats['rejected_count'] += 1
                elif approval.status == ApprovalStatus.EXPIRED:
                    stats['expired_count'] += 1

            return stats

    def on_approved(self, callback: Callable):
        """Register callback for approved requests."""
        self.on_approved_callbacks.append(callback)

    def on_rejected(self, callback: Callable):
        """Register callback for rejected requests."""
        self.on_rejected_callbacks.append(callback)

    def on_expired(self, callback: Callable):
        """Register callback for expired requests."""
        self.on_expired_callbacks.append(callback)

    async def _trigger_callbacks(
        self,
        callbacks: List[Callable],
        approval: ApprovalRequest
    ):
        """Trigger registered callbacks."""
        for callback in callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(approval)
                else:
                    callback(approval)
            except Exception as e:
                logger.error(f"Error in approval callback: {e}")

    async def _cleanup_loop(self):
        """Background task to cleanup expired approvals."""
        while True:
            try:
                await asyncio.sleep(self.cleanup_interval_seconds)
                await self._cleanup_expired()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")

    async def _cleanup_expired(self):
        """Mark expired approvals and optionally remove old ones."""
        async with self.lock:
            now = datetime.utcnow()
            expired_count = 0

            for approval_id, approval in list(self.approvals.items()):
                if approval.status == ApprovalStatus.PENDING:
                    if approval.expires_at and now > approval.expires_at:
                        approval.status = ApprovalStatus.EXPIRED
                        expired_count += 1
                        logger.info(f"Approval {approval_id} expired")
                        await self._trigger_callbacks(
                            self.on_expired_callbacks, approval
                        )

            if expired_count > 0:
                logger.info(f"Marked {expired_count} approvals as expired")
