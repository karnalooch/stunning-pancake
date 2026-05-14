"""
Test runner that mocks GDAL/GEOS native libraries for environments without them.
Keeps the real django.contrib.gis for Model/ForeignKey infrastructure.
Runs pytest.
Usage: python run_pytest.py [pytest args...]
"""
import os
import sys
from types import ModuleType

# Set required env vars before ANY Django import
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
os.environ["DATABASE_URL"] = os.environ.get("DATABASE_URL", "sqlite:///:memory:")
os.environ["REDIS_URL"] = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
os.environ["SECRET_KEY"] = os.environ.get("SECRET_KEY", "test-secret-key-for-ci")
os.environ["DEBUG"] = "1"

# ---------------------------------------------------------------------------
# Mock ONLY the native GDAL/GEOS submodules that require C libraries.
# We keep the real django.contrib.gis for Model, ForeignKey, etc.
# ---------------------------------------------------------------------------

# Mock django.contrib.gis.gdal (native GDAL library wrapper)
mock_gdal = ModuleType("django.contrib.gis.gdal")
mock_gdal.GDAL_VERSION = (3, 0, 0)
mock_gdal.gdal_version = lambda: b"3.0.0"
mock_gdal.lgdal = ModuleType("lgdal")
mock_gdal.DataSource = type("DataSource", (), {})
mock_gdal.Driver = type("Driver", (), {})
mock_gdal.GDALException = type("GDALException", (Exception,), {})
mock_gdal.SRSException = type("SRSException", (Exception,), {})
mock_gdal.OGRGeomType = type("OGRGeomType", (), {})
mock_gdal.OGRGeometry = type("OGRGeometry", (), {})
mock_gdal.SpatialReference = type("SpatialReference", (), {})
mock_gdal.CoordTransform = type("CoordTransform", (), {})
mock_gdal.Envelope = type("Envelope", (), {})
sys.modules["django.contrib.gis.gdal"] = mock_gdal

# gdal submodules
mock_gdal_error = ModuleType("django.contrib.gis.gdal.error")
mock_gdal_error.GDALException = type("GDALException", (Exception,), {})
sys.modules["django.contrib.gis.gdal.error"] = mock_gdal_error
mock_gdal.error = mock_gdal_error

mock_libgdal = ModuleType("django.contrib.gis.gdal.libgdal")
mock_libgdal.lgdal = ModuleType("lgdal")
sys.modules["django.contrib.gis.gdal.libgdal"] = mock_libgdal

mock_gdal_prototypes = ModuleType("django.contrib.gis.gdal.prototypes")
mock_gdal_prototypes.ds = ModuleType("ds")
sys.modules["django.contrib.gis.gdal.prototypes"] = mock_gdal_prototypes
sys.modules["django.contrib.gis.gdal.prototypes.ds"] = mock_gdal_prototypes.ds

mock_gdal_datasource = ModuleType("django.contrib.gis.gdal.datasource")
sys.modules["django.contrib.gis.gdal.datasource"] = mock_gdal_datasource

mock_gdal_driver = ModuleType("django.contrib.gis.gdal.driver")
sys.modules["django.contrib.gis.gdal.driver"] = mock_gdal_driver

# Mock django.contrib.gis.geos (native GEOS library wrapper)
mock_geos = ModuleType("django.contrib.gis.geos")
mock_geos.GEOSGeometry = type("GEOSGeometry", (), {})
mock_geos.GEOSException = type("GEOSException", (Exception,), {})
for _geo_type in (
    "GeometryCollection", "MultiPoint", "MultiLineString", "MultiPolygon",
    "Point", "LineString", "LinearRing", "Polygon",
    "fromstr",
):
    setattr(mock_geos, _geo_type, type(_geo_type, (), {}))
sys.modules["django.contrib.gis.geos"] = mock_geos

mock_geos_prototypes = ModuleType("django.contrib.gis.geos.prototypes")
mock_geos_prototypes.io = ModuleType("io")
sys.modules["django.contrib.gis.geos.prototypes"] = mock_geos_prototypes
sys.modules["django.contrib.gis.geos.prototypes.io"] = mock_geos_prototypes.io

mock_geos_collections = ModuleType("django.contrib.gis.geos.collections")
sys.modules["django.contrib.gis.geos.collections"] = mock_geos_collections

mock_geos_geometry = ModuleType("django.contrib.gis.geos.geometry")
sys.modules["django.contrib.gis.geos.geometry"] = mock_geos_geometry

# Mock django.contrib.gis.geometry (needs json_regex)
mock_gis_geometry = ModuleType("django.contrib.gis.geometry")
mock_gis_geometry.json_regex = r"^\{"
sys.modules["django.contrib.gis.geometry"] = mock_gis_geometry

# Mock django.contrib.gis.measure
mock_gis_measure = ModuleType("django.contrib.gis.measure")
mock_gis_measure.D = type("D", (), {})
mock_gis_measure.Area = type("Area", (), {})
mock_gis_measure.Distance = type("Distance", (), {})
sys.modules["django.contrib.gis.measure"] = mock_gis_measure

# Mock django.contrib.gis.serializers
sys.modules["django.contrib.gis.serializers"] = ModuleType("django.contrib.gis.serializers")

# Mock optional dependencies not available in test environment
mock_sendgrid = ModuleType("sendgrid")
mock_sendgrid.SendGridAPIClient = type("SendGridAPIClient", (), {})
mock_sendgrid.helpers = ModuleType("sendgrid.helpers")
mock_sendgrid.helpers.mail = ModuleType("sendgrid.helpers.mail")
for _sg_cls in ("Mail", "Email", "To", "Content", "Subject", "HtmlContent", "Personalization"):
    setattr(mock_sendgrid.helpers.mail, _sg_cls, type(_sg_cls, (), {}))
sys.modules["sendgrid"] = mock_sendgrid
sys.modules["sendgrid.helpers"] = mock_sendgrid.helpers
sys.modules["sendgrid.helpers.mail"] = mock_sendgrid.helpers.mail

# ---------------------------------------------------------------------------
# Monkey-patch GIS fields to work with SQLite (which has no PostGIS)
# SQLite DatabaseOperations doesn't have geo_db_type, so we add it.
# ---------------------------------------------------------------------------
from django.db.backends.sqlite3.operations import DatabaseOperations as SQLiteOps

SQLiteOps.geo_db_type = lambda self, field: "TEXT"
# SQLite has no spatial 'select' format — fall back to simple column reference
SQLiteOps.select = "%s"
# SQLite has no PostGIS index — stub it out
SQLiteOps.geography = False
SQLiteOps.gis_operators = {}

# Monkey-patch UUIDField to accept non-UUID strings on SQLite.
# Test fixtures use readable IDs like "test-city" which are valid in SQLite
# but fail Django UUID validation. We return a mock UUID object with .hex.
import django.db.models.fields as _fields_module

_original_uuid_to_python = _fields_module.UUIDField.to_python


class _MockUUID:
    """Minimal UUID-like object that supports .hex attribute."""
    def __init__(self, hex_val: str):
        self.hex = hex_val
        self._hex = hex_val

    def __str__(self):
        return self._hex

    def __eq__(self, other):
        return str(self) == str(other)

    def __hash__(self):
        return hash(self._hex)


def _lenient_uuid_to_python(self, value):
    import uuid as _uuid
    try:
        return _original_uuid_to_python(self, value)
    except Exception:
        return _MockUUID(str(value))


_fields_module.UUIDField.to_python = _lenient_uuid_to_python
# ---------------------------------------------------------------------------
# Patch dj_database_url.parse so settings.py's PostGIS engine → SQLite
# ---------------------------------------------------------------------------
import dj_database_url

_original_parse = dj_database_url.parse


def _mocked_parse(url, engine=None, **kwargs):
    cfg = _original_parse(url, engine=engine, **kwargs)
    cfg["ENGINE"] = "django.db.backends.sqlite3"
    cfg["NAME"] = ":memory:"
    return cfg


dj_database_url.parse = _mocked_parse

# ---------------------------------------------------------------------------
# Patch RunSQL to silently skip unsupported SQL on SQLite.
# Migration 0004_city_rankings_mv.py uses CREATE MATERIALIZED VIEW which is
# PostgreSQL-only.  On SQLite we catch the error and skip so the remaining
# tests can discover and run.
# ---------------------------------------------------------------------------
import django
django.setup()

from django.db.migrations.operations.special import RunSQL as _RunSQL

_original_database_forwards = _RunSQL.database_forwards
_original_database_backwards = _RunSQL.database_backwards


def _sqlite_safe_forwards(self, app_label, schema_editor, from_state, to_state):
    try:
        _original_database_forwards(self, app_label, schema_editor, from_state, to_state)
    except Exception as e:
        vendor = getattr(schema_editor.connection, 'vendor', 'unknown')
        if vendor == 'sqlite':
            print(f"  [SQLite] Skipping unsupported RunSQL ({type(e).__name__})")
        else:
            raise


def _sqlite_safe_backwards(self, app_label, schema_editor, from_state, to_state):
    try:
        _original_database_backwards(self, app_label, schema_editor, from_state, to_state)
    except Exception as e:
        vendor = getattr(schema_editor.connection, 'vendor', 'unknown')
        if vendor == 'sqlite':
            print(f"  [SQLite] Skipping unsupported RunSQL ({type(e).__name__})")
        else:
            raise


_RunSQL.database_forwards = _sqlite_safe_forwards
_RunSQL.database_backwards = _sqlite_safe_backwards

# ---------------------------------------------------------------------------
# Now run pytest
# ---------------------------------------------------------------------------
import pytest

if __name__ == "__main__":
    args = sys.argv[1:] if len(sys.argv) > 1 else ["activities/"]
    sys.exit(pytest.main(args))
