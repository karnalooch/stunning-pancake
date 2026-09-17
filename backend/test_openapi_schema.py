"""OpenAPI /api/schema/ must generate without 500 (Swagger UI dependency)."""

import pytest
from django.test import Client

from clubs.test_p3_tenant_scope import ClubTenantIsolationTest

pytestmark = pytest.mark.django_db

# This module is already part of the blocking backend admin pytest command.
# A Test* alias makes pytest collect the P3 club isolation contract in that gate.
TestP3ClubTenantIsolation = ClubTenantIsolationTest


def test_openapi_schema_endpoint():
    res = Client().get("/api/schema/")
    assert res.status_code == 200, res.content[:800]


def test_spectacular_schema_generator():
    from drf_spectacular.generators import SchemaGenerator

    schema = SchemaGenerator().get_schema(request=None, public=True)
    assert "paths" in schema
    assert "/api/auth/token/" in schema["paths"]
