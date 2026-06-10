"""POI list must not 500 when SPONSOR user has no linked Sponsor row."""

import pytest
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from rest_framework.test import APIClient

from activities.models import POI

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


@pytest.mark.django_db
def test_poi_list_with_existing_poi_returns_coordinates():
    """Regression: serializing a saved POI must not 500 (latitude/longitude
    are derived from the `location` PointField, not stored as attributes)."""
    user = User.objects.create_user(
        username="owner",
        password="test-pass",
        role="GLOBAL_OWNER",
    )
    POI.objects.create(name="Cafe", category="COFFEE", location=Point(21.01, 52.23, srid=4326))

    client = APIClient()
    client.force_authenticate(user=user)
    response = client.get("/api/activities/pois/")

    # Before the fix, latitude/longitude were readable FloatFields with no
    # matching model attribute, so DRF raised AttributeError -> HTTP 500 here.
    assert response.status_code == 200
    data = response.json()
    rows = data if isinstance(data, list) else data.get("results", [])
    assert len(rows) == 1
    assert rows[0]["name"] == "Cafe"
    assert "latitude" in rows[0]
    assert "longitude" in rows[0]
