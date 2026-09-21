"""P3-E tenant/user isolation for activity detail and GPX direct IDs."""

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from activities.models import Activity
from users.models import Tenant

User = get_user_model()


@override_settings(SECURE_SSL_REDIRECT=False)
class ActivityReadIsolationTest(TestCase):
    def setUp(self):
        self.tenant_a = Tenant.objects.create(name="Tenant A")
        self.tenant_b = Tenant.objects.create(name="Tenant B")
        self.admin_a = User.objects.create_user(
            username="admin-a",
            password="testpass123",
            role="TENANT_ADMIN",
            tenant=self.tenant_a,
        )
        self.mod_without_tenant = User.objects.create_user(
            username="mod-no-tenant",
            password="testpass123",
            role="TENANT_MODERATOR",
        )
        self.rider_a = User.objects.create_user(
            username="rider-a",
            password="testpass123",
            tenant=self.tenant_a,
        )
        self.rider_b = User.objects.create_user(
            username="rider-b",
            password="testpass123",
            tenant=self.tenant_b,
        )
        self.owner = User.objects.create_user(
            username="global-owner",
            password="testpass123",
            role="GLOBAL_OWNER",
        )
        # These tests exercise object scoping only. Keep route_path NULL so the
        # security contract is independent of the SQLite/PostGIS compatibility
        # shim used by run_pytest.py in blocking CI.
        self.activity_a = Activity.objects.create(
            user=self.rider_a,
            tenant=self.tenant_a,
            type="BIKE",
            start_time=timezone.now(),
        )
        self.activity_b = Activity.objects.create(
            user=self.rider_b,
            tenant=self.tenant_b,
            type="BIKE",
            start_time=timezone.now(),
        )
        self.client = APIClient()

    def detail(self, activity: Activity):
        return self.client.get(f"/api/activities/sessions/{activity.id}/detail/")

    def gpx(self, activity: Activity):
        return self.client.get(f"/api/activities/sessions/{activity.id}/gpx/")

    def test_tenant_admin_cannot_read_foreign_tenant_direct_id(self):
        self.client.force_authenticate(self.admin_a)

        self.assertEqual(self.detail(self.activity_b).status_code, 404)
        self.assertEqual(self.gpx(self.activity_b).status_code, 404)
        self.assertEqual(self.detail(self.activity_a).status_code, 200)

    def test_tenant_role_without_tenant_fails_closed(self):
        self.client.force_authenticate(self.mod_without_tenant)

        self.assertEqual(self.detail(self.activity_a).status_code, 404)
        self.assertEqual(self.detail(self.activity_b).status_code, 404)
        self.assertEqual(self.gpx(self.activity_b).status_code, 404)

    def test_regular_rider_is_owner_only_even_inside_same_platform(self):
        self.client.force_authenticate(self.rider_a)

        self.assertEqual(self.detail(self.activity_a).status_code, 200)
        self.assertEqual(self.detail(self.activity_b).status_code, 404)
        self.assertEqual(self.gpx(self.activity_b).status_code, 404)

    def test_global_owner_retains_explicit_platform_scope(self):
        self.client.force_authenticate(self.owner)

        self.assertEqual(self.detail(self.activity_a).status_code, 200)
        self.assertEqual(self.detail(self.activity_b).status_code, 200)
