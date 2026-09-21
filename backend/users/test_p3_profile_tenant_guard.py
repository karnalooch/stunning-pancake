"""P3-E tenant-transfer guard for registration and authenticated profile."""

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from users.models import Tenant

User = get_user_model()


@override_settings(SECURE_SSL_REDIRECT=False)
class ProfileTenantGuardTest(TestCase):
    def setUp(self):
        self.tenant_a = Tenant.objects.create(name="Tenant A")
        self.tenant_b = Tenant.objects.create(name="Tenant B")
        self.client = APIClient()
        self.url = "/api/users/profile/"

    def patch_tenant(self, user, tenant_id):
        self.client.force_authenticate(user)
        return self.client.patch(
            self.url,
            {"tenant_id": str(tenant_id)},
            format="json",
        )

    def put_tenant(self, user, tenant_id):
        self.client.force_authenticate(user)
        return self.client.put(
            self.url,
            {"tenant_id": str(tenant_id)},
            format="json",
        )

    def test_registration_cannot_prebind_tenant(self):
        response = self.client.post(
            "/api/users/register/",
            {
                "username": "registration-tenant-forgery",
                "email": "registration@example.com",
                "password": "testpass123",
                "tenant_id": str(self.tenant_b.id),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        athlete = User.objects.get(username="registration-tenant-forgery")
        self.assertEqual(athlete.role, "ATHLETE")
        self.assertIsNone(athlete.tenant_id)

    def test_tenantless_athlete_can_select_initial_active_tenant(self):
        athlete = User.objects.create_user(
            username="new-athlete",
            password="testpass123",
            role="ATHLETE",
        )

        response = self.patch_tenant(athlete, self.tenant_a.id)

        self.assertEqual(response.status_code, 200)
        athlete.refresh_from_db()
        self.assertEqual(athlete.tenant_id, self.tenant_a.id)

    def test_existing_athlete_cannot_self_transfer_between_tenants(self):
        athlete = User.objects.create_user(
            username="bound-athlete",
            password="testpass123",
            role="ATHLETE",
            tenant=self.tenant_a,
        )

        response = self.patch_tenant(athlete, self.tenant_b.id)

        self.assertEqual(response.status_code, 403)
        athlete.refresh_from_db()
        self.assertEqual(athlete.tenant_id, self.tenant_a.id)

    def test_existing_athlete_cannot_self_transfer_between_tenants_with_put(self):
        athlete = User.objects.create_user(
            username="bound-athlete-put",
            password="testpass123",
            role="ATHLETE",
            tenant=self.tenant_a,
        )

        response = self.put_tenant(athlete, self.tenant_b.id)

        self.assertEqual(response.status_code, 403)
        athlete.refresh_from_db()
        self.assertEqual(athlete.tenant_id, self.tenant_a.id)

    def test_tenant_admin_cannot_rebind_own_tenant_from_profile(self):
        admin = User.objects.create_user(
            username="tenant-admin",
            password="testpass123",
            role="TENANT_ADMIN",
            tenant=self.tenant_a,
        )

        response = self.patch_tenant(admin, self.tenant_b.id)

        self.assertEqual(response.status_code, 403)
        admin.refresh_from_db()
        self.assertEqual(admin.tenant_id, self.tenant_a.id)

    def test_initial_selection_rejects_inactive_tenant(self):
        inactive = Tenant.objects.create(name="Inactive", is_active=False)
        athlete = User.objects.create_user(
            username="inactive-choice",
            password="testpass123",
            role="ATHLETE",
        )

        response = self.patch_tenant(athlete, inactive.id)

        self.assertEqual(response.status_code, 400)
        athlete.refresh_from_db()
        self.assertIsNone(athlete.tenant_id)

    def test_initial_selection_rejects_malformed_tenant_id(self):
        athlete = User.objects.create_user(
            username="malformed-choice",
            password="testpass123",
            role="ATHLETE",
        )

        response = self.patch_tenant(athlete, "not-a-valid-tenant-id")

        self.assertEqual(response.status_code, 400)
        athlete.refresh_from_db()
        self.assertIsNone(athlete.tenant_id)
