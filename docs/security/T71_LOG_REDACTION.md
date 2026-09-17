# T71 — PII, secret and GPS log redaction

**Status:** repository contract implemented; CI/runtime evidence required before merge  
**Audit mapping:** DS-017 / P1  
**Pilot rule:** ordinary logs, crash reporting and analytics diagnostics must not contain authentication secrets, direct identity canaries or precise GPS values.

## Covered sinks

| Surface | Control |
| --- | --- |
| Django/backend Python logging | process-wide `LogRecord` factory from `core.log_redaction`; rendered text, exception text, stack text and custom structured extras are scrubbed |
| Backend Sentry | `send_default_pii=False` plus recursive `before_send=redact_sentry_event` |
| FastAPI telemetry Python logging | process-wide telemetry `LogRecord` factory installed before logging configuration |
| Mobile console | bootstrap redaction is imported from `mobile/index.ts` before `App.tsx`; every console argument is recursively sanitized |
| Mobile Crashlytics | error/context payloads pass through `redactError` / `redactString` before `log` or `recordError` |
| Mobile analytics | event name and parameter payload pass through redaction before Firebase and console output |

The backend and telemetry services are separate runtime/container packages, so each owns a small local Python logging entry point. This avoids relying on a backend filesystem import from the telemetry container while keeping the same deny-by-default canary classes.

## Redacted data classes

The policy redacts common bearer/JWT credentials, password/secret/token/cookie/session/API-key fields, URL-embedded credentials, email addresses, direct identity keys (`user_id`, `device_id`, username/IP) and precise-location keys such as latitude/longitude, coordinates, GPS/location/position, `route_path`, polylines, GPX and GeoJSON.

Structured mappings are scrubbed by key. Free-form text is scrubbed with conservative patterns, including labelled coordinate/route arrays so the second coordinate cannot survive after only the first value is redacted. Unknown deep/cyclic structured values fail closed rather than being serialized recursively without a bound.

## CI and report boundary

CI must use synthetic canaries only. Production/pilot secrets or GPS points must never be pasted into build logs, SARIF metadata, screenshots or report fixtures. Dependency/security inventory may report package names and CVEs, never environment secret values.

## Boundaries

This control protects diagnostic/output channels; it does not remove sensitive data from the product database, telemetry persistence, backups or user exports. Those lifecycles are covered by T72/T75. `AuditLog` is an intentional business/security record governed by T70 and is not reclassified as an ordinary application log.

Redaction is also not a substitute for avoiding unnecessary sensitive analytics. New analytics events should use coarse/non-identifying values by design; the sanitizer is a final safety boundary.

## Regression evidence

- Backend canary tests exercise rendered Python logs, custom logging extras, recursive Sentry payload redaction and secret/identity/GPS patterns.
- Telemetry canary tests exercise the standalone logger, rendered runtime values and coordinate-sequence redaction.
- Mobile Jest tests exercise strings, coordinate/route arrays, nested analytics payloads, Crashlytics errors, console arguments and cyclic objects.
- The blocking scripts CI smoke suite asserts that Sentry, telemetry logging and Firebase/Crashlytics remain wired through the redaction layer.

A regression that restores raw Crashlytics `recordError(err)`, raw analytics params, removes the Sentry `before_send` hook, configures telemetry logging before installing the sanitizer or removes the mobile bootstrap redaction import must fail review/CI.
