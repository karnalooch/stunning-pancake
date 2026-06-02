import pytest
from unittest.mock import patch

from django.urls import reverse
from django.conf import settings
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

from activities.wipe_tasks import run_wipe_sync

User = get_user_model()


@pytest.fixture
def owner_user(db):
    return User.objects.create_user(
        username='owner_wipe',
        email='owner_wipe@test.com',
        password='pass',
        role='GLOBAL_OWNER',
    )


@pytest.fixture
def api_client():
    return APIClient()


@pytest.mark.django_db
def test_wipe_delete_is_idempotent_when_already_running(api_client, owner_user):
    api_client.force_authenticate(user=owner_user)
    url = reverse('admin-wipe-data')
    env = 'DEVELOPMENT' if settings.DEBUG else 'PRODUCTION'
    payload = {
        'confirm': True,
        'confirm_phrase': f'DELETE ALL DATA — {env} — GLOBAL_OWNER',
        'mfa_confirmed': True,
    }

    with patch('activities.wipe_state.get_wipe_state', return_value={
        'running': True,
        'phase': 'users',
        'progress_pct': 61,
        'error': None,
        'deleted': {'users': 12000},
    }), patch('activities.wipe_state.is_wipe_stuck', return_value=False), \
            patch('activities.wipe_tasks.start_wipe_async') as start_async:
        response = api_client.delete(url, payload, format='json')

    assert response.status_code == 202
    assert response.data['running'] is True
    assert response.data['status'] in ('running', 'queued')
    assert 'already running' in response.data['message'].lower()
    start_async.assert_not_called()


@pytest.mark.django_db
def test_batch_start_rejected_while_wipe_in_progress(api_client, owner_user):
    api_client.force_authenticate(user=owner_user)
    url = reverse('admin-simulate')
    with patch('activities.wipe_state.is_wipe_in_progress', return_value=True):
        response = api_client.post(url, {'total_users': 1000}, format='json')
    assert response.status_code == 409
    assert response.data['code'] == 'WIPE_IN_PROGRESS'


@pytest.mark.django_db
def test_live_start_rejected_while_wipe_in_progress(api_client, owner_user):
    api_client.force_authenticate(user=owner_user)
    url = reverse('admin-live-simulate')
    payload = {'pool_pct': 1.0, 'active_ratio': 0.2, 'cheat_ratio': 0.05, 'tick_seconds': 8}
    with patch('activities.wipe_state.is_wipe_in_progress', return_value=True):
        response = api_client.post(url, payload, format='json')
    assert response.status_code == 409
    assert response.data['code'] == 'WIPE_IN_PROGRESS'


def test_run_wipe_sync_lock_conflict_does_not_override_running_state():
    with patch('activities.wipe_tasks.ws.acquire_wipe_lock', return_value=False), \
            patch('activities.wipe_tasks.ws.get_wipe_state', return_value={'running': True}), \
            patch('activities.wipe_tasks.ws.set_wipe_state') as set_state:
        result = run_wipe_sync()

    assert result['status'] == 'already_running'
    set_state.assert_not_called()
