"""
Dev runner that mocks GDAL/GEOS and sets up a local SQLite database file (db.sqlite3).
Permits running on Windows without installing native libraries.
Usage: python run_dev.py
"""

import os
import sys
import io
from types import ModuleType

# Force UTF-8 stdout/stderr on Windows to avoid UnicodeEncodeErrors with emojis
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

import json


class FakeRedis:
    def __init__(self):
        self.storage = {}

    def hgetall(self, key):
        return self.storage.get(key, {})

    def hset(self, key, mapping=None, key_val=None, value=None):
        if key not in self.storage:
            self.storage[key] = {}
        if isinstance(mapping, dict):
            self.storage[key].update(
                {
                    k.encode() if isinstance(k, str) else k: v.encode() if isinstance(v, str) else v
                    for k, v in mapping.items()
                }
            )
        elif mapping is not None and key_val is not None:
            k = mapping
            v = key_val
            k_b = k.encode() if isinstance(k, str) else k
            v_b = v.encode() if isinstance(v, str) else v
            self.storage[key][k_b] = v_b
        return len(self.storage[key])

    def hdel(self, key, *fields):
        if key in self.storage:
            for f in fields:
                f_b = f.encode() if isinstance(f, str) else f
                self.storage[key].pop(f_b, None)
                self.storage[key].pop(f, None)

    def hlen(self, key):
        return len(self.storage.get(key, {}))

    def delete(self, *keys):
        for k in keys:
            self.storage.pop(k, None)

    def rpush(self, key, value):
        if key not in self.storage:
            self.storage[key] = []
        self.storage[key].append(value.encode() if isinstance(value, str) else value)
        return len(self.storage[key])

    def ltrim(self, key, start, end):
        if key in self.storage:
            lst = self.storage[key]
            self.storage[key] = lst[start : end + 1 if end != -1 else None]

    def lrange(self, key, start, end):
        lst = self.storage.get(key, [])
        return lst[start : end + 1 if end != -1 else None]

    def set(self, key, value, nx=False, ex=None):
        if nx and key in self.storage:
            return False
        self.storage[key] = value.encode() if isinstance(value, str) else value
        return True

    def expire(self, key, ttl):
        pass

    def setex(self, key, ttl, value):
        self.storage[key] = value.encode() if isinstance(value, str) else value
        return True

    def get(self, key):
        val = self.storage.get(key)
        if val is None:
            return None
        return val.decode() if isinstance(val, bytes) else val

    def sadd(self, key, *members):
        if key not in self.storage:
            self.storage[key] = set()
        for m in members:
            self.storage[key].add(m.encode() if isinstance(m, str) else m)

    def smembers(self, key):
        return self.storage.get(key, set())

    def srem(self, key, *members):
        if key in self.storage:
            for m in members:
                self.storage[key].discard(m.encode() if isinstance(m, str) else m)


fake_redis_instance = FakeRedis()

# Setup environment variables before loading Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

# Load .env manually
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.exists(dotenv_path):
    with open(dotenv_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ.setdefault(key.strip(), val.strip())

os.environ["DATABASE_URL"] = "sqlite:///db.sqlite3"
os.environ["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-key-for-local-play")
os.environ["DEBUG"] = "1"
os.environ["CELERY_TASK_ALWAYS_EAGER"] = "True"
os.environ["CELERY_ALWAYS_EAGER"] = "True"
os.environ["CELERY_TASK_EAGER_PROPAGATES"] = "True"
os.environ["CELERY_BROKER_URL"] = "memory://"
os.environ["CELERY_RESULT_BACKEND"] = "cache+memory://"

# Mock GDAL/GEOS C-libraries
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
mock_geos_prototypes.geom = ModuleType("geom")
sys.modules["django.contrib.gis.geos.prototypes"] = mock_geos_prototypes
sys.modules["django.contrib.gis.geos.prototypes.io"] = mock_geos_prototypes.io
sys.modules["django.contrib.gis.geos.prototypes.geom"] = mock_geos_prototypes.geom

mock_geos_libgeos = ModuleType("django.contrib.gis.geos.libgeos")
sys.modules["django.contrib.gis.geos.libgeos"] = mock_geos_libgeos

mock_gis_measure = ModuleType("django.contrib.gis.measure")
mock_gis_measure.D = type("D", (), {})
mock_gis_measure.Area = type("Area", (), {})
mock_gis_measure.Distance = type("Distance", (), {})
sys.modules["django.contrib.gis.measure"] = mock_gis_measure

# Monkey-patch GIS fields to work with SQLite (which has no PostGIS)
from django.db.backends.sqlite3.operations import DatabaseOperations as SQLiteOps


class _MockAdapter(str):
    def __new__(cls, value, *args, **kwargs):
        return super().__new__(cls, str(value))


SQLiteOps.Adapter = _MockAdapter
SQLiteOps.geo_db_type = lambda self, field: "TEXT"
SQLiteOps.select = "%s"
SQLiteOps.geography = False
SQLiteOps.gis_operators = {}
SQLiteOps.get_geom_placeholder = lambda self, field, value, compiler: "%s"

# Monkey-patch UUIDField to accept non-UUID strings on SQLite.
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

# Patch dj_database_url to force SQLite database file
import dj_database_url

original_parse = dj_database_url.parse


def _mocked_parse(url, engine=None, **kwargs):
    cfg = original_parse(url, engine=engine, **kwargs)
    cfg["ENGINE"] = "django.db.backends.sqlite3"
    cfg["NAME"] = "db.sqlite3"
    return cfg


dj_database_url.parse = _mocked_parse

# Start Django Setup
import django

django.setup()

from django.contrib.gis.db.models.fields import BaseSpatialField

BaseSpatialField.db_type = lambda self, connection: "text"

import core.redis_cluster

core.redis_cluster.get_redis = lambda: fake_redis_instance

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


_RunSQL.database_forwards = _sqlite_safe_forwards

from django.core.management import execute_from_command_line

if __name__ == "__main__":
    db_exists = os.path.exists("db.sqlite3")
    if not db_exists:
        print("📁 db.sqlite3 does not exist. Migrating and seeding...")
        execute_from_command_line([sys.argv[0], "migrate"])
        import seed_data

        seed_data.seed()

    if len(sys.argv) > 1:
        execute_from_command_line(sys.argv)
    else:
        print("🚀 Starting local Django server...")
        execute_from_command_line([sys.argv[0], "runserver", "127.0.0.1:8000"])
