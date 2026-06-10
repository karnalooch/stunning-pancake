"""OpenAPI /api/schema/ must generate without 500 (Swagger UI dependency)."""

import pytest
from django.test import Client

pytestmark = pytest.mark.django_db


def test_openapi_schema_endpoint():
    res = Client().get("/api/schema/")
    assert res.status_code == 200, res.content[:800]


def test_spectacular_schema_generator():
    from drf_spectacular.generators import SchemaGenerator

    schema = SchemaGenerator().get_schema(request=None, public=True)
    assert "paths" in schema
    assert "/api/auth/token/" in schema["paths"]
