"""
WebSocket Server Module

Manages WebSocket connections for real-time collaboration.
"""

import logging
import asyncio
from typing import Dict, Set, Any, Optional
from datetime import datetime
import json
from fastapi import WebSocket, WebSocketDisconnect
from .presence_manager import PresenceManager

logger = logging.getLogger(__name__)


class WebSocketServer:
    """
    WebSocket server for real-time collaboration.

    Handles connections, message broadcasting, and presence tracking.
    """

    def __init__(self):
        """Initialize WebSocket server."""
        # Active connections by workflow_id
        self.connections: Dict[int, Set[WebSocket]] = {}

        # User info by connection
        self.user_info: Dict[WebSocket, Dict[str, Any]] = {}

        # Presence manager
        self.presence_manager = PresenceManager()

        # Message queue for broadcasting
        self.broadcast_queue = asyncio.Queue()

        # Background task
        self.broadcast_task = None

        logger.info("WebSocket server initialized")

    async def start(self):
        """Start background tasks."""
        self.broadcast_task = asyncio.create_task(self._broadcast_loop())
        logger.info("WebSocket server started")

    async def stop(self):
        """Stop background tasks and close all connections."""
        if self.broadcast_task:
            self.broadcast_task.cancel()
            try:
                await self.broadcast_task
            except asyncio.CancelledError:
                pass

        # Close all connections
        for workflow_id, connections in self.connections.items():
            for websocket in connections.copy():
                try:
                    await websocket.close()
                except Exception:
                    pass

        logger.info("WebSocket server stopped")

    async def connect(
        self,
        websocket: WebSocket,
        workflow_id: int,
        user_id: int,
        username: str
    ):
        """
        Register a new WebSocket connection.

        Args:
            websocket: WebSocket connection
            workflow_id: Workflow ID
            user_id: User ID
            username: Username
        """
        await websocket.accept()

        # Add to connections
        if workflow_id not in self.connections:
            self.connections[workflow_id] = set()

        self.connections[workflow_id].add(websocket)

        # Store user info
        self.user_info[websocket] = {
            'workflow_id': workflow_id,
            'user_id': user_id,
            'username': username,
            'connected_at': datetime.utcnow()
        }

        # Register presence
        await self.presence_manager.user_joined(workflow_id, user_id, username)

        # Notify others
        await self.broadcast_to_workflow(
            workflow_id,
            {
                'type': 'user_joined',
                'user_id': user_id,
                'username': username,
                'timestamp': datetime.utcnow().isoformat()
            },
            exclude=websocket
        )

        # Send current presence to new user
        presence = await self.presence_manager.get_workflow_presence(workflow_id)
        await self.send_to_connection(websocket, {
            'type': 'presence_update',
            'users': presence
        })

        logger.info(
            f"User {username} (ID: {user_id}) connected to workflow {workflow_id}"
        )

    async def disconnect(self, websocket: WebSocket):
        """
        Unregister a WebSocket connection.

        Args:
            websocket: WebSocket connection
        """
        if websocket not in self.user_info:
            return

        user_info = self.user_info[websocket]
        workflow_id = user_info['workflow_id']
        user_id = user_info['user_id']
        username = user_info['username']

        # Remove from connections
        if workflow_id in self.connections:
            self.connections[workflow_id].discard(websocket)

            if not self.connections[workflow_id]:
                del self.connections[workflow_id]

        # Remove user info
        del self.user_info[websocket]

        # Unregister presence
        await self.presence_manager.user_left(workflow_id, user_id)

        # Notify others
        await self.broadcast_to_workflow(
            workflow_id,
            {
                'type': 'user_left',
                'user_id': user_id,
                'username': username,
                'timestamp': datetime.utcnow().isoformat()
            }
        )

        logger.info(
            f"User {username} (ID: {user_id}) disconnected from workflow {workflow_id}"
        )

    async def handle_message(self, websocket: WebSocket, message: str):
        """
        Handle incoming WebSocket message.

        Args:
            websocket: WebSocket connection
            message: Message data
        """
        try:
            data = json.loads(message)
            message_type = data.get('type')

            if websocket not in self.user_info:
                logger.warning("Received message from unknown connection")
                return

            user_info = self.user_info[websocket]
            workflow_id = user_info['workflow_id']
            user_id = user_info['user_id']

            # Handle different message types
            if message_type == 'cursor_move':
                await self._handle_cursor_move(websocket, workflow_id, user_id, data)

            elif message_type == 'node_update':
                await self._handle_node_update(websocket, workflow_id, user_id, data)

            elif message_type == 'node_add':
                await self._handle_node_add(websocket, workflow_id, user_id, data)

            elif message_type == 'node_delete':
                await self._handle_node_delete(websocket, workflow_id, user_id, data)

            elif message_type == 'edge_add':
                await self._handle_edge_add(websocket, workflow_id, user_id, data)

            elif message_type == 'edge_delete':
                await self._handle_edge_delete(websocket, workflow_id, user_id, data)

            elif message_type == 'selection_change':
                await self._handle_selection_change(websocket, workflow_id, user_id, data)

            elif message_type == 'ping':
                await self.send_to_connection(websocket, {'type': 'pong'})

            else:
                logger.warning(f"Unknown message type: {message_type}")

        except json.JSONDecodeError:
            logger.error("Invalid JSON message received")
        except Exception as e:
            logger.error(f"Error handling message: {e}")

    async def _handle_cursor_move(
        self,
        websocket: WebSocket,
        workflow_id: int,
        user_id: int,
        data: Dict[str, Any]
    ):
        """Handle cursor movement."""
        position = data.get('position', {})

        # Update presence
        await self.presence_manager.update_cursor(
            workflow_id, user_id, position
        )

        # Broadcast to others
        await self.broadcast_to_workflow(
            workflow_id,
            {
                'type': 'cursor_move',
                'user_id': user_id,
                'position': position,
                'timestamp': datetime.utcnow().isoformat()
            },
            exclude=websocket
        )

    async def _handle_node_update(
        self,
        websocket: WebSocket,
        workflow_id: int,
        user_id: int,
        data: Dict[str, Any]
    ):
        """Handle node update."""
        await self.broadcast_to_workflow(
            workflow_id,
            {
                'type': 'node_update',
                'user_id': user_id,
                'node': data.get('node'),
                'timestamp': datetime.utcnow().isoformat()
            },
            exclude=websocket
        )

    async def _handle_node_add(
        self,
        websocket: WebSocket,
        workflow_id: int,
        user_id: int,
        data: Dict[str, Any]
    ):
        """Handle node addition."""
        await self.broadcast_to_workflow(
            workflow_id,
            {
                'type': 'node_add',
                'user_id': user_id,
                'node': data.get('node'),
                'timestamp': datetime.utcnow().isoformat()
            },
            exclude=websocket
        )

    async def _handle_node_delete(
        self,
        websocket: WebSocket,
        workflow_id: int,
        user_id: int,
        data: Dict[str, Any]
    ):
        """Handle node deletion."""
        await self.broadcast_to_workflow(
            workflow_id,
            {
                'type': 'node_delete',
                'user_id': user_id,
                'node_id': data.get('node_id'),
                'timestamp': datetime.utcnow().isoformat()
            },
            exclude=websocket
        )

    async def _handle_edge_add(
        self,
        websocket: WebSocket,
        workflow_id: int,
        user_id: int,
        data: Dict[str, Any]
    ):
        """Handle edge addition."""
        await self.broadcast_to_workflow(
            workflow_id,
            {
                'type': 'edge_add',
                'user_id': user_id,
                'edge': data.get('edge'),
                'timestamp': datetime.utcnow().isoformat()
            },
            exclude=websocket
        )

    async def _handle_edge_delete(
        self,
        websocket: WebSocket,
        workflow_id: int,
        user_id: int,
        data: Dict[str, Any]
    ):
        """Handle edge deletion."""
        await self.broadcast_to_workflow(
            workflow_id,
            {
                'type': 'edge_delete',
                'user_id': user_id,
                'edge_id': data.get('edge_id'),
                'timestamp': datetime.utcnow().isoformat()
            },
            exclude=websocket
        )

    async def _handle_selection_change(
        self,
        websocket: WebSocket,
        workflow_id: int,
        user_id: int,
        data: Dict[str, Any]
    ):
        """Handle selection change."""
        selected_nodes = data.get('selected_nodes', [])

        await self.presence_manager.update_selection(
            workflow_id, user_id, selected_nodes
        )

        await self.broadcast_to_workflow(
            workflow_id,
            {
                'type': 'selection_change',
                'user_id': user_id,
                'selected_nodes': selected_nodes,
                'timestamp': datetime.utcnow().isoformat()
            },
            exclude=websocket
        )

    async def broadcast_to_workflow(
        self,
        workflow_id: int,
        message: Dict[str, Any],
        exclude: Optional[WebSocket] = None
    ):
        """
        Broadcast message to all connections for a workflow.

        Args:
            workflow_id: Workflow ID
            message: Message to send
            exclude: Connection to exclude from broadcast
        """
        if workflow_id not in self.connections:
            return

        connections = self.connections[workflow_id].copy()

        for websocket in connections:
            if websocket == exclude:
                continue

            await self.send_to_connection(websocket, message)

    async def send_to_connection(
        self,
        websocket: WebSocket,
        message: Dict[str, Any]
    ):
        """
        Send message to a specific connection.

        Args:
            websocket: WebSocket connection
            message: Message to send
        """
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Error sending message: {e}")
            await self.disconnect(websocket)

    async def _broadcast_loop(self):
        """Background task for message broadcasting."""
        while True:
            try:
                workflow_id, message, exclude = await self.broadcast_queue.get()
                await self.broadcast_to_workflow(workflow_id, message, exclude)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in broadcast loop: {e}")

    def get_connection_count(self, workflow_id: Optional[int] = None) -> int:
        """
        Get number of active connections.

        Args:
            workflow_id: Optional workflow ID to filter

        Returns:
            Connection count
        """
        if workflow_id is not None:
            return len(self.connections.get(workflow_id, set()))

        return sum(len(conns) for conns in self.connections.values())

    def get_active_workflows(self) -> list:
        """
        Get list of workflows with active connections.

        Returns:
            List of workflow IDs
        """
        return list(self.connections.keys())
