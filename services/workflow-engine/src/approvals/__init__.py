"""
Human-in-the-Loop Approval System

Provides workflow approval capabilities with Slack and email integrations.
"""

from .approval_manager import ApprovalManager, ApprovalStatus
from .slack_integration import SlackIntegration
from .email_integration import EmailIntegration

__all__ = [
    'ApprovalManager',
    'ApprovalStatus',
    'SlackIntegration',
    'EmailIntegration'
]
