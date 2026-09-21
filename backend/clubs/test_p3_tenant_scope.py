"""P3-E tenant isolation for club reads, membership mutations and challenges."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from clubs.models import Club, ClubChallenge, ClubMembership
from users.models import Tenant

User = get_user_model()


@override_settings(SECURE_SSL_REDIRECT=False)
class ClubTenantIsolationTest(TestCase):
    def setUp(self):
        self.tenant_a = Tenant.objects.create(name="Tenant A")
        self.tenant_b = Tenant.objects.create(name="Tenant B")
        self.user_a = User.objects.create_user(username="club-user-a", tenant=self.tenant_a)
        self.user_b = User.objects.create_user(username="club-user-b", tenant=self.tenant_b)
        self.global_owner = User.objects.create_user(
            username="club-global-owner", role="GLOBAL_OWNER"
        )
        self.tenantless = User.objects.create_user(username="club-tenantless")
        self.club_a = Club.objects.create(
            name="Club A",
            slug="club-a",
            sport_type="BIKE",
            tenant_id=str(self.tenant_a.id),
            owner=self.user_a,
        )
        self.club_b = Club.objects.create(
            name="Club B",
            slug="club-b",
            sport_type="BIKE",
            tenant_id=str(self.tenant_b.id),
            owner=self.user_b,
        )
        ClubMembership.objects.create(club=self.club_a, user=self.user_a, status="ACTIVE")
        ClubMembership.objects.create(club=self.club_b, user=self.user_b, status="ACTIVE")
        self.client = APIClient()

    def authenticate(self, user):
        self.client.force_authenticate(user)

    def test_list_and_direct_detail_are_tenant_scoped(self):
        self.authenticate(self.user_a)
        response = self.client.get("/api/clubs/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual({row["id"] for row in response.data}, {self.club_a.id})
        self.assertEqual(self.client.get(f"/api/clubs/{self.club_a.id}/").status_code, 200)
        self.assertEqual(self.client.get(f"/api/clubs/{self.club_b.id}/").status_code, 404)

    def test_foreign_mutations_and_membership_endpoints_fail_closed(self):
        self.authenticate(self.user_a)
        update = self.client.patch(
            f"/api/clubs/{self.club_b.id}/", {"description": "forged"}, format="json"
        )
        self.assertEqual(update.status_code, 404)
        self.assertEqual(self.client.delete(f"/api/clubs/{self.club_b.id}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/clubs/{self.club_b.id}/members/").status_code, 404)
        self.assertEqual(self.client.post(f"/api/clubs/{self.club_b.id}/join/").status_code, 404)
        self.assertEqual(self.client.post(f"/api/clubs/{self.club_b.id}/leave/").status_code, 404)
        self.assertEqual(
            self.client.get(f"/api/clubs/{self.club_b.id}/leaderboard/").status_code, 404
        )
        self.assertFalse(ClubMembership.objects.filter(club=self.club_b, user=self.user_a).exists())

    def test_create_binds_authenticated_tenant_and_detail_cannot_rebind(self):
        self.authenticate(self.user_a)
        response = self.client.post(
            "/api/clubs/",
            {
                "name": "Forged Tenant Club",
                "slug": "forged-tenant-club",
                "sport_type": "BIKE",
                "tenant_id": str(self.tenant_b.id),
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        created = Club.objects.get(slug="forged-tenant-club")
        self.assertEqual(created.tenant_id, str(self.tenant_a.id))

        update = self.client.patch(
            f"/api/clubs/{self.club_a.id}/",
            {"tenant_id": str(self.tenant_b.id), "description": "updated"},
            format="json",
        )
        self.assertEqual(update.status_code, 200)
        self.club_a.refresh_from_db()
        self.assertEqual(self.club_a.tenant_id, str(self.tenant_a.id))
        self.assertEqual(self.club_a.description, "updated")

    def test_tenantless_user_fails_closed(self):
        self.authenticate(self.tenantless)
        response = self.client.get("/api/clubs/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(list(response.data), [])
        self.assertEqual(self.client.get(f"/api/clubs/{self.club_a.id}/").status_code, 404)
        create = self.client.post(
            "/api/clubs/",
            {"name": "No Tenant", "slug": "no-tenant", "sport_type": "BIKE"},
            format="json",
        )
        self.assertEqual(create.status_code, 400)

    def test_inconsistent_membership_is_not_disclosed(self):
        ClubMembership.objects.create(club=self.club_a, user=self.user_b, status="ACTIVE")
        self.authenticate(self.user_a)
        members = self.client.get(f"/api/clubs/{self.club_a.id}/members/")
        self.assertEqual(members.status_code, 200)
        self.assertEqual({row["username"] for row in members.data}, {self.user_a.username})
        detail = self.client.get(f"/api/clubs/{self.club_a.id}/")
        self.assertEqual(detail.data["member_count"], 1)

    def test_challenge_list_and_create_cannot_cross_tenants(self):
        now = timezone.now()
        challenge_a = ClubChallenge.objects.create(
            challenger=self.club_a,
            opponent=self.club_a,
            title="A only",
            sport_type="BIKE",
            start_date=now,
            end_date=now + timedelta(days=1),
            status="ACTIVE",
        )
        ClubChallenge.objects.create(
            challenger=self.club_b,
            opponent=self.club_b,
            title="B only",
            sport_type="BIKE",
            start_date=now,
            end_date=now + timedelta(days=1),
            status="ACTIVE",
        )
        self.authenticate(self.user_a)
        response = self.client.get("/api/clubs/challenges/")
        self.assertEqual({row["id"] for row in response.data}, {challenge_a.id})
        cross = self.client.post(
            "/api/clubs/challenges/",
            {
                "challenger": self.club_a.id,
                "opponent": self.club_b.id,
                "title": "Cross tenant",
                "sport_type": "BIKE",
                "start_date": now.isoformat(),
                "end_date": (now + timedelta(days=1)).isoformat(),
                "status": "PENDING",
            },
            format="json",
        )
        self.assertEqual(cross.status_code, 400)
        self.assertFalse(ClubChallenge.objects.filter(title="Cross tenant").exists())

    def test_global_owner_retains_platform_scope(self):
        self.authenticate(self.global_owner)
        response = self.client.get("/api/clubs/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual({row["id"] for row in response.data}, {self.club_a.id, self.club_b.id})
