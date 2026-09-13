"""T10 — tenant scope for moderation queue / approve / reject / assign / history."""

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from activities.models import Activity
from users.models import Tenant, User

pytestmark = pytest.mark.django_db

QUEUE_URL = "/api/activities/admin/moderation/queue/"
HISTORY_URL = "/api/activities/admin/moderation/history/"


def _auth(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _activity(user, tenant, *, verified=False):
    return Activity.objects.create(
        user=user,
        tenant=tenant,
        type="BIKE",
        start_time=timezone.now(),
        is_verified=verified,
    )


@pytest.fixture
def tenants(db):
    return (
        Tenant.objects.create(name="Tenant A", is_active=True),
        Tenant.objects.create(name="Tenant B", is_active=True),
    )


@pytest.fixture
def tenant_a(tenants):
    return tenants[0]


@pytest.fixture
def tenant_b(tenants):
    return tenants[1]


@pytest.fixture
def owner(db):
    return User.objects.create_user(username="owner", password="x", role="GLOBAL_OWNER")


@pytest.fixture
def moderator_a(db, tenant_a):
    return User.objects.create_user(
        username="mod_a", password="x", role="TENANT_MODERATOR", tenant=tenant_a
    )


@pytest.fixture
def moderator_b(db, tenant_b):
    return User.objects.create_user(
        username="mod_b", password="x", role="TENANT_MODERATOR", tenant=tenant_b
    )


@pytest.fixture
def moderator_no_tenant(db):
    return User.objects.create_user(
        username="mod_none", password="x", role="TENANT_MODERATOR", tenant=None
    )


@pytest.fixture
def admin_a(db, tenant_a):
    return User.objects.create_user(
        username="admin_a", password="x", role="TENANT_ADMIN", tenant=tenant_a
    )


@pytest.fixture
def athlete_a(db, tenant_a):
    return User.objects.create_user(username="ath_a", password="x", role="ATHLETE", tenant=tenant_a)


@pytest.fixture
def athlete_b(db, tenant_b):
    return User.objects.create_user(username="ath_b", password="x", role="ATHLETE", tenant=tenant_b)


@pytest.fixture
def sponsor_a(db, tenant_a):
    return User.objects.create_user(
        username="sponsor_a", password="x", role="SPONSOR", tenant=tenant_a
    )


@pytest.fixture
def activity_a(db, tenant_a, athlete_a):
    return _activity(athlete_a, tenant_a)


@pytest.fixture
def activity_b(db, tenant_b, athlete_b):
    return _activity(athlete_b, tenant_b)


# ---------------------------------------------------------------------------
# Access matrix
# ---------------------------------------------------------------------------


def test_anonymous_rejected():
    assert APIClient().get(QUEUE_URL).status_code in (401, 403)


@pytest.mark.parametrize("fixture_name", ["athlete_a", "sponsor_a"])
def test_non_moderator_roles_rejected(request, fixture_name):
    user = request.getfixturevalue(fixture_name)
    assert _auth(user).get(QUEUE_URL).status_code == 403


def test_queue_scoped_to_own_tenant(moderator_a, activity_a, activity_b):
    res = _auth(moderator_a).get(QUEUE_URL)
    assert res.status_code == 200
    tenant_ids = {row["tenant_id"] for row in res.data["results"]}
    assert tenant_ids == {str(moderator_a.tenant_id)}


def test_queue_without_tenant_is_empty_not_global(moderator_no_tenant, activity_a, activity_b):
    res = _auth(moderator_no_tenant).get(QUEUE_URL)
    assert res.status_code == 200
    assert res.data["count"] == 0
    assert res.data["results"] == []


def test_tenant_admin_queue_scoped(admin_a, activity_a, activity_b):
    res = _auth(admin_a).get(QUEUE_URL)
    assert res.status_code == 200
    tenant_ids = {row["tenant_id"] for row in res.data["results"]}
    assert tenant_ids == {str(admin_a.tenant_id)}


def test_global_owner_queue_is_global(owner, activity_a, activity_b):
    res = _auth(owner).get(QUEUE_URL)
    assert res.status_code == 200
    assert res.data["count"] == 2


# ---------------------------------------------------------------------------
# approve / reject without tenant must fail closed
# ---------------------------------------------------------------------------


def test_moderator_without_tenant_cannot_approve(moderator_no_tenant, activity_a):
    res = _auth(moderator_no_tenant).post(f"/api/activities/admin/approve/{activity_a.id}/")
    assert res.status_code == 403
    activity_a.refresh_from_db()
    assert activity_a.is_verified is False


def test_moderator_without_tenant_cannot_reject(moderator_no_tenant, activity_a):
    res = _auth(moderator_no_tenant).post(
        f"/api/activities/admin/reject/{activity_a.id}/", {"reason": "OTHER"}, format="json"
    )
    assert res.status_code == 403
    activity_a.refresh_from_db()
    assert activity_a.is_verified is False


def test_moderator_without_tenant_cannot_assign(moderator_no_tenant, activity_a):
    res = _auth(moderator_no_tenant).patch(
        f"/api/activities/admin/moderation/assign/{activity_a.id}/",
        {"assignee_id": None},
        format="json",
    )
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# cross-tenant mutations keep 403
# ---------------------------------------------------------------------------


def test_cross_tenant_approve_forbidden(moderator_b, activity_a):
    res = _auth(moderator_b).post(f"/api/activities/admin/approve/{activity_a.id}/")
    assert res.status_code == 403
    activity_a.refresh_from_db()
    assert activity_a.is_verified is False


def test_cross_tenant_reject_forbidden(moderator_b, activity_a):
    res = _auth(moderator_b).post(
        f"/api/activities/admin/reject/{activity_a.id}/", {"reason": "OTHER"}, format="json"
    )
    assert res.status_code == 403


def test_cross_tenant_assign_forbidden(moderator_b, activity_a):
    res = _auth(moderator_b).patch(
        f"/api/activities/admin/moderation/assign/{activity_a.id}/",
        {"assignee_id": None},
        format="json",
    )
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# assignee scoping
# ---------------------------------------------------------------------------


def test_assignee_from_foreign_tenant_rejected(moderator_a, activity_a, moderator_b):
    res = _auth(moderator_a).patch(
        f"/api/activities/admin/moderation/assign/{activity_a.id}/",
        {"assignee_id": moderator_b.id},
        format="json",
    )
    assert res.status_code in (400, 403)
    activity_a.refresh_from_db()
    assert activity_a.moderation_assignee_id is None


def test_assignee_with_disallowed_role_rejected(moderator_a, activity_a, athlete_a):
    res = _auth(moderator_a).patch(
        f"/api/activities/admin/moderation/assign/{activity_a.id}/",
        {"assignee_id": athlete_a.id},
        format="json",
    )
    assert res.status_code in (400, 403)
    activity_a.refresh_from_db()
    assert activity_a.moderation_assignee_id is None


def test_assignee_none_unassigns(moderator_a, activity_a):
    activity_a.moderation_assignee = moderator_a
    activity_a.save(update_fields=["moderation_assignee"])
    res = _auth(moderator_a).patch(
        f"/api/activities/admin/moderation/assign/{activity_a.id}/",
        {"assignee_id": None},
        format="json",
    )
    assert res.status_code == 200
    activity_a.refresh_from_db()
    assert activity_a.moderation_assignee_id is None


def test_assign_same_tenant_succeeds(moderator_a, activity_a, athlete_a):
    res = _auth(moderator_a).patch(
        f"/api/activities/admin/moderation/assign/{activity_a.id}/",
        {"assignee_id": moderator_a.id},
        format="json",
    )
    assert res.status_code == 200
    activity_a.refresh_from_db()
    assert activity_a.moderation_assignee_id == moderator_a.id


# ---------------------------------------------------------------------------
# history
# ---------------------------------------------------------------------------


def test_history_scoped_to_tenant(moderator_a, tenant_a, tenant_b, athlete_a, athlete_b):
    in_a = _activity(athlete_a, tenant_a, verified=True)
    in_a.moderated_by = moderator_a
    in_a.moderated_at = timezone.now()
    in_a.save(update_fields=["moderated_by", "moderated_at"])
    foreign = _activity(athlete_b, tenant_b, verified=True)
    foreign.moderated_by = moderator_a  # inconsistent historical row
    foreign.moderated_at = timezone.now()
    foreign.save(update_fields=["moderated_by", "moderated_at"])

    res = _auth(moderator_a).get(HISTORY_URL)
    assert res.status_code == 200
    ids = {row["activity_id"] for row in res.data["results"]}
    assert in_a.id in ids
    assert foreign.id not in ids


def test_history_without_tenant_is_empty(moderator_no_tenant, activity_a):
    activity_a.moderated_by = moderator_no_tenant
    activity_a.moderated_at = timezone.now()
    activity_a.save(update_fields=["moderated_by", "moderated_at"])
    res = _auth(moderator_no_tenant).get(HISTORY_URL)
    assert res.status_code == 200
    assert res.data["results"] == []


def test_global_owner_history_keeps_global_scope(owner, activity_a, activity_b):
    for activity in (activity_a, activity_b):
        activity.moderated_by = owner
        activity.moderated_at = timezone.now()
        activity.save(update_fields=["moderated_by", "moderated_at"])
    res = _auth(owner).get(HISTORY_URL)
    assert res.status_code == 200
    assert res.data["count"] == 2


# ---------------------------------------------------------------------------
# positives
# ---------------------------------------------------------------------------


def test_tenant_admin_can_reject_own_activity(admin_a, activity_a):
    res = _auth(admin_a).post(
        f"/api/activities/admin/reject/{activity_a.id}/",
        {"reason": "OTHER"},
        format="json",
    )
    assert res.status_code == 200
    activity_a.refresh_from_db()
    assert activity_a.is_verified is False


def test_global_owner_can_reject_any(owner, activity_b):
    res = _auth(owner).post(
        f"/api/activities/admin/reject/{activity_b.id}/",
        {"reason": "OTHER"},
        format="json",
    )
    assert res.status_code == 200
    activity_b.refresh_from_db()
    assert activity_b.is_verified is False


def test_approve_uses_approved_scope_for_tenant_admin(admin_a, activity_a, activity_b):
    """Approve path must resolve the activity through the moderated scope.

    The actual side-effects of ``apply_moderation_approve`` (leaderboard credit,
    GPX archive) are pre-existing business logic unrelated to T10; we only
    prove that the tenant scope is honoured before any of that runs.
    """
    from unittest.mock import patch

    with patch(
        "activities.moderation_views.apply_moderation_approve",
        return_value={"status": "approved", "activity_id": activity_a.id},
    ) as approve:
        res_own = _auth(admin_a).post(f"/api/activities/admin/approve/{activity_a.id}/")
        assert res_own.status_code == 200
        approve.assert_called_once()

        res_cross = _auth(admin_a).post(f"/api/activities/admin/approve/{activity_b.id}/")
        assert res_cross.status_code == 403
