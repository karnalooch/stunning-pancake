"""GET status endpoints for batch/live simulator must not 500 on corrupt Redis payloads."""
import json
import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from activities import simulator_state as sim


@pytest.fixture
def owner_client(db):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    owner = User.objects.create_user(
        username='simstatus_owner',
        email='simstatus@test.com',
        password='pass',
        role='GLOBAL_OWNER',
    )
    client = APIClient()
    client.force_authenticate(user=owner)
    return client


@pytest.mark.django_db
def test_batch_status_get_tolerates_corrupt_log(owner_client):
    sim.reset_batch_state()
    sim.set_batch_state(running=False, current_phase='idle', total_users=10, progress_pct='not-a-float')
    from core.redis_cluster import get_redis

    r = get_redis()
    r.rpush(sim.BATCH_LOG_KEY, 'not-json')
    r.rpush(sim.BATCH_LOG_KEY, json.dumps(['12:00:00', 'ok']))

    response = owner_client.get(reverse('admin-simulate'))
    assert response.status_code == 200
    assert response.data['running'] is False
    assert isinstance(response.data['log'], list)


@pytest.mark.django_db
def test_live_status_get_tolerates_corrupt_log(owner_client):
    sim.reset_live_state()
    sim.set_live_state(running=False, active_ratio='bad', cheat_ratio='')
    from core.redis_cluster import get_redis

    r = get_redis()
    r.rpush(sim.LIVE_LOG_KEY, '{broken')
    r.rpush(sim.LIVE_LOG_KEY, json.dumps(['12:00:01', 'tick']))

    response = owner_client.get(reverse('admin-live-simulate'))
    assert response.status_code == 200
    assert response.data['running'] is False
    assert isinstance(response.data['log'], list)
    assert response.data['active_ratio'] == 0.0
