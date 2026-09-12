from types import SimpleNamespace
from unittest.mock import patch

import pytest
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory, force_authenticate

from activities.admin_views import (
    ExportDataView,
    GarminGenerateEmailView,
    GarminSimulateView,
    GarminSummaryClearView,
)
from activities.leaderboard_views import (
    admin_clear_leaderboard,
    admin_leaderboard_list,
    admin_recalculate_leaderboards,
)
from users.permissions import IsGlobalOwner, IsTenantAdmin


def _user(role: str) -> SimpleNamespace:
    return SimpleNamespace(is_authenticated=True, role=role, id=1, pk=1)


@pytest.mark.parametrize(
    "view_class",
    (GarminSimulateView, GarminSummaryClearView, GarminGenerateEmailView),
)
def test_garmin_administration_is_global_owner_only(view_class):
    assert view_class.permission_classes == [IsGlobalOwner]


@pytest.mark.parametrize(
    "view",
    (admin_recalculate_leaderboards, admin_leaderboard_list, admin_clear_leaderboard),
)
def test_leaderboard_administration_is_global_owner_only(view):
    assert view.cls.permission_classes == [permissions.IsAuthenticated, IsGlobalOwner]


def test_data_export_requires_tenant_admin():
    assert ExportDataView.permission_classes == (permissions.IsAuthenticated, IsTenantAdmin)


@pytest.mark.parametrize(
    ("view_class", "method", "path"),
    (
        (GarminSimulateView, "post", "/api/activities/admin/garmin-simulate/"),
        (GarminSimulateView, "delete", "/api/activities/admin/garmin-simulate/"),
        (GarminSummaryClearView, "post", "/api/activities/admin/garmin-summary-clear/"),
        (GarminGenerateEmailView, "post", "/api/activities/admin/garmin-generate-emails/"),
    ),
)
@pytest.mark.parametrize("role", ("TENANT_ADMIN", "TENANT_MODERATOR"))
def test_tenant_role_cannot_run_garmin_operation(view_class, method, path, role):
    request = getattr(APIRequestFactory(), method)(path)
    force_authenticate(request, user=_user(role))

    with patch.object(view_class, method, return_value=Response({})) as operation:
        response = view_class.as_view()(request)

    assert response.status_code == 403
    operation.assert_not_called()


@pytest.mark.parametrize("role", ("TENANT_ADMIN", "TENANT_MODERATOR"))
def test_tenant_role_cannot_clear_leaderboard(role):
    request = APIRequestFactory().delete("/api/activities/leaderboard/admin/city-a/")
    force_authenticate(request, user=_user(role))

    with patch("activities.leaderboard_views.LeaderboardService.clear_leaderboard") as clear:
        response = admin_clear_leaderboard(request, city_id="city-a")

    assert response.status_code == 403
    clear.assert_not_called()


def test_moderator_cannot_export_data():
    request = APIRequestFactory().get("/api/activities/export/activities/")
    force_authenticate(request, user=_user("TENANT_MODERATOR"))

    with patch.object(ExportDataView, "_export_activities") as export:
        response = ExportDataView.as_view()(request, resource="activities")

    assert response.status_code == 403
    export.assert_not_called()


def test_global_owner_can_clear_leaderboard():
    request = APIRequestFactory().delete("/api/activities/leaderboard/admin/city-a/")
    force_authenticate(request, user=_user("GLOBAL_OWNER"))

    with patch("activities.leaderboard_views.LeaderboardService.clear_leaderboard") as clear:
        response = admin_clear_leaderboard(request, city_id="city-a")

    assert response.status_code == 200
    clear.assert_called_once_with("city-a", scope="city")


def test_tenant_admin_can_export_data():
    request = APIRequestFactory().get("/api/activities/export/activities/")
    force_authenticate(request, user=_user("TENANT_ADMIN"))

    with patch.object(ExportDataView, "_export_activities", return_value={"data": []}) as export:
        response = ExportDataView.as_view()(request, resource="activities")

    assert response.status_code == 200
    export.assert_called_once()
