"""
Email Integration Module

Sends approval notifications via email.
"""

import logging
from typing import Dict, Any, Optional, List
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import aiosmtplib

logger = logging.getLogger(__name__)


class EmailIntegration:
    """
    Sends approval notifications via email.

    Supports HTML emails with approval links.
    """

    def __init__(
        self,
        smtp_host: Optional[str] = None,
        smtp_port: Optional[int] = None,
        smtp_username: Optional[str] = None,
        smtp_password: Optional[str] = None,
        from_email: Optional[str] = None,
        use_tls: bool = True
    ):
        """
        Initialize email integration.

        Args:
            smtp_host: SMTP server host
            smtp_port: SMTP server port
            smtp_username: SMTP username
            smtp_password: SMTP password
            from_email: Sender email address
            use_tls: Whether to use TLS
        """
        self.smtp_host = smtp_host or os.getenv('SMTP_HOST', 'smtp.gmail.com')
        self.smtp_port = smtp_port or int(os.getenv('SMTP_PORT', 587))
        self.smtp_username = smtp_username or os.getenv('SMTP_USERNAME')
        self.smtp_password = smtp_password or os.getenv('SMTP_PASSWORD')
        self.from_email = from_email or os.getenv('SMTP_FROM_EMAIL', self.smtp_username)
        self.use_tls = use_tls

        self.approval_base_url = os.getenv('APPROVAL_BASE_URL', 'http://localhost:3000')

        if not self.smtp_username or not self.smtp_password:
            logger.warning("SMTP credentials not configured")

    async def send_approval_request(
        self,
        approval_id: str,
        title: str,
        description: str,
        data: Dict[str, Any],
        to_emails: List[str],
        workflow_name: Optional[str] = None
    ) -> bool:
        """
        Send approval request email.

        Args:
            approval_id: Approval request ID
            title: Approval title
            description: Description
            data: Data to display
            to_emails: List of recipient email addresses
            workflow_name: Optional workflow name

        Returns:
            True if sent successfully
        """
        try:
            if not self.smtp_username or not self.smtp_password:
                logger.warning("SMTP not configured - cannot send email")
                return False

            # Build email content
            subject = f"Approval Required: {title}"
            html_body = self._build_approval_email_html(
                approval_id, title, description, data, workflow_name
            )
            text_body = self._build_approval_email_text(
                approval_id, title, description, data, workflow_name
            )

            # Create message
            message = MIMEMultipart('alternative')
            message['Subject'] = subject
            message['From'] = self.from_email
            message['To'] = ', '.join(to_emails)

            # Attach text and HTML parts
            text_part = MIMEText(text_body, 'plain')
            html_part = MIMEText(html_body, 'html')
            message.attach(text_part)
            message.attach(html_part)

            # Send email
            await aiosmtplib.send(
                message,
                hostname=self.smtp_host,
                port=self.smtp_port,
                username=self.smtp_username,
                password=self.smtp_password,
                use_tls=self.use_tls
            )

            logger.info(
                f"Sent approval email for {approval_id} to {len(to_emails)} recipients"
            )

            return True

        except Exception as e:
            logger.error(f"Failed to send approval email: {e}")
            return False

    def _build_approval_email_html(
        self,
        approval_id: str,
        title: str,
        description: str,
        data: Dict[str, Any],
        workflow_name: Optional[str]
    ) -> str:
        """
        Build HTML email for approval request.

        Args:
            approval_id: Approval ID
            title: Title
            description: Description
            data: Data to display
            workflow_name: Workflow name

        Returns:
            HTML string
        """
        approve_url = f"{self.approval_base_url}/approvals/{approval_id}/approve"
        reject_url = f"{self.approval_base_url}/approvals/{approval_id}/reject"

        # Format data preview
        import json
        data_preview = json.dumps(data, indent=2)[:1000]

        workflow_info = f"<p><strong>Workflow:</strong> {workflow_name}</p>" if workflow_name else ""

        html = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
        }}
        .container {{
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }}
        .header {{
            background-color: #4CAF50;
            color: white;
            padding: 20px;
            text-align: center;
        }}
        .content {{
            background-color: #f9f9f9;
            padding: 20px;
            margin-top: 20px;
        }}
        .data-preview {{
            background-color: #f4f4f4;
            border-left: 4px solid #4CAF50;
            padding: 10px;
            margin: 15px 0;
            font-family: monospace;
            white-space: pre-wrap;
            overflow-x: auto;
        }}
        .button {{
            display: inline-block;
            padding: 12px 24px;
            margin: 10px 5px;
            text-decoration: none;
            border-radius: 4px;
            font-weight: bold;
        }}
        .approve-button {{
            background-color: #4CAF50;
            color: white;
        }}
        .reject-button {{
            background-color: #f44336;
            color: white;
        }}
        .footer {{
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #666;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Approval Required</h1>
        </div>
        <div class="content">
            <h2>{title}</h2>
            {workflow_info}
            <p>{description}</p>

            <h3>Data Preview:</h3>
            <div class="data-preview">{data_preview}</div>

            <div style="text-align: center; margin: 30px 0;">
                <a href="{approve_url}" class="button approve-button">Approve</a>
                <a href="{reject_url}" class="button reject-button">Reject</a>
            </div>
        </div>
        <div class="footer">
            <p>Approval ID: {approval_id}</p>
            <p>This is an automated message from Dxsh Workflow Engine.</p>
        </div>
    </div>
</body>
</html>
"""
        return html

    def _build_approval_email_text(
        self,
        approval_id: str,
        title: str,
        description: str,
        data: Dict[str, Any],
        workflow_name: Optional[str]
    ) -> str:
        """
        Build plain text email for approval request.

        Args:
            approval_id: Approval ID
            title: Title
            description: Description
            data: Data to display
            workflow_name: Workflow name

        Returns:
            Plain text string
        """
        approve_url = f"{self.approval_base_url}/approvals/{approval_id}/approve"
        reject_url = f"{self.approval_base_url}/approvals/{approval_id}/reject"

        import json
        data_preview = json.dumps(data, indent=2)[:1000]

        workflow_info = f"Workflow: {workflow_name}\n\n" if workflow_name else ""

        text = f"""
APPROVAL REQUIRED

{title}

{workflow_info}{description}

Data Preview:
{data_preview}

Actions:
- Approve: {approve_url}
- Reject: {reject_url}

Approval ID: {approval_id}

---
This is an automated message from Dxsh Workflow Engine.
"""
        return text

    async def send_approval_result(
        self,
        approval_id: str,
        title: str,
        approved: bool,
        approved_by: str,
        to_emails: List[str],
        rejection_reason: Optional[str] = None
    ) -> bool:
        """
        Send approval result notification.

        Args:
            approval_id: Approval ID
            title: Original approval title
            approved: Whether approved or rejected
            approved_by: Who made the decision
            to_emails: Recipient emails
            rejection_reason: Optional rejection reason

        Returns:
            True if sent successfully
        """
        try:
            if not self.smtp_username or not self.smtp_password:
                return False

            status = "Approved" if approved else "Rejected"
            subject = f"{status}: {title}"

            # Build message
            message = MIMEText(
                f"""
{status}: {title}

By: {approved_by}
Approval ID: {approval_id}

{f"Reason: {rejection_reason}" if rejection_reason else ""}

---
This is an automated message from Dxsh Workflow Engine.
""",
                'plain'
            )

            message['Subject'] = subject
            message['From'] = self.from_email
            message['To'] = ', '.join(to_emails)

            # Send email
            await aiosmtplib.send(
                message,
                hostname=self.smtp_host,
                port=self.smtp_port,
                username=self.smtp_username,
                password=self.smtp_password,
                use_tls=self.use_tls
            )

            logger.info(f"Sent approval result for {approval_id} to {len(to_emails)} recipients")
            return True

        except Exception as e:
            logger.error(f"Failed to send result email: {e}")
            return False

    async def test_connection(self) -> bool:
        """
        Test SMTP connection.

        Returns:
            True if connection successful
        """
        try:
            if not self.smtp_username or not self.smtp_password:
                logger.error("SMTP credentials not configured")
                return False

            async with aiosmtplib.SMTP(
                hostname=self.smtp_host,
                port=self.smtp_port,
                use_tls=self.use_tls
            ) as smtp:
                await smtp.login(self.smtp_username, self.smtp_password)
                logger.info("SMTP connection successful")
                return True

        except Exception as e:
            logger.error(f"SMTP connection failed: {e}")
            return False
