from datetime import UTC, datetime

import pytest
from django.contrib.auth import get_user_model
from rest_framework import serializers

from activities.models import Activity
from activities.serializers import ActivitySerializer
from users.models import Tenant

User = get_user_model()


@pytest.fixture
def tenant(db):
    return Tenant.objects.create(name="T74 City")


@pytest.fixture
def athlete(db, tenant):
    return User.objects.create_user(
        username="t74-athlete",
        email="t74-athlete@example.test",
        password="pass",
        tenant=tenant,
    )


@pytest.mark.django_db
def test_same_start_time_replays_original_activity(athlete):
    payload = {
        "type": "BIKE",
        "start_time": "2026-09-17T20:00:00Z",
    }

    first = ActivitySerializer(data=payload)
    assert first.is_valid(), first.errors
    activity_a = first.save(user=athlete)

    retry = ActivitySerializer(data=payload)
    assert retry.is_valid(), retry.errors
    activity_b = retry.save(user=athlete)

    assert activity_b.pk == activity_a.pk
    assert Activity.objects.filter(user=athlete).count() == 1
    assert activity_a.client_request_id == "start:2026-09-17T20:00:00+00:00"


@pytest.mark.django_db
def test_explicit_request_id_rejects_different_payload(athlete):
    first = ActivitySerializer(
        data={
            "type": "BIKE",
            "start_time": "2026-09-17T20:00:00Z",
            "client_request_id": "ride-intent-123",
        }
    )
    assert first.is_valid(), first.errors
    first.save(user=athlete)

    conflicting = ActivitySerializer(
        data={
            "type": "RUN",
            "start_time": "2026-09-17T20:05:00Z",
            "client_request_id": "ride-intent-123",
        }
    )
    assert conflicting.is_valid(), conflicting.errors

    with pytest.raises(serializers.ValidationError) as exc_info:
        conflicting.save(user=athlete)

    assert exc_info.value.detail["client_request_id"][0] == "idempotency_conflict"
    assert Activity.objects.filter(user=athlete).count() == 1


@pytest.mark.django_db
def test_same_request_id_is_scoped_per_user(tenant):
    user_a = User.objects.create_user(username="t74-a", password="pass", tenant=tenant)
    user_b = User.objects.create_user(username="t74-b", password="pass", tenant=tenant)
    payload = {
        "type": "BIKE",
        "start_time": datetime(2026, 9, 17, 20, 0, tzinfo=UTC),
        "client_request_id": "shared-device-intent",
    }

    serializer_a = ActivitySerializer(data=payload)
    assert serializer_a.is_valid(), serializer_a.errors
    activity_a = serializer_a.save(user=user_a)

    serializer_b = ActivitySerializer(data=payload)
    assert serializer_b.is_valid(), serializer_b.errors
    activity_b = serializer_b.save(user=user_b)

    assert activity_a.pk != activity_b.pk
    assert Activity.objects.filter(client_request_id="shared-device-intent").count() == 2
