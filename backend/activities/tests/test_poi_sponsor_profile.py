"""POI list must not 500 when SPONSOR user has no linked Sponsor row."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()


@pytest.mark.django_db
def test_poi_list_sponsor_without_profile_returns_empty():
    user = User.objects.create_user(
        username="orphan_sponsor",
        password="test-pass",
        role="SPONSOR",
    )
    client = APIClient()
    client.force_authenticate(user=user)
    response = client.get("/api/activities/pois/")
    assert response.status_code == 200
    data = response.json()
    assert data == [] or data.get("results") == []
