# Developer Quickstart — SPORT Platform v0.1.0-alpha

> Czas do uruchomienia: **~15 minut** (zakładając Docker i Git)

## Wymagania

| Narzędzie | Minimalna wersja |
|:---|:---|
| Docker / Podman | 24.0+ |
| Docker Compose | v2.24+ |
| Git | 2.40+ |

---

## 1. Klonowanie

```bash
git clone https://github.com/karnalooch/stunning-pancake.git sport
cd sport
```

---

## 2. Konfiguracja środowiska

```bash
cp .env.example .env
```

Otwórz `.env` i wypełnij **WSZYSTKIE** pola oznaczone `CHANGE_ME`:

```bash
# Generuj SECRET_KEY:
python -c "import secrets; print(secrets.token_hex(50))"

# Ustaw mocne haslo DB i wklej wynik SECRET_KEY do .env
```

> Nigdy nie commituj `.env` do repozytorium. Plik jest w .gitignore.

---

## 3. Uruchomienie stacku

```bash
docker compose up --build -d
```

Sprawdz status:

```bash
docker compose ps
```

Oczekiwane kontenery ze statusem `Up`:

```
sport_db        - TimescaleDB + PostGIS    :5432
sport_redis     - Redis 7                  :6379
sport_traccar   - Traccar 6                :8082
sport_brouter   - BRouter 1.7             :17777
sport_backend   - Django API              :8000
sport_telemetry - FastAPI Telemetry       :8001
sport_admin     - React Admin             :3000
sport_celery_worker
sport_celery_beat
```

---

## 4. Migracje i superuser

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
```

---

## 5. Weryfikacja

| Endpoint | Oczekiwana odpowiedz |
|:---|:---|
| `http://localhost:8000/api/docs/` | Swagger UI (Django REST) |
| `http://localhost:8001/api/telemetry/docs` | Swagger UI (FastAPI Telemetry) |
| `http://localhost:8001/api/telemetry/health` | `{"status": "ok"}` |
| `http://localhost:3000/` | Admin Dashboard |
| `http://localhost:8082/` | Traccar Web UI |

---

## 6. Testy

```bash
docker compose exec backend python manage.py test --verbosity=2
```

---

## Architektura w skrocie

```
Mobile GPS -> [batch 30s] -> FastAPI :8001 -> TimescaleDB
Traccar    -> [Redis pub/sub] -> FastAPI -> WebSocket -> Admin Map
Activity.finish() -> Celery -> Kalman -> Viterbi -> BRouter -> Leaderboard
```

Pelna dokumentacja: docs/constitution.md | docs/project_structure.md

---

## Rozwiazywanie problemow

**Kontener `db` nie startuje:** upewnij sie ze DB_PASSWORD, POSTGRES_USER, POSTGRES_DB sa ustawione w .env

**Backend rzuca `KeyError: DATABASE_URL`:** upewnij sie ze .env jest w glownym katalogu projektu

**Traccar nie laczy sie z DB:** sprawdz czy TRACCAR_DB_PASSWORD w .env rowna sie DB_PASSWORD
