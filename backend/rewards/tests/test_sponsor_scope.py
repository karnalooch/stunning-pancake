"""Sponsor F0 — POI and stats scoped to sponsor."""

import pytest
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from rest_framework.test import APIClient

from activities.models import POI
from rewards.models import Sponsor
from users.models import Tenant

User = get_user_model()


@pytest.fixture
def sponsor_users(db):
    tenant = Tenant.objects.create(name="Sponsor City")
    s1 = Sponsor.objects.create(name="Coffee Co", tenant_id=str(tenant.id))
    s2 = Sponsor.objects.create(name="Bike Shop", tenant_id=str(tenant.id))
    u1 = User.objects.create_user(
        username="sponsor1",
        password="pass12345",
        role="SPONSOR",
        tenant=tenant,
    )
    u2 = User.objects.create_user(
        username="sponsor2",
        password="pass12345",
        role="SPONSOR",
        tenant=tenant,
    )
    s1.user = u1
    s1.save()
    s2.user = u2
    s2.save()
    POI.objects.create(
        name="POI 1",
        location=Point(21.0, 52.0),
        tenant=tenant,
        sponsor=s1,
    )
    POI.objects.create(
        name="POI 2",
        location=Point(21.1, 52.1),
        tenant=tenant,
        sponsor=s2,
    )
    return u1, u2


@pytest.mark.django_db
def test_sponsor_stats_only_own_pois(sponsor_users):
    u1, _ = sponsor_users
    client = APIClient()
    client.force_authenticate(user=u1)
    res = client.get("/api/rewards/sponsor-stats/")
    assert res.status_code == 200
    assert res.data["poi_count"] == 1
