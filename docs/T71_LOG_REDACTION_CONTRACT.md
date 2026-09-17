# T71 — Log redaction contract

Status: implementation contract for DS-017 / pilot data-safety.

## Goal

Secrets, authentication material, direct user identifiers and precise location data must not leave a 4VELO runtime through ordinary logs, Crashlytics or Sentry event payloads. Redaction is a boundary control, not permission to log sensitive data deliberately.

## Protected data

The common policy treats the following as sensitive:

- Authorization/Bearer/JWT material, access/refresh/id tokens, passwords, cookies, session identifiers, API keys and secrets;
- email, username, user/device identifiers and IP addresses when emitted as labelled/structured fields;
- latitude/longitude, coordinate arrays, GPS/location/position values, route paths, polylines, GPX and GeoJSON payloads;
- credentials embedded in URLs.

`[REDACTED]` is the only value emitted for a recognized sensitive structured field. Free-form messages are scrubbed for the same labelled shapes before they reach their sink.

## Sink inventory and enforcement

### Django / Celery / Python logging

`backend/core/log_redaction.py` installs a process-wide `LogRecordFactory` before the rest of Django settings initialize. It scrubs rendered messages, exception text, stack text and custom logging extras. This covers normal Django/Celery/application handlers that consume Python `LogRecord` objects.

### Backend Sentry

`backend/core/sentry.py` keeps `send_default_pii=False` as defence in depth and additionally uses the same recursive policy as `before_send`. The Sentry event is scrubbed again immediately before transport, including request headers/data, user data, URLs, breadcrumbs and exception text represented inside the event.

### Telemetry service

Telemetry is built from the isolated `./telemetry` Docker context and cannot import the Django `core` package. `telemetry/log_redaction.py` therefore mirrors the same free-text redaction contract and is installed before Uvicorn/application logging is configured in `telemetry/main.py`.

### Mobile console / Crashlytics / analytics

`mobile/index.ts` installs the privacy console boundary before `App.tsx` and its service tree load. Console arguments are recursively sanitized. `FirebaseService` sanitizes exceptions, Crashlytics messages/errors and analytics names/parameters before they are submitted.

The mobile adapter is intentionally active even in development because pilot GPS/tokens are sensitive on developer machines too.

### CI and generated reports

CI must use synthetic canaries only. Secrets or production/pilot GPS coordinates must never be pasted into build logs, test output, SARIF metadata, screenshots or report fixtures. Dependency/security inventory may report package identifiers and CVEs but not environment secret values.

## Regression canaries

Automated tests use unmistakably fake values for:

- Bearer/JWT/token values;
- email/user/device identifiers;
- labelled latitude/longitude;
- coordinate arrays and route paths;
- credentials embedded in URLs.

Tests fail if a canary survives the redaction boundary. Backend, telemetry and mobile each have service-local regression coverage because they run in separate runtime/build contexts.

## Boundaries

T71 protects ordinary application logging and configured error-reporting sinks. It does not claim protection from a privileged operator intentionally dumping process memory, raw database rows, packet captures or encrypted-at-rest files. Those are controlled by the surrounding T68–T76 security/operations tranches.

When a new log/error sink is introduced, it is not pilot-eligible until it either consumes the protected runtime boundary or applies this same contract with canary coverage.
