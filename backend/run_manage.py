"""
Local manage.py wrapper — GDAL mocks + sqlite defaults (Windows dev without PostGIS libs).
Usage: python run_manage.py migrate
       python run_manage.py seed_smoke_users
"""

import os
import sys

_ROOT = os.path.dirname(os.path.abspath(__file__))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

_DEFAULT_DB = "sqlite:///" + os.path.join(_ROOT, "s0_gate.sqlite3").replace("\\", "/")
if not os.environ.get("DATABASE_URL") or ":memory:" in os.environ.get("DATABASE_URL", ""):
    os.environ["DATABASE_URL"] = _DEFAULT_DB
os.environ.setdefault("SECRET_KEY", "local-dev-secret")
os.environ.setdefault("DEBUG", "1")
os.environ.setdefault("REDIS_URL", "redis://127.0.0.1:6379/15")

import importlib.util

_spec = importlib.util.spec_from_file_location(
    "_pytest_bootstrap", os.path.join(_ROOT, "run_pytest.py")
)
_mod = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_mod)

# Re-apply file DB after pytest bootstrap (bootstrap may default to :memory:).
os.environ["DATABASE_URL"] = _DEFAULT_DB

from manage import main

if __name__ == "__main__":
    main()
