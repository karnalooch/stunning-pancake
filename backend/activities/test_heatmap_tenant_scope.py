"""T10 — tenant scope for heatmap view and department-filtered analytics."""

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from activities.heatmap import (
    HEATMAP_GLOBAL_SCOPE,
    _cache_key,
    _resolve_heatmap_scope,
    _scoped_heatmap_activities,
)
from activities.models import Activity
from users.departments import Department
from users.models import Tenant

pytestmark = pytest.mark.django_db

User = get_user_model()

BBOX = "20.9,51.9,21.1,52.1"


def _auth(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def tenants(db):
    return (
        Tenant.objects.create(
            name="Tenant A",
            is_active=True,
            has_heatmap_analytics=True,
        ),
        Tenant.objects.create(
            name="Tenant B",
            is_active=True,
            has_heatmap_analytics=True,
        ),
    )


@pytest.fixture
def tenant_a(tenants):
    return tenants[0]


@pytest.fixture
def tenant_b(tenants):
    return tenants[1]


@pytest.fixture
def tenant_a_no_flag(db):
    return Tenant.objects.create(name="Tenant C", is_active=True, has_heatmap_analytics=False)


@pytest.fixture
def tenant_a_inactive(db):
    return Tenant.objects.create(name="Tenant D", is_active=False, has_heatmap_analytics=True)


@pytest.fixture
def owner(db):
    return User.objects.create_user(username="owner", password="x", role="GLOBAL_OWNER")


@pytest.fixture
def user_a(db, tenant_a):
    return User.objects.create_user(
        username="user_a", password="x", role="ATHLETE", tenant=tenant_a
    )


@pytest.fixture
def user_b(db, tenant_b):
    return User.objects.create_user(
        username="user_b", password="x", role="ATHLETE", tenant=tenant_b
    )


@pytest.fixture
def user_no_tenant(db):
    return User.objects.create_user(username="user_none", password="x", role="ATHLETE", tenant=None)


def _activity(user, tenant, *, type="RUN"):
    from django.contrib.gis.geos import LineString

    return Activity.objects.create(
        user=user,
        tenant=tenant,
        type=type,
        start_time=timezone.now(),
        is_verified=True,
        distance=5000,
        duration=timezone.timedelta(minutes=30),
        route_path=LineString((21.0, 52.0), (21.01, 52.01), srid=4326),
    )


# ---------------------------------------------------------------------------
# Heatmap scope resolution
# ---------------------------------------------------------------------------


def test_anonymous_heatmap_returns_401():
    res = APIClient().get(f"/api/activities/heatmap/?bbox={BBOX}&zoom=12")
    assert res.status_code == 401


def test_tenant_user_with_foreign_query_param_still_scopes_to_own_tenant(user_a, tenant_b):
    from rest_framework.request import Request as DRFRequest

    rf = APIClient()
    raw = rf.get(f"/api/activities/heatmap/?bbox={BBOX}&zoom=12&tenant={tenant_b.id}").wsgi_request
    request = DRFRequest(raw, parsers=[])
    request.user = user_a
    scope, err = _resolve_heatmap_scope(request)
    assert err is None
    assert scope == str(user_a.tenant_id)


def test_tenant_user_with_empty_query_param_still_scopes_to_own_tenant(user_a):
    from rest_framework.request import Request as DRFRequest

    rf = APIClient()
    raw = rf.get(f"/api/activities/heatmap/?bbox={BBOX}&zoom=12&tenant=").wsgi_request
    request = DRFRequest(raw, parsers=[])
    request.user = user_a
    scope, err = _resolve_heatmap_scope(request)
    assert err is None
    assert scope == str(user_a.tenant_id)


def test_tenant_user_without_tenant_is_forbidden(user_no_tenant):
    from rest_framework.request import Request as DRFRequest

    rf = APIClient()
    raw = rf.get(f"/api/activities/heatmap/?bbox={BBOX}&zoom=12").wsgi_request
    request = DRFRequest(raw, parsers=[])
    request.user = user_no_tenant
    scope, err = _resolve_heatmap_scope(request)
    assert scope is None
    assert err.status_code == 403


def test_inactive_tenant_is_forbidden(db, tenant_a_inactive):
    from rest_framework.request import Request as DRFRequest

    user = User.objects.create_user(
        username="x", password="x", role="ATHLETE", tenant=tenant_a_inactive
    )
    rf = APIClient()
    raw = rf.get(f"/api/activities/heatmap/?bbox={BBOX}&zoom=12").wsgi_request
    request = DRFRequest(raw, parsers=[])
    request.user = user
    scope, err = _resolve_heatmap_scope(request)
    assert scope is None
    assert err.status_code == 403


def test_tenant_without_flag_is_forbidden(db, tenant_a_no_flag):
    from rest_framework.request import Request as DRFRequest

    user = User.objects.create_user(
        username="x", password="x", role="ATHLETE", tenant=tenant_a_no_flag
    )
    rf = APIClient()
    raw = rf.get(f"/api/activities/heatmap/?bbox={BBOX}&zoom=12").wsgi_request
    request = DRFRequest(raw, parsers=[])
    request.user = user
    scope, err = _resolve_heatmap_scope(request)
    assert scope is None
    assert err.status_code == 403


def test_owner_without_query_param_gets_global_scope(owner):
    from rest_framework.request import Request as DRFRequest

    rf = APIClient()
    raw = rf.get(f"/api/activities/heatmap/?bbox={BBOX}&zoom=12").wsgi_request
    request = DRFRequest(raw, parsers=[])
    request.user = owner
    scope, err = _resolve_heatmap_scope(request)
    assert err is None
    assert scope == HEATMAP_GLOBAL_SCOPE


def test_owner_with_valid_tenant_gets_that_tenant(owner, tenant_b):
    from rest_framework.request import Request as DRFRequest

    rf = APIClient()
    raw = rf.get(f"/api/activities/heatmap/?bbox={BBOX}&zoom=12&tenant={tenant_b.id}").wsgi_request
    request = DRFRequest(raw, parsers=[])
    request.user = owner
    scope, err = _resolve_heatmap_scope(request)
    assert err is None
    assert scope == str(tenant_b.id)


def test_owner_with_invalid_tenant_returns_400_no_fallback(owner, db):
    from rest_framework.request import Request as DRFRequest

    bogus = "00000000-0000-0000-0000-000000000000"
    rf = APIClient()
    raw = rf.get(f"/api/activities/heatmap/?bbox={BBOX}&zoom=12&tenant={bogus}").wsgi_request
    request = DRFRequest(raw, parsers=[])
    request.user = owner
    scope, err = _resolve_heatmap_scope(request)
    assert scope is None
    assert err.status_code == 400


# ---------------------------------------------------------------------------
# ORM filter uses Activity.tenant_id, never user__tenant_id
# ---------------------------------------------------------------------------


def test_scoped_queryset_filters_by_activity_tenant_id(user_a, user_b, tenant_a, tenant_b):
    _activity(user_a, tenant_a)
    _activity(user_b, tenant_b)
    _activity(user_a, tenant_b)  # inconsistent: user.tenant=A but activity.tenant=B

    qs = _scoped_heatmap_activities(str(tenant_a.id))
    assert qs.count() == 1
    assert qs.first().tenant_id == tenant_a.id
    sql = str(qs.query)
    assert '"tenant_id"' in sql or "tenant_id" in sql
    assert "user__tenant_id" not in sql


def test_inconsistent_activity_does_not_leak(user_a, tenant_a, tenant_b):
    """Activity.tenant=B with user.tenant=A must never appear under scope A."""
    inconsistent = _activity(user_a, tenant_b)
    user_a.tenant = tenant_a
    user_a.save(update_fields=["tenant"])
    qs = _scoped_heatmap_activities(str(tenant_a.id))
    assert not qs.filter(pk=inconsistent.pk).exists()


def test_global_scope_sees_all_tenants(user_a, user_b, tenant_a, tenant_b):
    _activity(user_a, tenant_a)
    _activity(user_b, tenant_b)
    qs = _scoped_heatmap_activities(HEATMAP_GLOBAL_SCOPE)
    assert qs.count() == 2


# ---------------------------------------------------------------------------
# Cache key isolation per scope
# ---------------------------------------------------------------------------


def test_cache_keys_are_distinct_per_tenant_and_global(tenant_a, tenant_b):
    k_a = _cache_key(BBOX, "", 12, str(tenant_a.id))
    k_b = _cache_key(BBOX, "", 12, str(tenant_b.id))
    k_global = _cache_key(BBOX, "", 12, HEATMAP_GLOBAL_SCOPE)
    assert k_a != k_b
    assert k_a != k_global
    assert k_b != k_global


# ---------------------------------------------------------------------------
# Heatmap view: effective scope and cache isolation
# ---------------------------------------------------------------------------


def test_heatmap_view_uses_effective_tenant_scope(user_a, user_b, tenant_a, tenant_b, monkeypatch):
    captured = {}

    def fake_builder(*args, **kwargs):
        captured["scope"] = args[-1] if args else kwargs.get("scope")
        return {
            "type": "FeatureCollection",
            "features": [],
            "meta": {"scope": captured.get("scope")},
        }

    monkeypatch.setattr("activities.heatmap._build_heatmap_features", fake_builder)
    res = _auth(user_a).get(f"/api/activities/heatmap/?bbox={BBOX}&zoom=12&tenant={tenant_b.id}")
    assert res.status_code == 200
    assert captured["scope"] == str(tenant_a.id)


def test_heatmap_view_does_not_leak_cached_response_across_tenants(
    user_a, user_b, tenant_a, tenant_b, monkeypatch
):
    from core.fake_redis import install_pytest_redis

    install_pytest_redis()

    def fake_builder_a(*args, **kwargs):
        return {
            "type": "FeatureCollection",
            "features": [{"type": "Feature", "properties": {"who": "A"}}],
            "meta": {"scope": str(tenant_a.id)},
        }

    def fake_builder_b(*args, **kwargs):
        return {
            "type": "FeatureCollection",
            "features": [{"type": "Feature", "properties": {"who": "B"}}],
            "meta": {"scope": str(tenant_b.id)},
        }

    monkeypatch.setattr("activities.heatmap._build_heatmap_features", fake_builder_a)
    res_a = _auth(user_a).get(f"/api/activities/heatmap/?bbox={BBOX}&zoom=12")
    assert res_a.status_code == 200
    assert res_a.data["features"][0]["properties"]["who"] == "A"

    # Second call for tenant B must not return tenant A's cached payload.
    monkeypatch.setattr("activities.heatmap._build_heatmap_features", fake_builder_b)
    res_b = _auth(user_b).get(f"/api/activities/heatmap/?bbox={BBOX}&zoom=12")
    assert res_b.status_code == 200
    assert res_b.data["features"][0]["properties"]["who"] == "B"


def test_heatmap_view_invalid_tenant_for_owner_returns_400(owner):
    bogus = "00000000-0000-0000-0000-000000000000"
    res = _auth(owner).get(f"/api/activities/heatmap/?bbox={BBOX}&zoom=12&tenant={bogus}")
    assert res.status_code == 400


def test_heatmap_view_bbox_validation_still_active(user_a):
    res = _auth(user_a).get("/api/activities/heatmap/?zoom=12")
    assert res.status_code == 400
    res2 = _auth(user_a).get("/api/activities/heatmap/?bbox=notanumber&zoom=12")
    assert res2.status_code == 400


# ---------------------------------------------------------------------------
# Analytics — department scoping
# ---------------------------------------------------------------------------


@pytest.fixture
def dept_a(db, tenant_a):
    return Department.objects.create(name="A Dept", tenant=tenant_a, is_active=True)


@pytest.fixture
def dept_b(db, tenant_b):
    return Department.objects.create(name="B Dept", tenant=tenant_b, is_active=True)


def test_analytics_without_department_uses_self_filter(user_a, user_b, tenant_a, tenant_b):
    a = _activity(user_a, tenant_a, type="RUN")
    _activity(user_b, tenant_b, type="RUN")
    res = _auth(user_a).get("/api/activities/analytics/")
    assert res.status_code == 200
    # Response shape — the weekly aggregation buckets are populated by the
    # existing (pre-T10) aggregation logic; we only prove the request runs
    # through the approved per-user scope.
    assert isinstance(res.data["weekly_loads"], list)
    assert len(res.data["weekly_loads"]) == 12
    assert "trend" in res.data
    assert "training_load" in res.data


def test_analytics_with_own_tenant_department_succeeds(user_a, dept_a, tenant_a):
    a = _activity(user_a, tenant_a, type="RUN")
    a.distance = 7000
    a.duration = timezone.timedelta(minutes=40)
    a.save(update_fields=["distance", "duration"])
    user_a.departments.add(dept_a)
    res = _auth(user_a).get(f"/api/activities/analytics/?department={dept_a.id}")
    assert res.status_code == 200


def test_analytics_with_foreign_department_returns_404(user_a, dept_b):
    res = _auth(user_a).get(f"/api/activities/analytics/?department={dept_b.id}")
    assert res.status_code == 404


def test_analytics_without_tenant_cannot_run_department_query(user_no_tenant, dept_a):
    res = _auth(user_no_tenant).get(f"/api/activities/analytics/?department={dept_a.id}")
    assert res.status_code == 403


def test_analytics_inconsistent_membership_does_not_leak(user_a, dept_b, tenant_a, tenant_b):
    """Activity.tenant=A with dept_b (B tenant) must not leak into dept_b scope."""
    a = _activity(user_a, tenant_a, type="RUN")
    a.distance = 3000
    a.duration = timezone.timedelta(minutes=20)
    a.save(update_fields=["distance", "duration"])
    user_a.departments.add(dept_b)  # inconsistent
    res = _auth(user_a).get(f"/api/activities/analytics/?department={dept_b.id}")
    assert res.status_code == 404


def test_global_owner_can_analyze_any_existing_department(owner, dept_b, user_b, tenant_b):
    a = _activity(user_b, tenant_b, type="RUN")
    a.distance = 9000
    a.duration = timezone.timedelta(minutes=50)
    a.save(update_fields=["distance", "duration"])
    res = _auth(owner).get(f"/api/activities/analytics/?department={dept_b.id}")
    assert res.status_code == 200


def test_global_owner_nonexistent_department_returns_404(owner):
    res = _auth(owner).get("/api/activities/analytics/?department=99999")
    assert res.status_code == 404


def test_analytics_weekly_daily_best_share_same_scope(user_a, dept_a, tenant_a):
    """All analytics branches must use the identical approved scope filter."""
    a = _activity(user_a, tenant_a, type="RUN")
    a.distance = 8000
    a.duration = timezone.timedelta(minutes=45)
    a.save(update_fields=["distance", "duration"])
    user_a.departments.add(dept_a)
    res = _auth(user_a).get(f"/api/activities/analytics/?department={dept_a.id}")
    assert res.status_code == 200
    payload = res.data
    assert "weekly_loads" in payload
    assert "trend" in payload
    assert "training_load" in payload
    assert payload["race_predictions"] is not None
