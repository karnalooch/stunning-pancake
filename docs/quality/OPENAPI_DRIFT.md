# OpenAPI / API documentation drift

**Last reviewed:** 2026-06-04

## SSOT

| Artifact | Role |
|----------|------|
| [docs/API.md](../API.md) | Human-readable contract + examples |
| `/api/schema/` | Generated OpenAPI (Django) |
| `scripts/check_openapi_drift.py` | CI guard on critical paths listed in API.md |

## When you change REST handlers

1. Update `docs/API.md` (path, method, auth, payload).
2. Spot-check Swagger: `/api/docs/` locally.
3. Run `python scripts/check_openapi_drift.py` (also in CI `scripts-python` job).

## PR checklist

See [PR_CHECKLIST.md](./PR_CHECKLIST.md) — add a tick if you touched `admin_views.py`, serializers, or `urls.py` under `backend/`.

## Extending the guard

Add paths to `CRITICAL_PATHS` in `scripts/check_openapi_drift.py` when a route becomes operationally critical (simulator admin, ingest, auth).
