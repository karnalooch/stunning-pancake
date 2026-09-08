import os
import sys
from types import ModuleType


# Mock GDAL to bypass checks on systems without GDAL/GEOS
class _MockModule(ModuleType):
    pass


mock_gdal = _MockModule("django.contrib.gis.gdal")
mock_gdal.__spec__ = type(sys)("Spec")
mock_gdal.__spec__.submodule_search_locations = []
mock_gdal.GDAL_VERSION = (3, 0, 0)
mock_gdal.gdal_version = lambda: b"3.0.0"
mock_gdal.lgdal = ModuleType("lgdal")
mock_gdal.DataSource = type("DataSource", (), {})
mock_gdal.Driver = type("Driver", (), {})
mock_gdal.GDALException = type("GDALException", (Exception,), {})
mock_gdal.SRSException = type("SRSException", (Exception,), {})
mock_gdal.OGRGeomType = type("OGRGeomType", (), {})
mock_gdal.CoordTransform = type("CoordTransform", (), {})
mock_gdal.SpatialReference = type("SpatialReference", (), {})
sys.modules["django.contrib.gis.gdal"] = mock_gdal

# django.contrib.gis.gdal.error is imported as a submodule
mock_gdal_error = ModuleType("django.contrib.gis.gdal.error")
mock_gdal_error.GDALException = type("GDALException", (Exception,), {})
sys.modules["django.contrib.gis.gdal.error"] = mock_gdal_error
mock_gdal.error = mock_gdal_error

mock_libgdal = ModuleType("django.contrib.gis.gdal.libgdal")
mock_libgdal.lgdal = ModuleType("lgdal")
sys.modules["django.contrib.gis.gdal.libgdal"] = mock_libgdal

mock_gdal_prototypes = ModuleType("django.contrib.gis.gdal.prototypes")
sys.modules["django.contrib.gis.gdal.prototypes"] = mock_gdal_prototypes

mock_geos = ModuleType("django.contrib.gis.geos")
mock_geos.GEOSGeometry = type("GEOSGeometry", (), {})
mock_geos.GEOSException = type("GEOSException", (Exception,), {})
# All geometry types that django.contrib.gis.db.models.fields imports
for _geo_type in (
    "GeometryCollection",
    "MultiPoint",
    "MultiLineString",
    "MultiPolygon",
    "Point",
    "LineString",
    "LinearRing",
    "Polygon",
    "MultiPolygon",
    "fromstr",
    "Polygon",
    "LineString",
    "Point",
):
    setattr(mock_geos, _geo_type, type(_geo_type, (), {}))
sys.modules["django.contrib.gis.geos"] = mock_geos

mock_geos_prototypes = ModuleType("django.contrib.gis.geos.prototypes")
mock_geos_prototypes.io = ModuleType("io")
sys.modules["django.contrib.gis.geos.prototypes"] = mock_geos_prototypes
sys.modules["django.contrib.gis.geos.prototypes.io"] = mock_geos_prototypes.io

mock_gis_measure = ModuleType("django.contrib.gis.measure")
mock_gis_measure.D = type("D", (), {})
mock_gis_measure.Area = type("Area", (), {})
mock_gis_measure.Distance = type("Distance", (), {})
sys.modules["django.contrib.gis.measure"] = mock_gis_measure

# Additional mock modules that GIS contrib may try to import
mock_gis_geometry = ModuleType("django.contrib.gis.geometry")
mock_gis_geometry.json_regex = r"^\{"
sys.modules["django.contrib.gis.geometry"] = mock_gis_geometry

mock_gis_serializers = ModuleType("django.contrib.gis.serializers")
sys.modules["django.contrib.gis.serializers"] = mock_gis_serializers

mock_gis_widgets = ModuleType("django.contrib.gis.forms.widgets")
mock_gis_widgets.OpenLayersWidget = type("OpenLayersWidget", (), {})
mock_gis_widgets.BaseGeometryWidget = type("BaseGeometryWidget", (), {})
mock_gis_widgets.OSMWidget = type("OSMWidget", (), {})
sys.modules["django.contrib.gis.forms.widgets"] = mock_gis_widgets

mock_gis_forms_fields = ModuleType("django.contrib.gis.forms.fields")
for _field in (
    "GeometryField",
    "GeometryCollectionField",
    "PointField",
    "MultiPointField",
    "LineStringField",
    "MultiLineStringField",
    "PolygonField",
    "MultiPolygonField",
):
    setattr(mock_gis_forms_fields, _field, type(_field, (), {}))
sys.modules["django.contrib.gis.forms.fields"] = mock_gis_forms_fields

# Mock dj_database_url.parse to swap engine to SQLite (settings.py uses parse(), not config())
import dj_database_url

original_parse = dj_database_url.parse


def mocked_parse(url, engine=None, **kwargs):
    cfg = original_parse(url, engine=engine, **kwargs)
    cfg["ENGINE"] = "django.db.backends.sqlite3"
    cfg["NAME"] = ":memory:"
    return cfg


dj_database_url.parse = mocked_parse

# Set required env vars before Django loads
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")
import django
from django.contrib.gis.db.models.fields import BaseSpatialField

BaseSpatialField.db_type = lambda self, connection: "text"
django.setup()

from django.conf import settings


class DisableMigrations:
    def __contains__(self, item):
        return True

    def __getitem__(self, item):
        return None


settings.MIGRATION_MODULES = DisableMigrations()

from django.core.management import execute_from_command_line

if __name__ == "__main__":
    if len(sys.argv) > 1:
        sys.argv = ["manage.py", "test"] + sys.argv[1:]
    else:
        sys.argv = ["manage.py", "test"]
    execute_from_command_line(sys.argv)
