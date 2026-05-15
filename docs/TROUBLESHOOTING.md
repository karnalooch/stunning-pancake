# 🔍 Troubleshooting — Rozwiązywanie Problemów

Przewodnik rozwiązywania typowych problemów z platformą 4VELO — błędy, baza danych, Redis, Celery, CORS, autoryzacja, wydajność i analiza logów.

---

## 🚨 Typowe błędy i rozwiązania

### Błąd: `SECRET_KEY must be set in production`

**Przyczyna:** Brak zmiennej `SECRET_KEY` w środowisku produkcyjnym.

**Rozwiązanie:**
```bash
# Wygeneruj klucz
python -c "import secrets; print(secrets.token_urlsafe(50))"

# Ustaw w .env lub Railway Variables
SECRET_KEY=<wygenerowany-klucz>
```

### Błąd: `relation "users_user" does not exist`

**Przyczyna:** Migracje nie zostały uruchomione.

**Rozwiązanie:**
```bash
python manage.py migrate
```

### Błąd: `permission denied for table users_user`

**Przyczyna:** Brak uprawnień do bazy danych lub RLS blokuje dostęp.

**Rozwiązanie:**
```bash
# Sprawdź rolę bazy danych
psql -U 4velo_user -d 4velo_db -c "\du"

# Sprawdź polityki RLS
psql -U 4velo_user -d 4velo_db -c "SELECT * FROM pg_policies;"
```

### Błąd: `CORS error: No 'Access-Control-Allow-Origin' header`

**Przyczyna:** Brak konfiguracji CORS.

**Rozwiązanie:**
```bash
# Ustaw w .env
CORS_ALLOWED_ORIGINS=http://localhost:3001,http://localhost:5173,https://sport-platform.com
```

### Błąd: `Token is invalid or expired`

**Przyczyna:** Token JWT wygasł lub jest niepoprawny.

**Rozwiązanie:**
```bash
# Odśwież token
curl -X POST http://localhost:8000/api/auth/token/refresh/ \
  -H "Content-Type: application/json" \
  -d '{"refresh": "<refresh_token>"}'
```

---

## 🐘 Problemy z bazą danych

### Problem: Brak połączenia z PostgreSQL

**Objawy:**
```
could not connect to server: Connection refused
Is the server running on host "db" (172.18.0.2) and accepting TCP/IP connections on port 5432?
```

**Rozwiązanie:**

1. **Sprawdź status kontenera:**
```bash
docker compose ps db
docker compose logs db
```

2. **Sprawdź połączenie:**
```bash
docker compose exec db pg_isready -U 4velo_user -d 4velo_db
```

3. **Restart kontenera:**
```bash
docker compose restart db
```

4. **Sprawdź zmienne środowiskowe:**
```bash
echo $DATABASE_URL
# Powinno być: postgres://4velo_user:password@db:5432/4velo_db
```

### Problem: Rozszerzenie PostGIS nie istnieje

**Objawy:**
```
function st_geomfromtext(text, integer) does not exist
```

**Rozwiązanie:**
```bash
# Połącz się z bazą
docker compose exec db psql -U 4velo_user -d 4velo_db

# Utwórz rozszerzenie
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
\q
```

### Problem: RLS blokuje zapytania

**Objawy:**
```
new row violates row-level security policy for table "activities"
```

**Rozwiązanie:**

1. **Sprawdź polityki RLS:**
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'activities';
```

2. **Sprawdź sesję tenant_id:**
```sql
SELECT current_setting('app.tenant_id');
```

3. **Wyłącz RLS tymczasowo (tylko debug):**
```sql
ALTER TABLE activities DISABLE ROW LEVEL SECURITY;
```

4. **Zastosuj polityki RLS ponownie:**
```bash
python apply_rls.py
```

### Problem: Wolne zapytania

**Rozwiązanie:**

1. **Analizuj plan zapytania:**
```sql
EXPLAIN ANALYZE SELECT * FROM activities WHERE user_id = 1;
```

2. **Sprawdź indeksy:**
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'activities';
```

3. **Dodaj brakujące indeksy:**
```sql
CREATE INDEX CONCURRENTLY idx_activities_user_tenant
ON activities (user_id, tenant_id);
```

4. **Uruchom VACUUM:**
```sql
VACUUM ANALYZE activities;
```

---

## 🔴 Problemy z Redis

### Problem: Brak połączenia z Redis

**Objawy:**
```
Error connecting to Redis: Connection refused
```

**Rozwiązanie:**

1. **Sprawdź status kontenera:**
```bash
docker compose ps redis
docker compose logs redis
```

2. **Sprawdź połączenie:**
```bash
docker compose exec redis redis-cli ping
# Powinno zwrócić: PONG
```

3. **Sprawdź URL:**
```bash
echo $REDIS_URL
# Powinno być: redis://redis:6379/0
```

### Problem: Celery nie łączy się z Redis

**Objawy:**
```
consumer: Cannot connect to redis://redis:6379/0
```

**Rozwiązanie:**

1. **Restart Celery:**
```bash
docker compose restart celery
```

2. **Sprawdź logi Celery:**
```bash
docker compose logs celery
```

3. **Sprawdź kolejki:**
```bash
docker compose exec redis redis-cli keys "celery*"
```

---

## 🔄 Problemy z Celery

### Problem: Worker nie startuje

**Objawy:**
```
celery: command not found
```

**Rozwiązanie:**

1. **Sprawdź instalację:**
```bash
pip show celery
```

2. **Zainstaluj ponownie:**
```bash
pip install celery==5.4.0
```

3. **Uruchom manualnie:**
```bash
cd backend
celery -A core worker -l info -Q celery
```

### Problem: Zadania nie są wykonywane

**Objawy:** Zadania w kolejce, ale nie są przetwarzane.

**Rozwiązanie:**

1. **Sprawdź kolejkę:**
```bash
docker compose exec redis redis-cli llen celery
```

2. **Sprawdź worker status:**
```bash
celery -A core status
```

3. **Purge kolejki (ostrożnie):**
```bash
celery -A core purge
```

4. **Restart workera:**
```bash
docker compose restart celery
```

### Problem: Celery Beat nie uruchamia zadań okresowych

**Rozwiązanie:**

1. **Sprawdź bazę danych dla scheduler:**
```bash
docker compose exec db psql -U 4velo_user -d 4velo_db -c "SELECT * FROM django_celery_beat_periodictask;"
```

2. **Restart Beat:**
```bash
docker compose restart celerybeat
```

---

## 🌐 Problemy z CORS

### Problem: CORS errors w przeglądarce

**Objawy:**
```
Access to fetch at 'http://localhost:8000/api/...' from origin 'http://localhost:5173' has been blocked by CORS policy
```

**Rozwiązanie:**

1. **Sprawdź konfigurację CORS:**
```python
# backend/core/settings.py
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', '').split(',')
```

2. **Ustaw w .env:**
```bash
CORS_ALLOWED_ORIGINS=http://localhost:3001,http://localhost:5173,http://localhost:80
```

3. **Sprawdź middleware:**
```python
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # Musi być pierwszy
    ...
]
```

4. **Debug CORS headers:**
```bash
curl -v -H "Origin: http://localhost:5173" http://localhost:8000/api/
# Powinno zwrócić: Access-Control-Allow-Origin: http://localhost:5173
```

---

## 🔐 Problemy z autoryzacją

### Problem: 401 Unauthorized

**Objawy:** Wszystkie requesty zwracają 401.

**Rozwiązanie:**

1. **Sprawdź token:**
```bash
curl -X POST http://localhost:8000/api/auth/token/verify/ \
  -H "Content-Type: application/json" \
  -d '{"token": "<access_token>"}'
```

2. **Sprawdź wygaśnięcie:**
```python
# backend/core/settings.py
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
}
```

3. **Odśwież token:**
```bash
curl -X POST http://localhost:8000/api/auth/token/refresh/ \
  -H "Content-Type: application/json" \
  -d '{"refresh": "<refresh_token>"}'
```

### Problem: 403 Forbidden

**Objawy:** Zalogowany użytkownik nie ma dostępu.

**Rozwiązanie:**

1. **Sprawdź role użytkownika:**
```bash
curl http://localhost:8000/api/users/rbac/user-roles/my_roles/ \
  -H "Authorization: Bearer <token>"
```

2. **Sprawdź uprawnienia:**
```python
# W shell Django
python manage.py shell
>>> user = User.objects.get(username='test')
>>> user.get_permissions()
```

3. **Przypisz rolę:**
```python
from users.rbac_models import Role, UserRole
role = Role.objects.get(slug='tenant_admin')
UserRole.objects.create(user=user, role=role)
```

---

## 🚫 Permission Denied Errors

### Problem: "You do not have permission to perform this action"

**Rozwiązanie:**

1. **Sprawdź wymagane uprawnienie:**
```python
# W widoku
permission_classes = [HasPermission('activities.approve')]
```

2. **Sprawdź uprawnienia użytkownika:**
```bash
curl http://localhost:8000/api/users/rbac/user-roles/my_roles/ \
  -H "Authorization: Bearer <token>"
```

3. **Dodaj uprawnienie do roli:**
```python
from users.rbac_models import Role, Permission, RolePermission
role = Role.objects.get(slug='tenant_moderator')
perm = Permission.objects.get(codename='activities.approve')
RolePermission.objects.create(role=role, permission=perm)
```

---

## ⚡ Problemy z wydajnością

### Problem: Wolne odpowiedzi API

**Rozwiązanie:**

1. **Sprawdź N+1 queries:**
```python
# W settings.py (development)
LOGGING = {
    'loggers': {
        'django.db.backends': {
            'level': 'DEBUG',
        },
    },
}
```

2. **Użyj select_related/prefetch_related:**
```python
# Zamiast:
activities = Activity.objects.all()

# Użyj:
activities = Activity.objects.select_related('user', 'tenant').all()
```

3. **Sprawdź cache Redis:**
```bash
docker compose exec redis redis-cli info stats
# Sprawdź hit_rate
```

4. **Optymalizuj paginację:**
```python
# Zmniejsz page_size dla dużych zbiorów
'PAGE_SIZE': 20,
```

### Problem: Wysokie użycie pamięci

**Rozwiązanie:**

1. **Sprawdź memory usage:**
```bash
docker stats
```

2. **Ogranicz workerów Gunicorn:**
```bash
# Dockerfile lub docker-compose
command: gunicorn --workers 3 core.wsgi:application
```

3. **Optymalizuj Django:**
```python
# settings.py
CONN_MAX_AGE = 60  # Connection pooling
```

---

## 📊 Analiza logów

### Logi Django

```bash
# Docker
docker compose logs -f backend

# Railway
railway logs

# File (jeśli skonfigurowane)
tail -f /var/log/django.log
```

### Logi Celery

```bash
docker compose logs -f celery
```

### Logi bazy danych

```bash
docker compose logs -f db
```

### Logi Redis

```bash
docker compose logs -f redis
```

### Poziomy logowania

```python
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
```

### Przydatne komendy

```bash
# Szukaj błędów w logach
docker compose logs backend | grep -i error

# Szukaj 500
docker compose logs backend | grep "500"

# Szukaj wolnych zapytań
docker compose logs db | grep "duration:"

# Monitoruj logi w czasie rzeczywistym
docker compose logs -f --tail=100 backend
```

---

> **Zobacz także:** [🌐 Deployment Guide](./DEPLOYMENT.md) — wdrożenie produkcyjne  
> **Zobacz także:** [🔄 Migration Guide](./MIGRATION.md) — migracje i rollback
