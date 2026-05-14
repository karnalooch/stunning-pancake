# Code Review — 4VELO Platform · `main` branch · 2026-05-14

---

## Executive Summary

Reviewed all major subsystems: `backend/` (Django REST + Celery + PostGIS), `telemetry/` (FastAPI), `mobile/` (React Native / Expo + Unistyles STITCH), `admin/` (React + Vite), `infrastructure/` (Kubernetes + Docker Compose), and `shared/`.

| Severity | Count | Description |
|----------|-------|-------------|
| **Critical** | 7 | Unauthenticated endpoints, hardcoded secrets in K8s, privilege escalation, broken security controls |
| **High** | 9 | CORS stale origins, incorrect auth patterns, demo data in production screens, wrong ORM annotations |
| **Medium** | 8 | Missing validators, unreliable fallbacks, misnamed variables, TTL calculation bugs |
| **Low** | 7 | Dead code, stale brand names, minor code-quality items |

**Overall health:** The authentication architecture and RLS design are sound. Recent security Phase A work (CORS restrictions, rate limiting, wearables timeouts) is directionally correct. However, several critical gaps remain: the telemetry microservice has **zero authentication** on both REST and WebSocket endpoints, a Kubernetes manifest hardcodes a database password in plaintext, and any authenticated user can overwrite the anti-cheat configuration. These must be closed before production traffic.

---

## Top 5 Priority Action Items

1. **[CRITICAL] Add authentication to telemetry service** — `telemetry/main.py` exposes `/api/telemetry/ingest`, `/api/telemetry/ingest/batch`, `/ws/telemetry/live`, and `/ws/telemetry/ingest` with no auth. Any party on the internet can inject fake GPS data or receive real-time athlete positions.

2. **[CRITICAL] Remove hardcoded DB credentials from Kubernetes manifest** — `infrastructure/kubernetes/base/backend.yaml:45` embeds `sportpass` in plaintext. Migrate to a Kubernetes `Secret`.

3. **[CRITICAL] Lock down `TelemetryConfigView` POST** — `backend/activities/views.py:133-138` has a `# TODO` comment but no enforcement; any authenticated user (including athletes) can overwrite `brouterCutoff`, `mlSensitivity`, and `autoBan`, neutering the entire anti-cheat stack.

4. **[HIGH] Fix TENANT_ADMIN privilege escalation in `UserCreateView`** — `backend/users/views.py:244-246` allows a TENANT_ADMIN to pass `role=GLOBAL_OWNER` when creating a user, granting themselves a super-admin subordinate.

5. **[HIGH] Replace hardcoded demo data in mobile HUD** — `ActiveRideHUDScreen.tsx` and `RideDashboardScreen.tsx` render static placeholder values (32.8 km/h, 18.5 km, etc.). The GPS tracking pipeline exists but is not wired to the UI.

---

## Findings by Category

---

### CRITICAL

---

#### C-1 · Telemetry REST ingest endpoints have no authentication
**File:** `telemetry/main.py:279–332`

The FastAPI telemetry service accepts GPS packets and batch uploads over HTTP with no `Authorization` header check and no JWT validation:

```python
@app.post("/api/telemetry/ingest", status_code=202)
async def ingest_packet(packet: GpsPacket) -> dict:
    # No auth check
```

Any entity that can reach the Railway-deployed URL can inject arbitrary GPS positions for any `device_id` / `user_id`. This undermines the entire anti-cheat pipeline (fabricated tracks would flow straight into DB).

**Recommended fix:** Add a shared-secret or JWT dependency on FastAPI routes:
```python
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
security = HTTPBearer()

@app.post("/api/telemetry/ingest", status_code=202)
async def ingest_packet(packet: GpsPacket, creds: HTTPAuthorizationCredentials = Depends(security)):
    verify_token(creds.credentials)  # validate against Django JWT or shared secret
```

---

#### C-2 · WebSocket telemetry endpoints have no authentication — live position feed is public
**File:** `telemetry/main.py:338–397`

`/ws/telemetry/live` broadcasts real-time `{lat, lon, user_id}` to all connected clients with no handshake or token check. `/ws/telemetry/ingest` accepts live GPS from any anonymous WebSocket connection.

```python
@app.websocket("/ws/telemetry/live")
async def websocket_live(ws: WebSocket) -> None:
    await manager.connect(ws)  # No auth — anyone receives all athlete positions
```

**Recommended fix:** Require a JWT query parameter or `Authorization` header before `manager.connect()`. Filter broadcast to subscribers authorised for a given tenant.

---

#### C-3 · TelemetryConfigView POST has no permission enforcement — anti-cheat is athlete-writable
**File:** `backend/activities/views.py:133–138`

```python
def post(self, request):
    # Ideally, restrict to GLOBAL_OWNER or TENANT_ADMIN roles here
    r = get_redis()
    config = request.data
    r.set("telemetry:config", json.dumps(config))
    return Response({"status": "ok", "config": config})
```

The comment acknowledges the missing guard but the code runs as-is. Any authenticated athlete can set `autoBan=False` to disable all automated bans, or set `brouterCutoff=100` to bypass BRouter distance validation entirely.

**Recommended fix:**
```python
from users.permissions import IsGlobalOwner, IsTenantAdmin
from rest_framework.permissions import IsAuthenticated
...
class TelemetryConfigView(views.APIView):
    permission_classes = (IsAuthenticated, IsGlobalOwner | IsTenantAdmin)
```

---

#### C-4 · Hardcoded database password in Kubernetes Deployment manifest
**File:** `infrastructure/kubernetes/base/backend.yaml:45`

```yaml
- name: DATABASE_URL
  value: postgres://sport_app:sportpass@db-service:5432/sport
```

The credential `sportpass` is committed in plaintext. Any repository read access exposes the database password.

**Recommended fix:** Replace with a `secretKeyRef`:
```yaml
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: sport-db-secret
      key: database-url
```
Create the secret out-of-band: `kubectl create secret generic sport-db-secret --from-literal=database-url="postgres://..."`.

---

#### C-5 · Insecure default SECRET_KEY and wildcard ALLOWED_HOSTS
**File:** `backend/core/settings.py:11–13`

```python
SECRET_KEY = os.getenv('SECRET_KEY', 'default-unsafe-key-for-dev')
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '*').split(',')
```

If either env var is missing from a deployment, Django silently runs with a predictable key (forged session cookies, HMAC bypasses) and accepts requests from any Host header (Host header injection).

**Recommended fix:** Remove the fallback entirely so Django fails fast if variables are unset:
```python
SECRET_KEY = os.environ['SECRET_KEY']  # raises KeyError → catches misconfigured deploys early
ALLOWED_HOSTS = os.environ['ALLOWED_HOSTS'].split(',')
```

---

#### C-6 · TENANT_ADMIN can escalate users to GLOBAL_OWNER via UserCreateView
**File:** `backend/users/views.py:234–253`

```python
role = request.data.get('role', 'ATHLETE')
if role in dict(Role.choices):
    user.role = role  # any role, including GLOBAL_OWNER, accepted
```

A TENANT_ADMIN passes `role=GLOBAL_OWNER` in the request body to create a super-admin account within their tenant context.

**Recommended fix:** Gate role assignment by the caller's own privilege level:
```python
allowed_roles = ['ATHLETE', 'TENANT_MODERATOR']
if request.user.role == 'GLOBAL_OWNER':
    allowed_roles += ['TENANT_ADMIN', 'GLOBAL_OWNER']
elif request.user.role == 'TENANT_ADMIN':
    allowed_roles += ['TENANT_ADMIN']

if role in allowed_roles:
    user.role = role
```

---

#### C-7 · Telemetry FastAPI CORS allows all origins
**File:** `telemetry/main.py:46–51`

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

The Django backend was recently tightened to a whitelist (security Phase A) but the telemetry service retains `allow_origins=["*"]`. Since ingest endpoints accept auth-less GPS packets, cross-origin requests from arbitrary web pages can inject data.

**Recommended fix:** Align with the Django-side allowlist or restrict to `null` (block browser requests entirely since mobile/native clients don't use CORS).

---

### HIGH

---

#### H-1 · Stale brand names in CORS allowlist
**File:** `backend/core/settings.py:155–165`

```python
CORS_ALLOWED_ORIGINS = [
    ...
    'https://sport-admin.vercel.app',    # old brand
    'https://sport-platform.com',        # old brand
]
```

Following the 4VELO rebrand these origins should be replaced with the new domain(s). If the old Vercel deployment is still live, any compromise of that project could relay credentialed API requests.

**Recommended fix:** Replace with 4VELO production domains and remove stale entries.

---

#### H-2 · LeaderboardView annotation uses wrong related_name — always returns NULL
**File:** `backend/activities/views.py:290–292`

```python
ranking = qs.annotate(
    total_distance=Sum('activity__distance')   # wrong: related_name is 'activities'
).order_by('-total_distance')[:100]
```

`Activity.user` uses `related_name='activities'`. Django resolves `activity__distance` using the auto-generated accessor name, which does not exist (it would be `activity_set` by convention). This annotation will always yield `None`, causing every user to have 0 points on the leaderboard.

**Recommended fix:**
```python
total_distance=Sum('activities__distance')
```

---

#### H-3 · AnomalyListView and TelemetryLiveView have no role guard
**Files:** `backend/activities/views.py:256–269`, `backend/activities/views.py:211–254`

Both views use only `IsAuthenticated`. Any athlete can list all fraud detections (leaking usernames and verification scores of other athletes) and query live GPS positions via the Traccar proxy.

**Recommended fix:** Add `IsTenantModerator | IsGlobalOwner` permissions. For `TelemetryLiveView`, restrict to `IsTenantAdmin | IsGlobalOwner`.

---

#### H-4 · StravaCa llback / GarminCallback OAuth state parameter is unvalidated
**File:** `backend/activities/views.py:25–48`, `61–83`

```python
user_id = request.query_params.get('state')
user = User.objects.get(pk=user_id)
```

The `state` parameter is entirely controlled by the requester. There is no CSRF token embedded to verify that the callback corresponds to an auth flow initiated by that user. An attacker can craft a callback URL with `state=<victim_user_id>` to connect their Strava account to the victim. Strava marks all synced activities as `is_verified=True, verification_score=1.0`, so this is also an anti-cheat bypass.

**Recommended fix:** On auth URL generation, store a random per-user nonce in Redis. In the callback, verify the nonce before proceeding:
```python
# On auth URL generation:
nonce = secrets.token_urlsafe(32)
cache.set(f'strava_nonce:{user.id}', nonce, timeout=600)
state = f"{user.id}:{nonce}"

# On callback:
user_id, nonce = state.split(':', 1)
expected = cache.get(f'strava_nonce:{user_id}')
if not hmac.compare_digest(nonce, expected or ''):
    return Response({"error": "invalid state"}, status=400)
```

---

#### H-5 · Garmin distance conversion is incorrect
**File:** `backend/activities/wearables.py:298`

```python
distance=distance * 100,  # Garmin returns in cm? Convert to m
```

Garmin's Connect API (`activitylist-service`) returns `distance` in **metres**. Multiplying by 100 gives centimetres-to-metres conversion when the data is already in metres, producing distances 100× too large. A 10 km ride becomes 1000 km, inflating leaderboard scores dramatically.

**Recommended fix:** Remove the `* 100` multiplier. Garmin API docs confirm the field is in metres.

---

#### H-6 · Garmin exchange_code creates mock integration on production failures
**File:** `backend/activities/wearables.py:212–222`

```python
if not GARMIN_CLIENT_ID or GARMIN_CLIENT_ID == 'mock':
    integration, _ = WearableIntegration.objects.update_or_create(
        ...
        defaults={'access_token': 'mock_garmin_token', 'is_active': True}
    )
    return integration
```

If `GARMIN_CLIENT_ID` is an empty string (misconfigured env var), a real production **user's** integration is silently replaced with a mock token. Any subsequent sync attempt with this token will fail silently.

**Recommended fix:** Remove the mock fallback path entirely. If credentials are missing, raise a `misconfiguration` error that alerts on-call.

---

#### H-7 · ActiveRideHUDScreen uses entirely hardcoded values — not connected to GpsSyncManager
**File:** `mobile/src/screens/ActiveRideHUDScreen.tsx`

The screen renders `32.8 km/h`, `18.5 km`, `155 bpm`, `35:22` as string literals. There is no prop intake or state subscription from `GpsSyncManager`. The screen will always show these demo values regardless of the actual ride in progress.

**Recommended fix:** Accept `TrackingStats` props or subscribe to `GpsSyncManager.setUpdateCallback`. The `GpsSyncManager` is already fully implemented and emits stats every 2 s.

---

#### H-8 · RideDashboardScreen hardcodes a Google-hosted image URL and random chart data
**File:** `mobile/src/screens/RideDashboardScreen.tsx:299`, `287–289`

```tsx
source={{ uri: 'https://lh3.googleusercontent.com/aida/...' }}
```
```tsx
const weeklyBars = React.useMemo(() => {
    return WEEK_DAYS.map(() => Math.random() * 0.8 + 0.1);
}, []);
```

The avatar is an external Google URL that will be unavailable in production (rate-limited, privacy-violating for other users). The weekly load chart regenerates random data on every render, making it functionally meaningless.

**Recommended fix:** Use `user.avatar` from the API profile response. Fetch weekly activity summaries via `ActivityService.getHistory()`.

---

#### H-9 · CommonPasswordValidator is disabled
**File:** `backend/core/settings.py:95`

```python
# {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
```

Common passwords like `password123`, `qwerty123`, and `12345678` will be accepted. This is particularly risky because `ACCOUNT_EMAIL_VERIFICATION = 'optional'` means registrations are not verified — bots can bulk-create weak-password accounts.

**Recommended fix:** Uncomment the validator. Consider adding `zxcvbn`-based validation for stricter entropy checks.

---

### MEDIUM

---

#### M-1 · Leaderboard Redis TTL is 30 minutes, not 30 seconds as declared
**File:** `backend/activities/leaderboards.py:81`, `124`

```python
_CACHE_TTL_S = int(os.getenv("LEADERBOARD_CACHE_TTL", "30"))  # seconds

r.expire(key, _CACHE_TTL_S * 60)  # BUG: 30 * 60 = 1800s = 30 minutes
```

The variable name and comment both say "seconds" but the expiry statement multiplies by 60. Leaderboard keys live for 30 minutes rather than 30 seconds. After a `batch_recalculate`, stale rankings persist for 30 minutes.

**Recommended fix:** Remove the `* 60` (value is already in seconds) or rename the constant to `_CACHE_TTL_M` and document the intent clearly.

---

#### M-2 · Garmin startTimeInSeconds variable misnamed as startTimeMs, causing 1000× timestamp error
**File:** `backend/activities/wearables.py:283–286`

```python
start_time_ms = act.get('startTimeInSeconds')  # name says ms, source says seconds
start_time = timezone.datetime.fromtimestamp(start_time_ms / 1000)  # divides seconds by 1000
```

The Garmin field is `startTimeInSeconds` (Unix epoch in seconds). Assigning it to `start_time_ms` and then dividing by 1000 converts it to a timestamp 1000× too small (year ~1972 for current activities). Activities will be created with wildly incorrect start times.

**Recommended fix:**
```python
start_time_s = act.get('startTimeInSeconds')
if not start_time_s:
    continue
start_time = timezone.datetime.fromtimestamp(start_time_s, tz=timezone.utc)
```

---

#### M-3 · InvitationTokenView returns temporary_password in the API response
**File:** `backend/users/views.py:351–357`

```python
return success(data={
    "username": username,
    "temporary_password": temp_password,  # ← in JSON response body
    ...
})
```

Returning a plaintext password in an HTTP response body means it will appear in:
- Nginx/proxy access logs
- Sentry request payloads
- Admin frontend's network tab
- API gateway request logging

The password is also sent by email; the API response inclusion adds no legitimate benefit.

**Recommended fix:** Remove `"temporary_password"` from the response. Rely solely on the email delivery. If the caller needs confirmation, return `{"email_sent": true}`.

---

#### M-4 · Missing gps_points TimescaleDB hypertable index — full-table scan on history queries
**File:** `telemetry/main.py:213–214`

```sql
CREATE TABLE IF NOT EXISTS gps_points (
    time TIMESTAMPTZ NOT NULL,
    device_id TEXT NOT NULL,
    ...
);
-- SELECT create_hypertable('gps_points', 'time', if_not_exists => TRUE);
```

While TimescaleDB's hypertable partitions by `time`, there is no secondary index on `device_id`. The history query:
```sql
SELECT * FROM gps_points WHERE device_id = $1 AND time >= to_timestamp($2) ORDER BY time ASC
```
will scan all time-partitions for a `device_id` without an index.

**Recommended fix:**
```sql
CREATE INDEX IF NOT EXISTS idx_gps_points_device_time ON gps_points (device_id, time DESC);
```

---

#### M-5 · MMKV fallback in GpsSyncManager is a silent no-op — GPS buffering fails without notification
**File:** `mobile/src/services/GpsSyncManager.ts:41–46`

```typescript
_storage = {
    getString: (key: string) => null,
    set: (key: string, value: any) => { },
    delete: (key: string) => { },
} as any;
```

If MMKV JSI initialisation fails (known issue on some Expo builds), GPS points are silently dropped. The user continues their ride believing it is being recorded. On sync, `uploadBatch` is called with an empty array.

**Recommended fix:** Surface the failure to the user (toast/modal), and log to Firebase Crashlytics with enough context to debug. Consider an in-memory queue as a true fallback for short failures, with a max-buffer warning.

---

#### M-6 · TenantUpdateView uses manual role string comparison instead of permission classes
**File:** `backend/users/views.py:151–170`

```python
permission_classes = (permissions.IsAuthenticated,)

def put(self, request, *args, **kwargs):
    if request.user.role != 'GLOBAL_OWNER' and (
        request.user.role != 'TENANT_ADMIN' or request.user.tenant_id != tenant.id
    ):
```

Manual inline checks bypass the reusable `IsGlobalOwner` / `IsTenantAdmin` permission classes, making the pattern harder to audit and easier to diverge in future. The serializer is also bypassed — only `primary_color` and `secondary_color` are updated, ignoring `white_label_domain`, `config_json`, etc.

**Recommended fix:** Use `permission_classes = (IsAuthenticated, IsGlobalOwner | IsTenantAdmin)` and a proper `TenantSerializer`.

---

#### M-7 · POI model is missing from RLS policy tables
**File:** `backend/core/rls.py:7–15` vs `backend/activities/models.py:62–80`

`DIRECT_RLS_TABLES` contains `activities_activity` and `activities_poi`, but the database table for `POI` is likely `activities_poi`. The `Voucher` RLS goes through `activities_poi` via join. However, the `POI` viewset (`backend/activities/views.py:305–318`) queries directly:
```python
queryset = POI.objects.all()
```
And the `get_queryset` filters by `tenant_id` from the request user — not by DB-level RLS. If a user has no `tenant_id` (e.g. `GLOBAL_OWNER`), **all POIs across all tenants are returned**, which may be intentional but should be explicit documentation, not silent.

**Recommended fix:** Add an explicit comment documenting GLOBAL_OWNER's cross-tenant POI visibility. Confirm `activities_poi` is correctly enabled for RLS and that the policy applies as intended.

---

#### M-8 · Hardcoded Matrix room ID in Celery task
**File:** `backend/activities/tasks.py:122`

```python
MatrixProvisioner.send_notification(
    "!admin_room_id:matrix.org",
    f"🚨 [LIGHTWEIGHT] Rejected ..."
)
```

`"!admin_room_id:matrix.org"` is a placeholder string. This notification will never reach any real room. Anti-cheat rejection alerts are silently swallowed.

**Recommended fix:** Move the room ID to an environment variable (`MATRIX_ADMIN_ROOM_ID`) and validate at startup. If not configured, log a warning rather than silently sending to a dead room.

---

### LOW

---

#### L-1 · APP_ROLE uses old brand name "sport_app"
**File:** `backend/core/rls.py:17`

```python
APP_ROLE = "sport_app"
```

Following the 4VELO rebrand, the PostgreSQL role name is still `sport_app`. While functionally fine if the database schema has not changed, it creates confusion and grep-based searches for "4velo" will miss this string.

---

#### L-2 · `c` and `C` are both declared as aliases for `theme.colors` in style closures
**File:** `mobile/src/screens/ActiveRideHUDScreen.tsx:9–10`

```tsx
const c = theme.colors as any;
const C = theme.colors as any;
```

Both variables are identical aliases. `C` is declared but only `c` is used in several places, and vice versa. This creates confusion about which alias is canonical and uses `as any`, stripping STITCH theme type safety entirely.

**Recommended fix:** Use a single alias (`const c = theme.colors as StitchTheme['colors']`) or use the typed `theme.colors` directly without aliasing.

---

#### L-3 · Traccar default credentials in TelemetryService
**File:** `backend/activities/services.py:211–212`

```python
USER = os.getenv('TRACCAR_USER', 'admin')
PASS = os.getenv('TRACCAR_PASS', 'admin')
```

Default Traccar credentials `admin/admin` are used when env vars are absent. If the Traccar service is reachable (internal Docker/K8s network) without authentication on the network layer, a misconfigured deployment passes these default credentials.

---

#### L-4 · `email` is not required in RegisterSerializer
**File:** `backend/users/serializers.py:34–35`

```python
fields = ('username', 'email', 'password', 'tenant_id')
```

`email` is not in `required_fields` and `validate_email` only deduplicates `if value`. Users can register without an email address, blocking password reset flows.

---

#### L-5 · `activities.tasks` references `activities.ml_retrain.*` queue route but no such tasks exist
**File:** `backend/core/settings.py:203`

```python
'activities.ml_retrain.*': {'queue': 'default'},
```

The Celery route points to `activities.ml_retrain.*` but the task name defined in `backend/activities/tasks.py:214` is `activities.tasks.retrain_ml_model`. The route pattern will never match and these tasks will land on the default queue regardless.

**Recommended fix:** Update the route pattern to `'activities.tasks.retrain_ml_model'` or `'activities.tasks.*'`.

---

#### L-6 · `@app.on_event("startup")` is deprecated in FastAPI
**File:** `telemetry/main.py:196`, `233`

```python
@app.on_event("startup")
async def startup() -> None:
```

`on_event` lifecycle decorators are deprecated since FastAPI 0.93. The recommended pattern is `lifespan` context manager.

**Recommended fix:**
```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    yield
    # shutdown

app = FastAPI(lifespan=lifespan, ...)
```

---

#### L-7 · Beta dependency in production mobile app (`@legendapp/state@3.0.0-beta.46`)
**File:** `mobile/package.json:25`

```json
"@legendapp/state": "3.0.0-beta.46",
```

A beta version of a state management library is pinned for production. Beta builds can have breaking changes between patch releases and no SLA on bug fixes.

**Recommended fix:** Upgrade to the stable `@legendapp/state@^3.x` once it reaches GA, or pin with explicit risk acceptance note in comments.

---

## Architecture Notes

### Strengths
- **RLS implementation** is well-designed: parameterised `set_config`, proper `current_setting('app.tenant_id', TRUE)` with `NULLIF`, and explicit `TO sport_app` role scoping. The middleware correctly clears the session variable for unauthenticated requests.
- **Anti-cheat pipeline** layers are architecturally sound: Fast Gate (O(N) kinematic) → ML Isolation Forest (Layer 1.5) → V-max heuristics → BRouter topology. The pipeline degrades gracefully when the ML model is absent.
- **Leaderboard Redis Sorted Sets** with TTL, pipeline batch ZADD, and `CONCURRENTLY`-refreshed materialized view is a good pattern for high-write-throughput rankings.
- **JWT impersonation tokens** include `impersonated=True` and `impersonator_id` claims, and the audit middleware correctly logs only mutating requests.
- **GpsSyncManager** architecture — background task + in-memory MMKV buffer + exponential retry upload — is robust for mobile GPS scenarios.

### Concerns
- **Two separate haversine implementations** exist: `telemetry/main.py:77–86` and `mobile/src/services/GpsSyncManager.ts:182–189`, plus a third in `backend/activities/ml_anomaly.py:51–58`. These should be extracted to `shared/` utilities to avoid silent drift.
- **Telemetry service is architecturally isolated** from Django's auth system. There is no token verification path. This requires architectural decision: either pass a shared secret, use Redis-based session tokens from Django, or introduce a service mesh sidecar.
- **Materialized view `city_rankings_mv`** is referenced in tasks but its schema/creation DDL is not present in the reviewed codebase. This should be in a migration or setup script.

---

## Test Coverage Gaps

| Area | Gap |
|------|-----|
| `activities/wearables.py` | No test for Garmin token exchange fallback or mock path |
| `activities/views.py` | No test for `TelemetryConfigView` permission enforcement |
| `users/views.py` | No test that `TENANT_ADMIN` cannot create `GLOBAL_OWNER` users |
| `telemetry/main.py` | No test for any endpoint (no test file present) |
| `core/rls.py` | `test_rls.py` exists but only covers happy-path isolation; no test for `set_config('')` (unauthenticated) path |
| `activities/leaderboards.py` | No test for `batch_recalculate` or TTL behaviour |

---

## Dependency Hygiene

| Package | Version | Note |
|---------|---------|------|
| `numpy` | `1.26.4` | Two major versions behind (2.x); 1.26.x is security-maintained but no new features |
| `scikit-learn` | `1.5.0` | Behind 1.6.x; no critical CVEs but worth tracking |
| `django` | `4.2.30` | LTS, OK |
| `gunicorn` | `23.0.0` | Current |
| `@legendapp/state` | `3.0.0-beta.46` | **Beta in production** |
| `react-native-mmkv` | `^2.12.2` | v3 released; v2 has known JSI init timing issues (matching the fallback in GpsSyncManager) |
| `react-native` | `0.83.6` | Recent; OK |
| `expo` | `^55.0.0` | Current SDK |
