#!/usr/bin/env python3
"""Export OpenAPI schema from Django (drf-spectacular) into packages/api-client."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
BACKEND = REPO / "backend"
OUT = REPO / "packages" / "api-client" / "openapi.json"


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    env.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
    env.setdefault("SECRET_KEY", "export-openapi-insecure-key")
    cmd = [
        sys.executable,
        "manage.py",
        "spectacular",
        "--file",
        str(OUT),
        "--format",
        "openapi-json",
    ]
    result = subprocess.run(cmd, cwd=BACKEND, env=env, check=False)
    if result.returncode != 0:
        print("export_openapi: failed — ensure backend deps installed and Django starts", file=sys.stderr)
        return result.returncode
    print(f"export_openapi: wrote {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
