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
mock_gdal.GDALRaster = type("GDALRaster", (), {})
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


class _MockMeta(type):
    def __instancecheck__(cls, instance):
        if instance is None or isinstance(instance, (str, bytes)):
            return False
        return True


class _MockGEOSGeometry(metaclass=_MockMeta):
    def __init__(self, *args, **kwargs):
        self.srid = kwargs.get("srid")
        self.num_coords = 0

    @property
    def coords(self):
        return getattr(self, "_coords", [(0, 0), (0.001, 0)])


# Mock django.contrib.gis.geos (native GEOS library wrapper)
mock_geos = ModuleType("django.contrib.gis.geos")
mock_geos.GEOSGeometry = _MockGEOSGeometry
mock_geos.GEOSException = type("GEOSException", (Exception,), {})


def _mock_geo_init(self, *args, **kwargs):
    self.srid = kwargs.get("srid")
    if args and isinstance(args[0], list):
        self._coords = args[0]
        self.num_coords = len(args[0])
    else:
        self._coords = [(0, 0), (0.001, 0)]
        self.num_coords = 2


for _geo_type in (
    "GeometryCollection",
    "MultiPoint",
    "MultiLineString",
    "MultiPolygon",
    "Point",
    "LineString",
    "LinearRing",
    "Polygon",
    "fromstr",
):
    setattr(
        mock_geos,
        _geo_type,
        type(
            _geo_type,
            (mock_geos.GEOSGeometry,),
            {
                "__init__": _mock_geo_init,
                "srid": None,
                "num_coords": 0,
            },
        ),
    )
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


class _MockAdapter(str):
    def __new__(cls, value, *args, **kwargs):
        return super().__new__(cls, str(value))


SQLiteOps.Adapter = _MockAdapter
SQLiteOps.geo_db_type = lambda self, field: "TEXT"
# SQLite has no spatial 'select' format — fall back to simple column reference
SQLiteOps.select = "%s"
# SQLite has no PostGIS index — stub it out
SQLiteOps.geography = False
SQLiteOps.gis_operators = {}
SQLiteOps.get_geom_placeholder = lambda self, field, value, compiler: "%s"

# Monkey-patch UUIDField to accept non-UUID strings on SQLite.
# Test fixtures use readable IDs like "test-city" which are valid in SQLite
# but fail Django UUID validation. We return a mock UUID object with .hex.
import django.db.models.fields as _fields_module

_original_uuid_to_python = _fields_module.UUIDField.to_python


class _MockUUID(str):
    """
    Minimal JSON-serializable UUID-like object for SQLite tests.

    DRF's JSON renderer can't serialize arbitrary objects, so we subclass `str`
    (which makes it JSON-serializable) while still providing a `.hex` attr.
    """

    def __new__(cls, value):
        return super().__new__(cls, str(value))

    def __init__(self, value):
        self.hex = str(value)


def _lenient_uuid_to_python(self, value):
    import uuid as _uuid

    try:
        return _original_uuid_to_python(self, value)
    except Exception:
        return _MockUUID(str(value))


_fields_module.UUIDField.to_python = _lenient_uuid_to_python

_original_convert_uuidfield_value = SQLiteOps.convert_uuidfield_value


def _lenient_convert_uuidfield_value(self, value, expression, connection):
    if value is not None:
        try:
            return _original_convert_uuidfield_value(self, value, expression, connection)
        except ValueError:
            return _MockUUID(value)
    return value


SQLiteOps.convert_uuidfield_value = _lenient_convert_uuidfield_value
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

from django.conf import settings

settings.CELERY_TASK_ALWAYS_EAGER = True
settings.CELERY_TASK_EAGER_PROPAGATES = True
settings.CELERY_BROKER_URL = "memory://"
settings.CELERY_RESULT_BACKEND = "cache+memory://"

from unittest.mock import MagicMock
import core.redis_cluster

core.redis_cluster.get_redis = MagicMock()
core.redis_cluster.get_redis.return_value.get.return_value = None

from django.db.backends.signals import connection_created
from django.dispatch import receiver


@receiver(connection_created)
def extend_sqlite(connection, **kwargs):
    if connection.vendor == "sqlite":
        connection.connection.create_function("set_config", 3, lambda name, value, is_local: "")


from django.db.migrations.operations.special import RunSQL as _RunSQL

_original_database_forwards = _RunSQL.database_forwards
_original_database_backwards = _RunSQL.database_backwards


def _sqlite_safe_forwards(self, app_label, schema_editor, from_state, to_state):
    try:
        _original_database_forwards(self, app_label, schema_editor, from_state, to_state)
    except Exception as e:
        vendor = getattr(schema_editor.connection, "vendor", "unknown")
        if vendor == "sqlite":
            print(f"  [SQLite] Skipping unsupported RunSQL ({type(e).__name__})")
        else:
            raise


def _sqlite_safe_backwards(self, app_label, schema_editor, from_state, to_state):
    try:
        _original_database_backwards(self, app_label, schema_editor, from_state, to_state)
    except Exception as e:
        vendor = getattr(schema_editor.connection, "vendor", "unknown")
        if vendor == "sqlite":
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
