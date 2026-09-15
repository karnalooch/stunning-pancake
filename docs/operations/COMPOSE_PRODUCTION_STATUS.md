# Production Compose verification status

Reviewed against repository source on 2026-09-10. This is a known-gap record, not a deployment approval.

`docker-compose.prod.yml` now references the existing `backend/Dockerfile` instead of the missing `backend/Dockerfile.prod`. The shared image starts Gunicorn through `backend/docker-entrypoint.sh`. Do not create a second Dockerfile simply to duplicate this image.

The production variant still needs a deployment design and a full isolated smoke test before use:

| Gap | Evidence | Required verification |
|---|---|---|
| nginx refers to absent services | `infrastructure/nginx/conf.d/default.conf` names `telemetry` and `global_admin`, neither defined in the standalone production Compose file | Decide whether this file is standalone or an overlay; validate the exact combined configuration and start nginx |
| Static admin mount and proxy disagree | Compose mounts `admin/dist`, but nginx proxies `/` to `global_admin` | Choose static serving or a separate admin service and test assets plus SPA navigation |
| No TLS listener configured | Compose publishes 443; nginx configuration only listens on 80 | Document the external TLS terminator or configure and test TLS |
| No Celery workers or beat in standalone variant | Services absent from `docker-compose.prod.yml` | Establish whether workers run externally; test task consumption and scheduling |
| No runtime validation in this cleanup environment | Docker is unavailable | Build images, start a disposable stack, test API, routing, telemetry and task execution |

A successful YAML/configuration check is not evidence of successful image builds or a healthy stack. Do not use live database credentials for these checks, and do not treat the historical production filename as proof of production readiness.

See the [repository map](../reports/REPOSITORY_MAP.md), [risk map](../reports/RISK_AND_OWNERSHIP_MAP.md) and [takeover guide](../PROJECT_TAKEOVER.md). Those reports are dated snapshots; this note records the later Dockerfile reference correction.
