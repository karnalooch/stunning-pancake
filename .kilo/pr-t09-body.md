## security(backend): restrict and validate tenant webhooks

T09: tenant Live Map alert webhooks previously accepted any URL from any
authenticated user and let tenant admins target another tenant's webhook
record. This change locks down both RBAC and tenant isolation, and adds
centralised SSRF protection enforced at write time and again immediately
before the outbound POST.

### Access control

* `LiveMapWebhookListCreateView`, `LiveMapWebhookDetailView` and
  `LiveMapWebhookTestView` now require the new `_IsWebhookAdmin`
  permission: only `GLOBAL_OWNER` or a `TENANT_ADMIN` with a non-empty
  `tenant_id`. `ATHLETE`, `SPONSOR`, `TENANT_MODERATOR`, anonymous users,
  and a `TENANT_ADMIN` without a tenant all receive 403.
* `GLOBAL_OWNER` may list/read/update/delete webhooks across all tenants
  and create/update with an explicit `tenant` field.
* `TENANT_ADMIN` is pinned to its own `tenant_id` for both create and
  update. Cross-tenant create/update attempts are rejected with a
  controlled 400. Cross-tenant read/update/delete/test by `TENANT_ADMIN`
  return 404 (queryset is already tenant-scoped).

### SSRF protection

New helper `backend/activities/ssrf.py` (`validate_outbound_url`,
`UnsafeWebhookURL`) is invoked by:

1. The serializer (`LiveMapAlertWebhookSerializer.validate_url`) —
   write-time enforcement. DRF runs field validators on both full and
   partial updates whenever `url` is present, so no separate `validate()`
   pass is needed.
2. The Celery worker `deliver_live_map_webhook` — delivery-time
   re-validation, run immediately before `requests.post`, so an
   out-of-band record edit cannot bypass the policy.

The guard accepts only `https` URLs with no userinfo and a well-formed
TCP port (`1..65535`; non-numeric, `0`, or `>65535` are rejected before
any DNS lookup). It requires the host to resolve via `socket.getaddrinfo`,
and rejects the URL unless **every** returned IPv4/IPv6 address is
globally routable (`is_global`). Literal IPv4/IPv6 hosts are checked the
same way. Mixed public/private DNS answers fail closed.

All `UnsafeWebhookURL` messages are fixed, short reason codes. They never
include the original URL, hostname, resolved IP addresses, the
user-supplied port value, userinfo, or the query string — refusing a URL
must not become an information-disclosure channel. The API error shape is
a flat field-level list: `{"url": ["<safe reason>"]}`.

### Delivery behaviour

* `requests.post` is called with `timeout=10` and `allow_redirects=False`.
* Unsafe URLs short-circuit with a controlled `delivery_log` entry
  (`status="blocked"`, `reason="unsafe_url"`), increment
  `failure_count`, never invoke `requests.post`, and never retry.
* 3xx responses are recorded with `status="redirect_blocked"` and the
  numeric status code, also without retry.
* Outbound HTTP exceptions are redacted: the delivery log stores
  `status="retry"`, `reason="delivery_error"` and `error_type`
  (the exception class name only); the logger stores `id` and
  `error_type`; `self.retry` receives a sanitised `WebhookDeliveryError`
  instead of the original exception. This prevents `InvalidURL`,
  `ConnectionError`, `ConnectTimeout`, `SSLError`, and similar messages —
  which routinely embed the full URL — from reaching the delivery log,
  the application logger, or Celery retry metadata.
* The blocked path logs only the stable
  `delivery_status=blocked id=<pk> reason=unsafe_url` line.
* `secret` is write-only at the serializer layer.

### Tests

* `backend/activities/test_live_map_webhooks.py` — 66 tests covering
  RBAC, tenant isolation, write-time and delivery-time SSRF guard,
  port validation (`abc`, `0`, `99999`), single-DNS-lookup semantics,
  redirect handling, exception/log redaction of URL and canary values,
  and non-leakage of the URL or HMAC secret in the persisted delivery
  log. No real DNS, no real HTTP, no real Celery/Redis in the test path.
* New contract tests in
  `scripts/test_ci_workflow_contract.py`
  (`P1AdminPytestT09ContractTests`) assert that
  `activities/test_live_map_webhooks.py` is referenced by the blocking
  `P1 admin pytest` step exactly once and not duplicated in a
  non-blocking baseline.

### CI

The `P1 admin pytest` step (the blocking backend gate) now includes
`activities/test_live_map_webhooks.py`. The `Aggregate CI gate`,
`aggregate.needs`, path filters and `continue-on-error` flags were not
modified.

### Non-scope

* No new dependencies, no migrations, no model changes, no routing
  changes outside `LiveMapWebhook*` views.
* DNS rebinding / TOCTOU is **not** fully eliminated. The URL is
  re-checked immediately before `requests.post`, which tightens the
  window between write-time and delivery-time validation, but the
  connection is **not** pinned to the previously resolved IP —
  `requests` performs its own `getaddrinfo` and a hostname that flips
  between the worker validation and the outbound socket connect could
  still redirect the request to a different address. A pinned-address
  socket pool remains out of scope for T09.

### Local validation

* `python run_pytest.py activities/test_live_map_webhooks.py -q` —
  66 passed (exit 0).
* `python run_pytest.py <full P1 set> -q` — 218 passed (exit 0).
* `python -m unittest scripts.test_ci_workflow_contract -v` — OK
  (exit 0); `scripts.test_ci_aggregate` — OK (exit 0).
* `ruff check` and `ruff format --check` — both exit 0 on the changed
  files.
* `python manage.py check` — BLOCKED locally (no GDAL/GEOS in the local
  Windows environment); the CI `backend` job installs
  `gdal-bin libgdal-dev libgeos-dev` via apt and runs the same command
  against the real PostGIS test database. The remote `manage.py check`
  result is the authoritative one.