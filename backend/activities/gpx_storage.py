"""GPX archive storage — local filesystem (default) or S3-compatible (P2 F2)."""

from __future__ import annotations

import logging
import os
from pathlib import Path

from django.conf import settings

logger = logging.getLogger(__name__)


def storage_backend() -> str:
    if _s3_configured():
        return os.getenv("GPX_STORAGE_BACKEND", "s3").lower()
    return "local"


def _s3_configured() -> bool:
    return bool(os.getenv("GPX_S3_BUCKET"))


def _local_root() -> Path:
    root = Path(os.getenv("GPX_LOCAL_ROOT", "") or Path(settings.MEDIA_ROOT) / "gpx")
    root.mkdir(parents=True, exist_ok=True)
    return root


def store_gpx(key: str, body: bytes) -> str:
    """Persist GPX bytes; returns storage URI (local:… or s3://…)."""
    backend = storage_backend()
    if backend == "s3":
        try:
            return _store_s3(key, body)
        except Exception as exc:
            logger.warning("gpx.s3_fallback_local key=%s err=%s", key, exc)
    return _store_local(key, body)


def read_gpx(storage_uri: str) -> bytes:
    if storage_uri.startswith("s3://"):
        return _read_s3(storage_uri)
    key = storage_uri.removeprefix("local:")
    return (_local_root() / key.replace("/", os.sep)).read_bytes()


def _store_local(key: str, body: bytes) -> str:
    path = _local_root() / key.replace("/", os.sep)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)
    return f"local:{key}"


def _read_local(key: str) -> bytes:
    return (_local_root() / key.replace("/", os.sep)).read_bytes()


def _s3_client():
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=os.getenv("GPX_S3_ENDPOINT") or None,
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID") or None,
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY") or None,
        region_name=os.getenv("GPX_S3_REGION", "auto"),
    )


def _store_s3(key: str, body: bytes) -> str:
    bucket = os.environ["GPX_S3_BUCKET"]
    _s3_client().put_object(
        Bucket=bucket,
        Key=key,
        Body=body,
        ContentType="application/gpx+xml",
    )
    return f"s3://{bucket}/{key}"


def _read_s3(uri: str) -> bytes:
    # s3://bucket/key/path
    _, _, rest = uri.partition("s3://")
    bucket, _, key = rest.partition("/")
    obj = _s3_client().get_object(Bucket=bucket, Key=key)
    return obj["Body"].read()


def store_export(key: str, body: bytes) -> str:
    return store_gpx(key, body)
