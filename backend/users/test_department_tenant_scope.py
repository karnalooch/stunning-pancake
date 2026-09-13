"""T10 — tenant scope for Department / UserDepartment API (RED before fix)."""

import pytest
from rest_framework.test import APIClient

from users.departments import Department, UserDepartment
from users.models import Tenant, User

pytestmark = pytest.mark.django_db

LIST_URL = "/api/users/departments/"
UD_URL = "/api/users/departments/user-departments/"


def _auth(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


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
def admin_a(db, tenant_a):
    return User.objects.create_user(
        username="admin_a", password="x", role="TENANT_ADMIN", tenant=tenant_a
    )


@pytest.fixture
def admin_no_tenant(db):
    return User.objects.create_user(
        username="admin_none", password="x", role="TENANT_ADMIN", tenant=None
    )


@pytest.fixture
def moderator_a(db, tenant_a):
    return User.objects.create_user(
        username="mod_a", password="x", role="TENANT_MODERATOR", tenant=tenant_a
    )


@pytest.fixture
def athlete_a(db, tenant_a):
    return User.objects.create_user(username="ath_a", password="x", role="ATHLETE", tenant=tenant_a)


@pytest.fixture
def sponsor_a(db, tenant_a):
    return User.objects.create_user(
        username="sponsor_a", password="x", role="SPONSOR", tenant=tenant_a
    )


@pytest.fixture
def athlete_b(db, tenant_b):
    return User.objects.create_user(username="ath_b", password="x", role="ATHLETE", tenant=tenant_b)


@pytest.fixture
def dept_a(db, tenant_a):
    return Department.objects.create(name="Dept A", tenant=tenant_a)


@pytest.fixture
def dept_b(db, tenant_b):
    return Department.objects.create(name="Dept B", tenant=tenant_b)


# ---------------------------------------------------------------------------
# A. read access — anonymous 401, tenant isolation
# ---------------------------------------------------------------------------


def test_anonymous_gets_401():
    assert APIClient().get(LIST_URL).status_code == 401


def test_athlete_cannot_create_department(athlete_a, tenant_a):
    res = _auth(athlete_a).post(
        LIST_URL, {"name": "Nope", "department_type": "team"}, format="json"
    )
    assert res.status_code == 403
    assert not Department.objects.filter(name="Nope").exists()


def test_sponsor_cannot_create_department(sponsor_a, tenant_a):
    res = _auth(sponsor_a).post(
        LIST_URL, {"name": "Nope", "department_type": "team"}, format="json"
    )
    assert res.status_code == 403
    assert not Department.objects.filter(name="Nope").exists()


def test_moderator_cannot_mutate_department(moderator_a, dept_a):
    client = _auth(moderator_a)
    assert client.post(LIST_URL, {"name": "Nope"}, format="json").status_code == 403
    assert client.patch(f"{LIST_URL}{dept_a.id}/", {"name": "X"}, format="json").status_code == 403
    assert client.delete(f"{LIST_URL}{dept_a.id}/").status_code == 403
    assert (
        client.post(
            f"{LIST_URL}{dept_a.id}/assign/", {"user_id": moderator_a.id}, format="json"
        ).status_code
        == 403
    )
    dept_a.refresh_from_db()
    assert dept_a.name == "Dept A"


def test_moderator_cannot_mutate_user_department(moderator_a, dept_a):
    res = _auth(moderator_a).post(
        UD_URL,
        {"user_id": moderator_a.id, "department_id": dept_a.id},
        format="json",
    )
    assert res.status_code == 403
    assert UserDepartment.objects.count() == 0


def test_tenant_admin_list_is_tenant_scoped(admin_a, dept_a, dept_b):
    res = _auth(admin_a).get(LIST_URL)
    assert res.status_code == 200
    ids = {row["id"] for row in res.data}
    assert dept_a.id in ids
    assert dept_b.id not in ids


def test_tenant_admin_retrieve_foreign_department_404(admin_a, dept_b):
    assert _auth(admin_a).get(f"{LIST_URL}{dept_b.id}/").status_code == 404


def test_tenant_admin_tree_is_tenant_scoped(admin_a, dept_a, dept_b):
    res = _auth(admin_a).get(f"{LIST_URL}tree/")
    assert res.status_code == 200
    names = {row["name"] for row in res.data}
    assert "Dept A" in names
    assert "Dept B" not in names


def test_tenant_admin_users_action_is_tenant_scoped(admin_a, dept_a, athlete_a, athlete_b):
    UserDepartment.objects.create(user=athlete_a, department=dept_a)
    res = _auth(admin_a).get(f"{LIST_URL}{dept_a.id}/users/")
    assert res.status_code == 200
    usernames = {row["username"] for row in res.data}
    assert "ath_a" in usernames
    assert "ath_b" not in usernames


def test_tenant_admin_without_tenant_fails_closed(admin_no_tenant, dept_a):
    client = _auth(admin_no_tenant)
    assert client.get(LIST_URL).data == []
    res = client.post(LIST_URL, {"name": "Nope"}, format="json")
    assert res.status_code == 403
    assert not Department.objects.filter(name="Nope").exists()


# ---------------------------------------------------------------------------
# B. mutations — tenant admin forced to own tenant
# ---------------------------------------------------------------------------


def test_tenant_admin_create_forces_own_tenant(admin_a, tenant_b):
    res = _auth(admin_a).post(
        LIST_URL,
        {"name": "New A", "department_type": "team", "tenant": str(tenant_b.id)},
        format="json",
    )
    assert res.status_code == 201
    dept = Department.objects.get(name="New A")
    assert dept.tenant_id == admin_a.tenant_id


def test_tenant_admin_update_cannot_move_tenant(admin_a, tenant_a, tenant_b, dept_a):
    res = _auth(admin_a).patch(
        f"{LIST_URL}{dept_a.id}/", {"tenant": str(tenant_b.id)}, format="json"
    )
    assert res.status_code == 200
    dept_a.refresh_from_db()
    assert dept_a.tenant_id == tenant_a.id


def test_foreign_parent_rejected(admin_a, dept_a, dept_b):
    res = _auth(admin_a).patch(f"{LIST_URL}{dept_a.id}/", {"parent": dept_b.id}, format="json")
    assert res.status_code == 400
    dept_a.refresh_from_db()
    assert dept_a.parent_id is None


def test_foreign_moderator_rejected(admin_a, dept_a, athlete_b):
    res = _auth(admin_a).patch(
        f"{LIST_URL}{dept_a.id}/", {"moderator": athlete_b.id}, format="json"
    )
    assert res.status_code == 400
    dept_a.refresh_from_db()
    assert dept_a.moderator_id is None


def test_assign_foreign_tenant_user_rejected(admin_a, dept_a, athlete_b):
    res = _auth(admin_a).post(
        f"{LIST_URL}{dept_a.id}/assign/", {"user_id": athlete_b.id}, format="json"
    )
    assert res.status_code in (400, 403, 404)
    assert not UserDepartment.objects.filter(user=athlete_b, department=dept_a).exists()


def test_assign_own_tenant_user_succeeds(admin_a, dept_a, athlete_a):
    res = _auth(admin_a).post(
        f"{LIST_URL}{dept_a.id}/assign/", {"user_id": athlete_a.id}, format="json"
    )
    assert res.status_code == 200
    assert UserDepartment.objects.filter(user=athlete_a, department=dept_a).exists()


def test_remove_does_not_delete_cross_tenant_membership(admin_a, dept_a, athlete_b):
    UserDepartment.objects.create(user=athlete_b, department=dept_a)
    res = _auth(admin_a).post(
        f"{LIST_URL}{dept_a.id}/remove/", {"user_id": athlete_b.id}, format="json"
    )
    assert res.status_code in (400, 403, 404)
    assert UserDepartment.objects.filter(user=athlete_b, department=dept_a).exists()


def test_user_department_direct_post_blocks_cross_tenant(admin_a, dept_a, athlete_b):
    res = _auth(admin_a).post(
        UD_URL,
        {"user_id": athlete_b.id, "department_id": dept_a.id},
        format="json",
    )
    assert res.status_code == 400
    assert not UserDepartment.objects.filter(user=athlete_b, department=dept_a).exists()


def test_user_department_direct_post_same_tenant_succeeds(admin_a, dept_a, athlete_a):
    res = _auth(admin_a).post(
        UD_URL,
        {"user_id": athlete_a.id, "department_id": dept_a.id},
        format="json",
    )
    assert res.status_code == 201
    assert UserDepartment.objects.filter(user=athlete_a, department=dept_a).exists()


def test_user_department_list_is_tenant_scoped(admin_a, dept_a, dept_b, athlete_a, athlete_b):
    UserDepartment.objects.create(user=athlete_a, department=dept_a)
    UserDepartment.objects.create(user=athlete_b, department=dept_b)
    res = _auth(admin_a).get(UD_URL)
    assert res.status_code == 200
    results = res.data.get("results", res.data) if isinstance(res.data, dict) else res.data
    dept_ids = {row["department"]["id"] for row in results}
    assert dept_a.id in dept_ids
    assert dept_b.id not in dept_ids


# ---------------------------------------------------------------------------
# C. self_join
# ---------------------------------------------------------------------------


def test_athlete_without_tenant_cannot_self_join(db, dept_a):
    athlete = User.objects.create_user(
        username="ath_none", password="x", role="ATHLETE", tenant=None
    )
    res = _auth(athlete).post(f"{LIST_URL}{dept_a.id}/self-join/")
    assert res.status_code == 403
    assert not UserDepartment.objects.filter(user=athlete).exists()


def test_self_join_own_active_department_succeeds(athlete_a, dept_a):
    res = _auth(athlete_a).post(f"{LIST_URL}{dept_a.id}/self-join/")
    assert res.status_code == 200
    assert UserDepartment.objects.filter(user=athlete_a, department=dept_a).exists()


def test_self_join_foreign_department_rejected(athlete_a, dept_b):
    res = _auth(athlete_a).post(f"{LIST_URL}{dept_b.id}/self-join/")
    assert res.status_code in (403, 404)
    assert not UserDepartment.objects.filter(user=athlete_a, department=dept_b).exists()


def test_self_join_inactive_department_rejected(athlete_a, tenant_a):
    inactive = Department.objects.create(name="Inactive", tenant=tenant_a, is_active=False)
    res = _auth(athlete_a).post(f"{LIST_URL}{inactive.id}/self-join/")
    assert res.status_code == 404
    assert not UserDepartment.objects.filter(user=athlete_a, department=inactive).exists()


def test_sponsor_cannot_self_join(sponsor_a, dept_a):
    res = _auth(sponsor_a).post(f"{LIST_URL}{dept_a.id}/self-join/")
    assert res.status_code == 403
    assert not UserDepartment.objects.filter(user=sponsor_a).exists()


# ---------------------------------------------------------------------------
# C. my — no foreign leak
# ---------------------------------------------------------------------------


def test_my_does_not_leak_foreign_department(athlete_a, dept_a, dept_b):
    UserDepartment.objects.create(user=athlete_a, department=dept_a)
    UserDepartment.objects.create(user=athlete_a, department=dept_b)  # inconsistent history
    res = _auth(athlete_a).get(f"{LIST_URL}my/")
    assert res.status_code == 200
    ids = {row["id"] for row in res.data}
    assert dept_a.id in ids
    assert dept_b.id not in ids


def test_my_for_global_owner_returns_only_own_memberships(owner, dept_a, dept_b):
    UserDepartment.objects.create(user=owner, department=dept_a)
    res = _auth(owner).get(f"{LIST_URL}my/")
    assert res.status_code == 200
    ids = {row["id"] for row in res.data}
    assert ids == {dept_a.id}


# ---------------------------------------------------------------------------
# GLOBAL_OWNER
# ---------------------------------------------------------------------------


def test_global_owner_sees_all_tenants(owner, dept_a, dept_b):
    res = _auth(owner).get(LIST_URL)
    assert res.status_code == 200
    ids = {row["id"] for row in res.data}
    assert {dept_a.id, dept_b.id}.issubset(ids)


def test_global_owner_create_with_explicit_tenant(owner, tenant_b):
    res = _auth(owner).post(
        LIST_URL,
        {"name": "B dept", "department_type": "team", "tenant": str(tenant_b.id)},
        format="json",
    )
    assert res.status_code == 201
    assert Department.objects.get(name="B dept").tenant_id == tenant_b.id


def test_global_owner_create_without_tenant_rejected(owner):
    res = _auth(owner).post(LIST_URL, {"name": "No tenant"}, format="json")
    assert res.status_code == 400
    assert not Department.objects.filter(name="No tenant").exists()


def test_global_owner_cannot_create_cross_tenant_parent(owner, tenant_a, dept_b):
    res = _auth(owner).post(
        LIST_URL,
        {
            "name": "Cross parent",
            "department_type": "team",
            "tenant": str(tenant_a.id),
            "parent": dept_b.id,
        },
        format="json",
    )
    assert res.status_code == 400
    assert not Department.objects.filter(name="Cross parent").exists()


def test_global_owner_cannot_assign_cross_tenant_user(owner, dept_a, athlete_b):
    res = _auth(owner).post(
        f"{LIST_URL}{dept_a.id}/assign/", {"user_id": athlete_b.id}, format="json"
    )
    assert res.status_code in (400, 403, 404)
    assert not UserDepartment.objects.filter(user=athlete_b, department=dept_a).exists()


def test_global_owner_assign_consistent_user_succeeds(owner, dept_a, athlete_a):
    res = _auth(owner).post(
        f"{LIST_URL}{dept_a.id}/assign/", {"user_id": athlete_a.id}, format="json"
    )
    assert res.status_code == 200
    assert UserDepartment.objects.filter(user=athlete_a, department=dept_a).exists()
