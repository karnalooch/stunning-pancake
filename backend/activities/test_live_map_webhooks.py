from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from activities.models_webhooks import LiveMapAlertWebhook, append_delivery_log, MAX_DELIVERY_LOG
from users.models import Tenant


class LiveMapWebhookDeliveryLogTest(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(name="T1")
        self.wh = LiveMapAlertWebhook.objects.create(
            tenant=self.tenant,
            url="https://example.com/hook",
            secret="s",
            events=["test_ping"],
        )

    def test_append_delivery_log_prepends_and_caps(self):
        for i in range(MAX_DELIVERY_LOG + 3):
            append_delivery_log(
                self.wh.id,
                {"event_id": f"e{i}", "status": "ok", "at": timezone.now().isoformat()},
            )
        self.wh.refresh_from_db()
        self.assertEqual(len(self.wh.delivery_log), MAX_DELIVERY_LOG)
        self.assertEqual(self.wh.delivery_log[0]["event_id"], f"e{MAX_DELIVERY_LOG + 2}")

    @patch("activities.tasks.deliver_live_map_webhook.delay")
    def test_test_ping_records_queued_entry(self, mock_delay):
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIRequestFactory, force_authenticate

        from activities.views import LiveMapWebhookTestView

        User = get_user_model()
        user = User.objects.create_user(
            username="owner",
            password="x",
            role="GLOBAL_OWNER",
        )
        factory = APIRequestFactory()
        request = factory.post(f"/api/activities/telemetry/live/webhooks/{self.wh.id}/test/")
        force_authenticate(request, user=user)
        response = LiveMapWebhookTestView.as_view()(request, pk=self.wh.id)
        self.assertEqual(response.status_code, 202)
        self.wh.refresh_from_db()
        self.assertEqual(self.wh.delivery_log[0]["status"], "queued")
        self.assertEqual(self.wh.delivery_log[0]["event"], "test_ping")
        mock_delay.assert_called_once()
