"""
SendGrid Email Integration — SPORT Platform
============================================
Constitution §19: Communication Channels

Handles:
- Password reset emails
- User invitation emails
- Beta feedback confirmation
- System alerts to admins
"""

import os
import logging
import sendgrid
from sendgrid.helpers.mail import Mail, Email, To, Content, Subject, HtmlContent

logger = logging.getLogger(__name__)

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "no-reply@4velo.app")
FROM_NAME = os.getenv("FROM_NAME", "4VELO Platform")


class EmailService:
    @staticmethod
    def send(to_email: str, subject: str, body_html: str) -> bool:
        """Sends a transactional email via SendGrid."""
        if not SENDGRID_API_KEY:
            logger.warning(f"SendGrid API key not configured. Would send to {to_email}: {subject}")
            return False

        try:
            sg = sendgrid.SendGridAPIClient(api_key=SENDGRID_API_KEY)
            message = Mail(
                from_email=Email(FROM_EMAIL, FROM_NAME),
                to_emails=To(to_email),
                subject=Subject(subject),
                html_content=HtmlContent(body_html),
            )
            response = sg.send(message)
            logger.info(f"Email sent to {to_email}: {subject} (status {response.status_code})")
            return response.status_code in (200, 201, 202)
        except Exception as e:
            logger.error(f"SendGrid error sending to {to_email}: {e}")
            return False

    @classmethod
    def send_password_reset(cls, to_email: str, reset_token: str) -> bool:
        subject = "4VELO Platform — Password Reset"
        body = f"""
        <div style="font-family: monospace; max-width: 600px; margin: 0 auto; padding: 20px; background: #0B1D33; color: #F5E6CC;">
            <h1 style="color: #D4A373; font-size: 24px;">4VELO PASSWORD RESET</h1>
            <p>Your password reset token:</p>
            <div style="background: #2D2418; padding: 16px; border: 1px solid #D4A373; margin: 16px 0;">
                <code style="font-size: 18px; color: #D4A373;">{reset_token}</code>
            </div>
            <p style="font-size: 12px; color: #8B7355;">This token expires in 30 minutes. If you did not request this, ignore this email.</p>
            <hr style="border-color: #D4A373;">
            <p style="font-size: 10px; color: #8B7355;">4VELO Platform — AntiGravity Systems</p>
        </div>
        """
        return cls.send(to_email, subject, body)

    @classmethod
    def send_invitation(
        cls, to_email: str, username: str, temp_password: str, tenant_name: str = ""
    ) -> bool:
        subject = f"4VELO Platform — Invitation{f' to {tenant_name}' if tenant_name else ''}"
        body = f"""
        <div style="font-family: monospace; max-width: 600px; margin: 0 auto; padding: 20px; background: #0B1D33; color: #F5E6CC;">
            <h1 style="color: #D4A373; font-size: 24px;">YOU HAVE BEEN RECRUITED</h1>
            <p>Welcome to the 4VELO Platform{f" — {tenant_name}" if tenant_name else ""}.</p>
            <p>Your login credentials:</p>
            <div style="background: #2D2418; padding: 16px; border: 1px solid #D4A373; margin: 16px 0;">
                <p style="margin: 4px 0;"><strong>Username:</strong> <code style="color: #D4A373;">{username}</code></p>
                <p style="margin: 4px 0;"><strong>Password:</strong> <code style="color: #D4A373;">{temp_password}</code></p>
            </div>
            <p style="font-size: 12px; color: #8B7355;">Please change your password after first login.</p>
            <hr style="border-color: #D4A373;">
            <p style="font-size: 10px; color: #8B7355;">4VELO Platform — AntiGravity Systems</p>
        </div>
        """
        return cls.send(to_email, subject, body)

    @classmethod
    def send_beta_acknowledgment(cls, to_email: str, category: str) -> bool:
        subject = "4VELO — Beta Feedback Received"
        body = f"""
        <div style="font-family: monospace; max-width: 600px; margin: 0 auto; padding: 20px; background: #0B1D33; color: #F5E6CC;">
            <h1 style="color: #D4A373;">FEEDBACK RECEIVED</h1>
            <p>Thank you for your {category} report. Our team will review it during the beta period.</p>
            <p style="font-size: 12px; color: #8B7355;">Reference: Beta v0.2 RC Testing</p>
            <hr style="border-color: #D4A373;">
            <p style="font-size: 10px; color: #8B7355;">4VELO Platform — AntiGravity Systems</p>
        </div>
        """
        return cls.send(to_email, subject, body)
