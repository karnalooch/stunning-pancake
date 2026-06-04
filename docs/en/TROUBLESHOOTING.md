# Document

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../TROUBLESHOOTING.md) |
| **canonical_path** | docs/en/TROUBLESHOOTING.md |
---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Platform Operator / On-call |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Developers, operators |

Guide to solving common problems with the 4VELO platform - errors, database, Redis, Celery, CORS, authorization, performance and log analysis.

**operations SSOT:** [operations/RAILWAY_CELERY_MEMORY.md](./operations/RAILWAY_CELERY_MEMORY.md) · [operations/SIMULATOR.md](./operations/SIMULATOR.md) · [OPERATIONS_INDEX.md](./operations/OPERATIONS_INDEX.md)

---

## 🚨 Common errors and solutions

### Error: `SECRET_KEY must be set in production`

**Cause:** The `SECRET_KEY` variable is missing in the production environment.

**Solution:**```bash
# Wygeneruj klucz
python -c "import secrets; print(secrets.token_urlsafe(50))"

# Ustaw w .env lub Railway Variables
SECRET_KEY=<wygenerowany-klucz>
```### Error: `relation "users_user" does not exist`

**Cause:** Migrations have not started.

**Solution:**```bash
python manage.py migrate
```### Error: `permission denied for table users_user`

**Cause:** Lack of database or RLS permissions blocks access.

**Solution:**```bash
# Sprawdź rolę bazy danych
psql -U 4velo_user -d 4velo_db -c "\du"

# Sprawdź polityki RLS
psql -U 4velo_user -d 4velo_db -c "SELECT * FROM pg_policies;"
```### Error: `CORS error: No 'Access-Control-Allow-Origin' header`

**Causes (check in this order):**

1. **Backend unavailable (502/503)** - When Django/Postgres crashes, Railway edge returns `502 Bad Gateway` **without** CORS headers. The browser reports this as a CORS error on preflight (`OPTIONS`), which is misleading. Check backend health (`curl -I https://<backend>/api/health/`) - if `502` and no `Access-Control-Allow-Origin`, repair infrastructure (Postgres, redeploy), not CORS.
2. **Unknown origin** - admin's origin must be in the `CORS_ALLOWED_ORIGINS` list. In `backend/core/settings.py` the default is, among others: `https://admin-production-083b.up.railway.app`; additional origins: env `FRONTEND_URL`, `ADMIN_URL`, or `CORS_ALLOWED_ORIGINS` (CSV).

**Solution (when backend is alive and origin is new):**```bash
# Railway → Backend service → Variables
FRONTEND_URL=https://admin-production-083b.up.railway.app
# opcjonalnie dodatkowe domeny:
CORS_ALLOWED_ORIGINS=https://my-other-admin.example.com
```### Error: `Token is invalid or expired`

**Cause:** The JWT token has expired or is invalid.

**Solution:**```bash
# Odśwież token
curl -X POST http://localhost:8000/api/auth/token/refresh/ \
  -H "Content-Type: application/json" \
  -d '{"refresh": "<refresh_token>"}'
```### Error: Empty black desktop with left panel "SPORT OS PRO EDITION"

**Reason:** 
* The browser cached (Cache / Service Worker) the old static panel code from before the interface refactor (commit `0f9ca9d3`).
* Starting the old, frozen desktop version (Portable `.exe`).

**Solution:**
1. In your browser, perform a hard cache restart at `http://localhost:8080` (or in the cloud):
   * **Windows/Linux**: `Ctrl + F5` (or `Ctrl + Shift + R`)
   * **Mac**: `Cmd + Shift + R`
   * You can also open the website in an incognito browser window.
2. If you are using the desktop development version (Electron), rebuild the application:```bash
   cd admin
   npm run build:exe
   ```### Error: React Error #31 "Objects are not valid as a React child" when starting the simulator (Step 4)

**Cause:** Celery returns worker statistics in `worker_stats.get('total')` as a `{task_name: count}` dictionary instead of an integer. Trying to render an object (dictionary) directly in frontend JSX results in React rendering paralysis.

**Solution:**
1. **Backend**: Make sure that in `backend/activities/admin_views.py` the statistics are summed before sending the API response:```python
   total_raw = worker_stats.get('total', 0)
   total_count = sum(total_raw.values()) if isinstance(total_raw, dict) else int(total_raw or 0)
   ```2. **Frontend**: In `admin/src/modules/analytics/SimulatorPage.tsx`, apply safe type conversion/fallback before rendering the job count:```tsx
   typeof total_tasks === 'object' ? 0 : total_tasks
   ```---

## 🐘 Database problems

### Problem: No connection to PostgreSQL

**Symptoms:**```
could not connect to server: Connection refused
Is the server running on host "db" (172.18.0.2) and accepting TCP/IP connections on port 5432?
```**Solution:**

1. **Check container status:**```bash
docker compose ps db
docker compose logs db
```2. **Check connection:**```bash
docker compose exec db pg_isready -U 4velo_user -d 4velo_db
```3. **Container restart:**```bash
docker compose restart db
```4. **Check environment variables:**```bash
echo $DATABASE_URL
# Powinno być: postgres://4velo_user:password@db:5432/4velo_db
```### Problem: PostGIS extension does not exist

**Symptoms:**```
function st_geomfromtext(text, integer) does not exist
```**Solution:**```bash
# Połącz się z bazą
docker compose exec db psql -U 4velo_user -d 4velo_db

# Utwórz rozszerzenie
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
\q
```### Problem: RLS blocks queries

**Symptoms:**```
new row violates row-level security policy for table "activities"
```**Solution:**

1. **Check RLS Policies:**```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'activities';
```2. **Check session tenant_id:**```sql
SELECT current_setting('app.tenant_id');
```3. **Disable RLS temporarily (debug only):**```sql
ALTER TABLE activities DISABLE ROW LEVEL SECURITY;
```4. **Apply RLS policies again:**```bash
python apply_rls.py
```### Problem: Slow queries

**Solution:**

1. **Analyze query plan:**```sql
EXPLAIN ANALYZE SELECT * FROM activities WHERE user_id = 1;
```2. **Check indexes:**```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'activities';
```3. **Add missing indexes:**```sql
CREATE INDEX CONCURRENTLY idx_activities_user_tenant
ON activities (user_id, tenant_id);
```4. **Uruchom VACUUM:**```sql
VACUUM ANALYZE activities;
```---

## 🔴 Redis problems

### Problem: No connection to Redis

**Symptoms:**```
Error connecting to Redis: Connection refused
```**Solution:**

1. **Check container status:**```bash
docker compose ps redis
docker compose logs redis
```2. **Check connection:**```bash
docker compose exec redis redis-cli ping
# Powinno zwrócić: PONG
```3. **Check URL:**```bash
echo $REDIS_URL
# Powinno być: redis://redis:6379/0
```### Problem: Celery does not connect to Redis

**Symptoms:**```
consumer: Cannot connect to redis://redis:6379/0
```**Solution:**

1. **Restart Celery:**```bash
docker compose restart celery
```2. **Check Celera logs:**```bash
docker compose logs celery
```3. **Check queues:**```bash
docker compose exec redis redis-cli keys "celery*"
```---

## 🔄 Celery problems

### Problem: Worker does not start

**Symptoms:**```
celery: command not found
```**Solution:**

1. **Check installation:**```bash
pip show celery
```2. **Reinstall:**```bash
pip install celery==5.4.0
```3. **Run manually:**```bash
cd backend
celery -A core worker -l info -Q celery
```### Problem: Tasks are not executed

**Symptoms:** Jobs queued but not processed.

**Solution:**

1. **Check Queue:**```bash
docker compose exec redis redis-cli llen celery
```2. **Check worker status:**```bash
celery -A core status
```3. **Purge the queue (carefully):**```bash
celery -A core purge
```4. **Restart workera:**```bash
docker compose restart celery
```### Problem: Celery Beat does not run periodic tasks

**Solution:**

1. **Check the database for scheduler:**```bash
docker compose exec db psql -U 4velo_user -d 4velo_db -c "SELECT * FROM django_celery_beat_periodictask;"
```2. **Restart Beat:**```bash
docker compose restart celerybeat
```---

## 🌐 CORS issues

### Problem: CORS errors in the browser

**Symptoms:**```
Access to fetch at 'http://localhost:8000/api/...' from origin 'http://localhost:5173' has been blocked by CORS policy
No 'Access-Control-Allow-Origin' header on preflight response
```**Solution:**

1. **First: Is the backend responding?** (Railway production)```bash
curl.exe -s -D - -o NUL -X OPTIONS "https://backend-production-55c7.up.railway.app/api/auth/token/" ^
  -H "Origin: https://admin-production-083b.up.railway.app" ^
  -H "Access-Control-Request-Method: POST"
```- `HTTP/1.1 502` bez `Access-Control-Allow-Origin` → backend/DB down; napraw Postgres i redeploy backendu.
- `HTTP/1.1 200` z `Access-Control-Allow-Origin: https://admin-production-083b.up.railway.app` → CORS OK.

2. **Konfiguracja CORS** (`backend/core/settings.py`):
   - Domyślna lista localhost + `https://admin-production-083b.up.railway.app`
   - Do listy dokładane są: `FRONTEND_URL`, `ADMIN_URL`, oraz CSV `CORS_ALLOWED_ORIGINS`
   - `CSRF_TRUSTED_ORIGINS` = te same originy + opcjonalny `CSRF_TRUSTED_ORIGINS` z env

3. **Railway Variables (Backend service):**```bash
FRONTEND_URL=https://admin-production-083b.up.railway.app
ALLOWED_HOSTS=backend-production-55c7.up.railway.app,sport-platform.com
# tylko przy dodatkowych domenach:
CORS_ALLOWED_ORIGINS=https://custom-admin.example.com
```4. **Middleware** - `corsheaders.middleware.CorsMiddleware` must be first in `MIDDLEWARE`.

5. **Debug CORS (live backend):**```bash
curl -v -H "Origin: http://localhost:5173" http://localhost:8000/api/
# Powinno zwrócić: Access-Control-Allow-Origin: http://localhost:5173
```---

## 🔐 Authorization problems

### Problem: 401 Unauthorized

**Symptoms:** All requests return 401.

**Solution:**

1. **Check Token:**```bash
curl -X POST http://localhost:8000/api/auth/token/verify/ \
  -H "Content-Type: application/json" \
  -d '{"token": "<access_token>"}'
```2. **Check Expiry:**```python
# backend/core/settings.py
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
}
```3. **Refresh Token:**```bash
curl -X POST http://localhost:8000/api/auth/token/refresh/ \
  -H "Content-Type: application/json" \
  -d '{"refresh": "<refresh_token>"}'
```### Problem: 403 Forbidden

**Symptoms:** The logged in user has no access.

**Solution:**

1. **Check user roles:**```bash
curl http://localhost:8000/api/users/rbac/user-roles/my_roles/ \
  -H "Authorization: Bearer <token>"
```2. **Check permissions:**```python
# W shell Django
python manage.py shell
>>> user = User.objects.get(username='test')
>>> user.get_permissions()
```3. **Assign role:**```python
from users.rbac_models import Role, UserRole
role = Role.objects.get(slug='tenant_admin')
UserRole.objects.create(user=user, role=role)
```---

## 🚫 Permission Denied Errors

### Problem: "You do not have permission to perform this action"

**Solution:**

1. **Check required permission:**```python
# W widoku
permission_classes = [HasPermission('activities.approve')]
```2. **Check user permissions:**```bash
curl http://localhost:8000/api/users/rbac/user-roles/my_roles/ \
  -H "Authorization: Bearer <token>"
```3. **Add role permission:**```python
from users.rbac_models import Role, Permission, RolePermission
role = Role.objects.get(slug='tenant_moderator')
perm = Permission.objects.get(codename='activities.approve')
RolePermission.objects.create(role=role, permission=perm)
```---

## ⚡ Performance issues

### Problem: Slow API responses

**Solution:**

1. **Check N+1 queries:**```python
# W settings.py (development)
LOGGING = {
    'loggers': {
        'django.db.backends': {
            'level': 'DEBUG',
        },
    },
}
```2. **Użyj select_related/prefetch_related:**```python
# Zamiast:
activities = Activity.objects.all()

# Użyj:
activities = Activity.objects.select_related('user', 'tenant').all()
```3. **Check Redis cache:**```bash
docker compose exec redis redis-cli info stats
# Sprawdź hit_rate
```4. **Optimize pagination:**```python
# Zmniejsz page_size dla dużych zbiorów
'PAGE_SIZE': 20,
```### Problem: High memory usage

**Solution:**

1. **Check memory usage:**```bash
docker stats
```2. **Restrict Gunicorn workers:**```bash
# Dockerfile lub docker-compose
command: gunicorn --workers 3 core.wsgi:application
```3. **Optimize Django:**```python
# settings.py
CONN_MAX_AGE = 60  # Connection pooling
```---

## 📊 Log analysis

### Django logs```bash
# Docker
docker compose logs -f backend

# Railway
railway logs

# File (jeśli skonfigurowane)
tail -f /var/log/django.log
```### Logi Celery```bash
docker compose logs -f celery
```### Database logs```bash
docker compose logs -f db
```### Log in Red```bash
docker compose logs -f redis
```### Login levels```python
# backend/core/settings.py
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'file': {
            'class': 'logging.FileHandler',
            'filename': 'django.log',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console', 'file'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
        'activities': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
}
```### Useful commands```bash
# Szukaj błędów w logach
docker compose logs backend | grep -i error

# Szukaj 500
docker compose logs backend | grep "500"

# Szukaj wolnych zapytań
docker compose logs db | grep "duration:"

# Monitoruj logi w czasie rzeczywistym
docker compose logs -f --tail=100 backend
```---

## Simulator and Live Map (admin)

### Live starts during batch / few riders on the map

**Symptoms:** `only 160 athletes available`, ~48 on the map with thousands planned, log `Batch simulation is still in progress`.

**Solution:**

1. Stop live and batch; `POST /api/activities/admin/simulator-reset/`.
2. Run batch and **wait** for `Done: … users` (UI: Simulator with live enabled waits automatically).
3. Only then live with `pool_pct=1.0`.

Details: [operations/SIMULATOR.md](./operations/SIMULATOR.md).

### BRouter: `no track found at pass=0`

**Cause:** Starting point outside the road network or missing `.rd5` tile.

**Solution:** Check service `brouter`, segment volume, `BROUTER_URL` on `celery-worker-simulation`, `lookups.dat` v11. See [operations/BROUTER.md](./operations/BROUTER.md).

### The map shows nothing at some zoom levels

**Cause (historical):** zoom dead zone 9-11 (hidden GL layer). **From 2026-06-02:** compact icons + clusters - requires deploying the latest admin (hard refresh Ctrl+F5).

### `disk_guard: Postgres budget`

Set `SCALE_POSTGRES_DISK_BUDGET_GB=5` (or volume size) to **backend** and **celery-worker-simulation**. See [DISK_GUARD.md](./DISK_GUARD.md).

---

> **See also:** [operations/](./operations/) - Simulator and BRouter runbooks  
> **See also:** [🌐 Deployment Guide](./DEPLOYMENT.md) - production deployment  
> **See also:** [🔄 Migration Guide](./MIGRATION.md) - migrations and rollback
