"""
Presence Manager Module

Tracks active users and their cursor positions in workflows.
"""

import logging
import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from dataclasses import dataclass, field, asdict

logger = logging.getLogger(__name__)


@dataclass
class UserPresence:
    """Represents a user's presence in a workflow."""
    user_id: int
    username: str
    cursor_position: Optional[Dict[str, float]] = None
    selected_nodes: List[str] = field(default_factory=list)
    joined_at: datetime = field(default_factory=datetime.utcnow)
    last_active: datetime = field(default_factory=datetime.utcnow)
    color: Optional[str] = None


class PresenceManager:
    """
    Manages user presence information for real-time collaboration.

    Tracks active users, cursor positions, and selections per workflow.
    """

    def __init__(self, inactive_timeout_minutes: int = 5):
        """
        Initialize presence manager.

        Args:
            inactive_timeout_minutes: Minutes before marking user inactive
        """
        self.inactive_timeout_minutes = inactive_timeout_minutes

        # Presence by workflow_id -> user_id -> UserPresence
        self.presence: Dict[int, Dict[int, UserPresence]] = {}

        # User colors for visual distinction
        self.user_colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
            '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788'
        ]
        self.color_index = 0

        # Lock for thread-safe operations
        self.lock = asyncio.Lock()

        # Background cleanup task
        self.cleanup_task = None

        logger.info("Presence manager initialized")

    async def start(self):
        """Start background tasks."""
        self.cleanup_task = asyncio.create_task(self._cleanup_loop())
        logger.info("Presence manager started")

    async def stop(self):
        """Stop background tasks."""
        if self.cleanup_task:
            self.cleanup_task.cancel()
            try:
                await self.cleanup_task
            except asyncio.CancelledError:
                pass
        logger.info("Presence manager stopped")

    async def user_joined(self, workflow_id: int, user_id: int, username: str):
        """
        Register a user joining a workflow.

        Args:
            workflow_id: Workflow ID
            user_id: User ID
            username: Username
        """
        async with self.lock:
            if workflow_id not in self.presence:
                self.presence[workflow_id] = {}

            # Assign color
            color = self._get_next_color()

            # Create or update presence
            self.presence[workflow_id][user_id] = UserPresence(
                user_id=user_id,
                username=username,
                color=color
            )

            logger.info(
                f"User {username} (ID: {user_id}) joined workflow {workflow_id}"
            )

    async def user_left(self, workflow_id: int, user_id: int):
        """
        Remove a user from a workflow.

        Args:
            workflow_id: Workflow ID
            user_id: User ID
        """
        async with self.lock:
            if workflow_id in self.presence:
                if user_id in self.presence[workflow_id]:
                    username = self.presence[workflow_id][user_id].username
                    del self.presence[workflow_id][user_id]

                    logger.info(
                        f"User {username} (ID: {user_id}) left workflow {workflow_id}"
                    )

                # Clean up empty workflow
                if not self.presence[workflow_id]:
                    del self.presence[workflow_id]

    async def update_cursor(
        self,
        workflow_id: int,
        user_id: int,
        position: Dict[str, float]
    ):
        """
        Update user's cursor position.

        Args:
            workflow_id: Workflow ID
            user_id: User ID
            position: Cursor position {x, y}
        """
        async with self.lock:
            if workflow_id in self.presence and user_id in self.presence[workflow_id]:
                presence = self.presence[workflow_id][user_id]
                presence.cursor_position = position
                presence.last_active = datetime.utcnow()

    async def update_selection(
        self,
        workflow_id: int,
        user_id: int,
        selected_nodes: List[str]
    ):
        """
        Update user's selected nodes.

        Args:
            workflow_id: Workflow ID
            user_id: User ID
            selected_nodes: List of selected node IDs
        """
        async with self.lock:
            if workflow_id in self.presence and user_id in self.presence[workflow_id]:
                presence = self.presence[workflow_id][user_id]
                presence.selected_nodes = selected_nodes
                presence.last_active = datetime.utcnow()

    async def get_workflow_presence(self, workflow_id: int) -> List[Dict[str, Any]]:
        """
        Get all active users for a workflow.

        Args:
            workflow_id: Workflow ID

        Returns:
            List of user presence data
        """
        async with self.lock:
            if workflow_id not in self.presence:
                return []

            users = []
            for user_id, presence in self.presence[workflow_id].items():
                user_data = asdict(presence)
                # Convert datetime to ISO string
                user_data['joined_at'] = presence.joined_at.isoformat()
                user_data['last_active'] = presence.last_active.isoformat()
                users.append(user_data)

            return users

    async def get_user_presence(
        self,
        workflow_id: int,
        user_id: int
    ) -> Optional[Dict[str, Any]]:
        """
        Get presence data for a specific user.

        Args:
            workflow_id: Workflow ID
            user_id: User ID

        Returns:
            User presence data or None
        """
        async with self.lock:
            if workflow_id in self.presence and user_id in self.presence[workflow_id]:
                presence = self.presence[workflow_id][user_id]
                user_data = asdict(presence)
                user_data['joined_at'] = presence.joined_at.isoformat()
                user_data['last_active'] = presence.last_active.isoformat()
                return user_data

            return None

    async def get_active_users_count(self, workflow_id: int) -> int:
        """
        Get count of active users in a workflow.

        Args:
            workflow_id: Workflow ID

        Returns:
            Active user count
        """
        async with self.lock:
            if workflow_id in self.presence:
                return len(self.presence[workflow_id])
            return 0

    async def is_user_active(self, workflow_id: int, user_id: int) -> bool:
        """
        Check if a user is active in a workflow.

        Args:
            workflow_id: Workflow ID
            user_id: User ID

        Returns:
            True if user is active
        """
        async with self.lock:
            if workflow_id in self.presence and user_id in self.presence[workflow_id]:
                presence = self.presence[workflow_id][user_id]
                timeout = timedelta(minutes=self.inactive_timeout_minutes)

                return datetime.utcnow() - presence.last_active < timeout

            return False

    def _get_next_color(self) -> str:
        """
        Get next color for user.

        Returns:
            Hex color string
        """
        color = self.user_colors[self.color_index % len(self.user_colors)]
        self.color_index += 1
        return color

    async def _cleanup_loop(self):
        """Background task to cleanup inactive users."""
        while True:
            try:
                await asyncio.sleep(60)  # Check every minute
                await self._cleanup_inactive_users()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")

    async def _cleanup_inactive_users(self):
        """Remove users who have been inactive."""
        async with self.lock:
            timeout = timedelta(minutes=self.inactive_timeout_minutes)
            now = datetime.utcnow()
            removed_count = 0

            for workflow_id in list(self.presence.keys()):
                for user_id in list(self.presence[workflow_id].keys()):
                    presence = self.presence[workflow_id][user_id]

                    if now - presence.last_active > timeout:
                        username = presence.username
                        del self.presence[workflow_id][user_id]
                        removed_count += 1

                        logger.info(
                            f"Removed inactive user {username} (ID: {user_id}) "
                            f"from workflow {workflow_id}"
                        )

                # Clean up empty workflows
                if not self.presence[workflow_id]:
                    del self.presence[workflow_id]

            if removed_count > 0:
                logger.info(f"Cleaned up {removed_count} inactive users")

    async def get_statistics(self) -> Dict[str, Any]:
        """
        Get presence statistics.

        Returns:
            Statistics dict
        """
        async with self.lock:
            total_users = sum(
                len(users) for users in self.presence.values()
            )

            return {
                'active_workflows': len(self.presence),
                'total_active_users': total_users,
                'workflows': {
                    workflow_id: len(users)
                    for workflow_id, users in self.presence.items()
                }
            }
