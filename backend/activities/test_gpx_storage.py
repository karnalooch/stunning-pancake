"""GPX storage backend (P2 F2)."""

import os
from pathlib import Path

import pytest

from activities.gpx_storage import read_gpx, storage_backend, store_gpx


def test_local_store_and_read(tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path)
    os.environ.pop("GPX_S3_BUCKET", None)
    os.environ["GPX_STORAGE_BACKEND"] = "local"

    uri = store_gpx("activities/99.gpx", b"<gpx></gpx>")
    assert uri.startswith("local:")
    assert storage_backend() == "local"
    assert read_gpx(uri) == b"<gpx></gpx>"
    assert (Path(tmp_path) / "gpx" / "activities" / "99.gpx").is_file()
