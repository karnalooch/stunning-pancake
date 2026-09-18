# Production Compose verification status

Reviewed against the takeover-era repository on 2026-09-18. This page records
what is verified and what remains unresolved; it is **not** a production
deployment approval.

## Verified contract

`docker-compose.prod.yml` uses the maintained backend build context
`./backend` and the existing `backend/Dockerfile`. The backend image launches
through `backend/docker-entrypoint.sh`, which hands the web process to
Gunicorn.

CI now fails closed if the Compose backend build points at a missing Dockerfile.
For relevant changes it also runs:

```bash
python -m unittest scripts/test_production_compose_contract.py -v
DB_PASSWORD=ci-only SECRET_KEY=ci-only \
  docker compose -f docker-compose.prod.yml config --quiet
```

The Kubernetes release gate independently builds the backend Docker image from
`./backend`, so the maintained Dockerfile is exercised by image-build CI as
well.

## Known gaps before standalone production use

| Gap | Repository evidence | Required validation |
| --- | --- | --- |
| nginx references services absent from this Compose file | `infrastructure/nginx/conf.d/default.conf` names `telemetry` and `global_admin`, while `docker-compose.prod.yml` does not define them | Decide whether this Compose file is standalone or an overlay; validate the exact combined stack |
| Admin serving model is inconsistent | Compose mounts `admin/dist` into nginx, while nginx proxies `/` to `global_admin` | Choose static serving or a dedicated admin service and test SPA routing/assets |
| TLS ownership is undefined | Compose publishes port 443, while the checked-in nginx server listens on port 80 | Document an external TLS terminator or add and test TLS configuration |
| Celery worker/beat topology is absent | Standalone production Compose defines neither worker nor beat services | Define where asynchronous workers and scheduler run; prove task consumption/scheduling |
| Full-stack runtime smoke is not yet evidence-backed | Config parsing and image builds do not prove nginx routing, telemetry, workers, migrations and app health together | Start a disposable exact production topology and verify API, routing, telemetry, async tasks and health checks |

A successful Compose config check or Docker image build must not be interpreted
as proof that the complete standalone stack is production-ready.

See also the [current takeover plan](../TAKEOVER_PLAN_CURRENT.md),
[repository map](../reports/REPOSITORY_MAP.md),
[risk and ownership map](../reports/RISK_AND_OWNERSHIP_MAP.md), and
[project takeover guide](../PROJECT_TAKEOVER.md).
