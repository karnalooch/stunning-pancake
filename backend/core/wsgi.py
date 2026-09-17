"""
WSGI config for SPORT project.
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
application = get_wsgi_application()

# T73: a production web runtime must never connect as SUPERUSER/BYPASSRLS.
# Migrations may use a separate privileged connection, but the serving process
# fails closed if its effective DATABASE_URL role can bypass RLS.
from core.db_role_guard import enforce_production_runtime_database_role  # noqa: E402

enforce_production_runtime_database_role()
