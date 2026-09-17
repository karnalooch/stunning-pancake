"""
WSGI config for SPORT project.
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
application = get_wsgi_application()

# T73: production and explicitly guarded pilot runtimes must never connect as
# SUPERUSER/BYPASSRLS. Migration tooling may use a separate privileged URL.
from core.db_role_guard import enforce_runtime_database_role_if_required  # noqa: E402

enforce_runtime_database_role_if_required()
