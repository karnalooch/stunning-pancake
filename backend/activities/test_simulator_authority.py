from types import SimpleNamespace

import pytest
from rest_framework.test import APIRequestFactory

from activities.admin_views import (
    IsGlobalOwnerForSimulatorWrites,
    LiveSimulationView,
    RunSimulationView,
    SimulatorResetView,
    WipeDataView,
)
from users.permissions import IsGlobalOwner

pytestmark = pytest.mark.simulator_light


@pytest.mark.parametrize(
    "view_class",
    (
        RunSimulationView,
        LiveSimulationView,
        SimulatorResetView,
    ),
)
def test_mutating_simulator_views_use_global_owner_write_guard(view_class):
    assert view_class.permission_classes == [IsGlobalOwnerForSimulatorWrites]


def test_wipe_view_remains_global_owner_only():
    assert WipeDataView.permission_classes == [IsGlobalOwner]


@pytest.mark.parametrize("role", ("GLOBAL_OWNER", "TENANT_ADMIN", "TENANT_MODERATOR"))
def test_admin_roles_can_read_simulator_status(role):
    request = APIRequestFactory().get("/api/activities/admin/simulate/")
    request.user = SimpleNamespace(is_authenticated=True, role=role)

    assert IsGlobalOwnerForSimulatorWrites().has_permission(request, None) is True


@pytest.mark.parametrize("method", ("post", "delete"))
def test_only_global_owner_can_mutate_simulator(method):
    request = getattr(APIRequestFactory(), method)("/api/activities/admin/simulate/")
    permission = IsGlobalOwnerForSimulatorWrites()

    request.user = SimpleNamespace(is_authenticated=True, role="GLOBAL_OWNER")
    assert permission.has_permission(request, None) is True

    request.user = SimpleNamespace(is_authenticated=True, role="TENANT_ADMIN")
    assert permission.has_permission(request, None) is False

    request.user = SimpleNamespace(is_authenticated=True, role="TENANT_MODERATOR")
    assert permission.has_permission(request, None) is False
