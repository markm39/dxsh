"""
WebSocket Real-time Collaboration Module

Provides real-time collaboration features for workflow editing.
"""

from .ws_server import WebSocketServer
from .presence_manager import PresenceManager

__all__ = [
    'WebSocketServer',
    'PresenceManager'
]
