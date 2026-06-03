"""
P1 Tests — EmailService (SendGrid)
====================================
RC v0.2: password reset emails, invitation emails, beta acknowledgment.
"""

import pytest
from unittest.mock import patch, MagicMock
from core.email_service import EmailService


class TestEmailService:
    def test_send_password_reset_calls_sendgrid(self):
        with patch("core.email_service.sendgrid.SendGridAPIClient") as mock_sg:
            mock_instance = MagicMock()
            mock_instance.send.return_value.status_code = 202
            mock_sg.return_value = mock_instance

            result = EmailService.send_password_reset("user@test.com", "abc123token")
            assert result is True
            assert mock_sg.called

    def test_send_invitation_calls_sendgrid(self):
        with patch("core.email_service.sendgrid.SendGridAPIClient") as mock_sg:
            mock_instance = MagicMock()
            mock_instance.send.return_value.status_code = 202
            mock_sg.return_value = mock_instance

            result = EmailService.send_invitation(
                "invitee@test.com", "new_user", "temp_pass_123", "Test City"
            )
            assert result is True
            assert mock_sg.called
            # Verify email content includes credentials
            call_args = mock_instance.send.call_args[0][0]
            assert "new_user" in str(call_args)
            assert "temp_pass_123" in str(call_args)

    def test_send_beta_acknowledgment_calls_sendgrid(self):
        with patch("core.email_service.sendgrid.SendGridAPIClient") as mock_sg:
            mock_instance = MagicMock()
            mock_instance.send.return_value.status_code = 202
            mock_sg.return_value = mock_instance

            result = EmailService.send_beta_acknowledgment("tester@test.com", "BUG")
            assert result is True
            assert mock_sg.called

    def test_without_api_key_returns_false(self, monkeypatch):
        monkeypatch.delenv("SENDGRID_API_KEY", raising=False)
        with patch("core.email_service.SENDGRID_API_KEY", ""):
            result = EmailService.send("user@test.com", "Subject", "<p>html</p>")
            assert result is False

    def test_sendgrid_failure_returns_false(self):
        with patch("core.email_service.sendgrid.SendGridAPIClient") as mock_sg:
            mock_instance = MagicMock()
            mock_instance.send.side_effect = Exception("Network error")
            mock_sg.return_value = mock_instance

            result = EmailService.send("user@test.com", "Subject", "<p>html</p>")
            assert result is False

    def test_password_reset_html_contains_token(self):
        with patch("core.email_service.sendgrid.SendGridAPIClient") as mock_sg:
            mock_instance = MagicMock()
            mock_instance.send.return_value.status_code = 202
            mock_sg.return_value = mock_instance

            EmailService.send_password_reset("u@test.com", "SECRET_TOKEN_12345")
            call_args = str(mock_instance.send.call_args[0][0])
            assert "SECRET_TOKEN_12345" in call_args

    def test_invitation_html_contains_credentials(self):
        with patch("core.email_service.sendgrid.SendGridAPIClient") as mock_sg:
            mock_instance = MagicMock()
            mock_instance.send.return_value.status_code = 202
            mock_sg.return_value = mock_instance

            EmailService.send_invitation("a@b.com", "pilot_01", "pass123", "Siedlce City")
            call_args = str(mock_instance.send.call_args[0][0])
            assert "pilot_01" in call_args
            assert "pass123" in call_args
            assert "Siedlce City" in call_args
