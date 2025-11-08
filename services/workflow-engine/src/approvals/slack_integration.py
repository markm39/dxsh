"""
Slack Integration Module

Sends approval requests to Slack channels or users.
"""

import logging
from typing import Dict, Any, Optional
import os
from slack_sdk.web.async_client import AsyncWebClient
from slack_sdk.errors import SlackApiError

logger = logging.getLogger(__name__)


class SlackIntegration:
    """
    Sends approval notifications to Slack.

    Supports interactive buttons for approve/reject actions.
    """

    def __init__(
        self,
        bot_token: Optional[str] = None,
        default_channel: Optional[str] = None
    ):
        """
        Initialize Slack integration.

        Args:
            bot_token: Slack bot token (defaults to SLACK_BOT_TOKEN env var)
            default_channel: Default channel for notifications
        """
        self.bot_token = bot_token or os.getenv('SLACK_BOT_TOKEN')
        self.default_channel = default_channel or os.getenv('SLACK_DEFAULT_CHANNEL', '#approvals')

        if not self.bot_token:
            logger.warning("Slack bot token not configured")
            self.client = None
        else:
            self.client = AsyncWebClient(token=self.bot_token)

        self.approval_base_url = os.getenv('APPROVAL_BASE_URL', 'http://localhost:3000')

    async def send_approval_request(
        self,
        approval_id: str,
        title: str,
        description: str,
        data: Dict[str, Any],
        channel: Optional[str] = None,
        user_email: Optional[str] = None
    ) -> bool:
        """
        Send approval request to Slack.

        Args:
            approval_id: Approval request ID
            title: Approval title
            description: Description
            data: Data to display
            channel: Target channel (overrides default)
            user_email: Email of specific user to notify

        Returns:
            True if sent successfully
        """
        if not self.client:
            logger.warning("Slack client not configured - cannot send approval")
            return False

        try:
            target = channel or self.default_channel

            # If user_email provided, try to get user ID
            if user_email:
                try:
                    user_response = await self.client.users_lookupByEmail(email=user_email)
                    target = user_response['user']['id']
                except SlackApiError:
                    logger.warning(f"Could not find Slack user with email {user_email}")

            # Build message blocks
            blocks = self._build_approval_blocks(
                approval_id, title, description, data
            )

            # Send message
            response = await self.client.chat_postMessage(
                channel=target,
                text=f"Approval Required: {title}",
                blocks=blocks
            )

            logger.info(
                f"Sent approval {approval_id} to Slack channel {target}: "
                f"{response['ts']}"
            )

            return True

        except SlackApiError as e:
            logger.error(f"Failed to send Slack approval: {e.response['error']}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending Slack approval: {e}")
            return False

    def _build_approval_blocks(
        self,
        approval_id: str,
        title: str,
        description: str,
        data: Dict[str, Any]
    ) -> list:
        """
        Build Slack message blocks for approval request.

        Args:
            approval_id: Approval ID
            title: Title
            description: Description
            data: Data to display

        Returns:
            List of Slack blocks
        """
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"Approval Required: {title}"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": description
                }
            }
        ]

        # Add data preview if available
        if data:
            data_preview = self._format_data_preview(data)
            if data_preview:
                blocks.append({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Data Preview:*\n```{data_preview}```"
                    }
                })

        # Add action buttons
        approve_url = f"{self.approval_base_url}/approvals/{approval_id}/approve"
        reject_url = f"{self.approval_base_url}/approvals/{approval_id}/reject"

        blocks.append({
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "Approve"
                    },
                    "style": "primary",
                    "url": approve_url,
                    "value": approval_id
                },
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "Reject"
                    },
                    "style": "danger",
                    "url": reject_url,
                    "value": approval_id
                }
            ]
        })

        # Add footer with approval ID
        blocks.append({
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": f"Approval ID: `{approval_id}`"
                }
            ]
        })

        return blocks

    def _format_data_preview(self, data: Dict[str, Any], max_length: int = 500) -> str:
        """
        Format data for preview in Slack.

        Args:
            data: Data to format
            max_length: Maximum preview length

        Returns:
            Formatted string
        """
        import json

        try:
            formatted = json.dumps(data, indent=2)

            if len(formatted) > max_length:
                formatted = formatted[:max_length] + "\n... (truncated)"

            return formatted

        except Exception:
            return str(data)[:max_length]

    async def send_approval_result(
        self,
        approval_id: str,
        title: str,
        approved: bool,
        approved_by: str,
        channel: Optional[str] = None
    ) -> bool:
        """
        Send approval result notification.

        Args:
            approval_id: Approval ID
            title: Original approval title
            approved: Whether approved or rejected
            approved_by: Who made the decision
            channel: Target channel

        Returns:
            True if sent successfully
        """
        if not self.client:
            return False

        try:
            target = channel or self.default_channel

            status = "Approved" if approved else "Rejected"
            color = "good" if approved else "danger"

            blocks = [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*{status}:* {title}\nBy: {approved_by}"
                    }
                },
                {
                    "type": "context",
                    "elements": [
                        {
                            "type": "mrkdwn",
                            "text": f"Approval ID: `{approval_id}`"
                        }
                    ]
                }
            ]

            await self.client.chat_postMessage(
                channel=target,
                text=f"{status}: {title}",
                blocks=blocks
            )

            logger.info(f"Sent approval result for {approval_id} to Slack")
            return True

        except Exception as e:
            logger.error(f"Failed to send approval result: {e}")
            return False

    async def test_connection(self) -> bool:
        """
        Test Slack connection.

        Returns:
            True if connection successful
        """
        if not self.client:
            logger.error("Slack client not configured")
            return False

        try:
            response = await self.client.auth_test()
            logger.info(f"Slack connection successful: {response['user']}")
            return True

        except SlackApiError as e:
            logger.error(f"Slack connection failed: {e.response['error']}")
            return False
