"""P3-E1 tenant binding contract for activity creation."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from activities.models import Activity
from users.models import Tenant

User = get_user_model()


class ActivityCreateTenantBindingTest(TestCase):
    def setUp(self):
        self.tenant_a = Tenant.objects.create(name="Tenant A")
        self.tenant_b = Tenant.objects.create(name="Tenant B")
        self.user = User.objects.create_user(
            username="tenant-bound-rider",
            email="tenant-bound@example.com",
            password="testpass123",
            tenant=self.tenant_a,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_activity_inherits_authenticated_users_tenant(self):
        response = self.client.post(
            "/api/activities/sessions/",
            {"type": "BIKE", "start_time": timezone.now().isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        activity = Activity.objects.get(pk=response.data["id"])
        self.assertEqual(activity.user_id, self.user.id)
        self.assertEqual(activity.tenant_id, self.tenant_a.id)

    def test_client_cannot_override_activity_tenant(self):
        response = self.client.post(
            "/api/activities/sessions/",
            {
                "type": "BIKE",
                "start_time": timezone.now().isoformat(),
                "tenant_id": str(self.tenant_b.id),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        activity = Activity.objects.get(pk=response.data["id"])
        self.assertEqual(activity.tenant_id, self.tenant_a.id)

    def test_tenantless_user_is_rejected_fail_closed(self):
        tenantless = User.objects.create_user(
            username="tenantless-rider",
            email="tenantless@example.com",
            password="testpass123",
        )
        self.client.force_authenticate(tenantless)

        response = self.client.post(
            "/api/activities/sessions/",
            {"type": "BIKE", "start_time": timezone.now().isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Activity.objects.filter(user=tenantless).exists())
        self.assertEqual(response.data["tenant"], "tenant_context_required")
