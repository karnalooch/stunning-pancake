import os
import sys
from types import ModuleType

# Mock GDAL to bypass checks
mock_gdal = ModuleType('django.contrib.gis.gdal')
mock_gdal.GDAL_VERSION = (3, 0, 0)
mock_gdal.gdal_version = lambda: b'3.0.0'
mock_gdal.lgdal = ModuleType('lgdal')
mock_gdal.DataSource = type('DataSource', (), {})
mock_gdal.Driver = type('Driver', (), {})
mock_gdal.GDALException = type('GDALException', (Exception,), {})
mock_gdal.SRSException = type('SRSException', (Exception,), {})
sys.modules['django.contrib.gis.gdal'] = mock_gdal

mock_libgdal = ModuleType('django.contrib.gis.gdal.libgdal')
mock_libgdal.lgdal = ModuleType('lgdal')
sys.modules['django.contrib.gis.gdal.libgdal'] = mock_libgdal

mock_geos = ModuleType('django.contrib.gis.geos')
mock_geos.GEOSGeometry = type('GEOSGeometry', (), {})
mock_geos.GEOSException = type('GEOSException', (Exception,), {})
sys.modules['django.contrib.gis.geos'] = mock_geos

# Mock dj_database_url config to swap engine to SQLite
import dj_database_url
original_config = dj_database_url.config
def mocked_config(*args, **kwargs):
    cfg = original_config(*args, **kwargs)
    cfg['ENGINE'] = 'django.db.backends.sqlite3'
    cfg['NAME'] = ':memory:'
    return cfg
dj_database_url.config = mocked_config

# Now load settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from django.core.management import execute_from_command_line
if __name__ == '__main__':
    sys.argv = ['manage.py', 'test']
    execute_from_command_line(sys.argv)
