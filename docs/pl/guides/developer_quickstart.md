# SZYBKI START DLA DEWELOPERA: PLATFORMA SPORT v1.0.0
> **Edycja**: Hyperscale (Post Milestone 5) | Czas do uruchomienia stosu: **~10 minut**

## 🏗 Wymagania wstępne

| Narzędzie | Minimalna Wersja | Uwaga |
|:---|:---|:---|
| Docker / Podman | 24.0+ | Obowiązkowe dla całej infrastruktury |
| Docker Compose | v2.24+ | Wymagana wersja V2 (nie `docker-compose`) |
| Node.js | v20+ | Do rozwoju `admin/` i `mobile/` |
| Python | 3.12+ | Tylko do lokalnego debugowania `backend/` |

---

## 1. Klonowanie i Inicjalizacja

```bash
git clone https://github.com/karnalooch/stunning-pancake.git sport
cd sport
cp .env.example .env
```

Wygeneruj klucz sekretny:
```bash
python -c "import secrets; print(secrets.token_hex(50))"
```
Uzupełnij `SECRET_KEY`, `POSTGRES_USER`, `POSTGRES_DB`, `DB_PASSWORD` w pliku `.env`.

---

## 2. Uruchomienie Infrastruktury

### Standardowe (Development / Staging)
```bash
docker compose up --build -d
```

### Hyperscale (Produkcja — Redis Cluster + Citus)
```bash
docker compose -f docker-compose.yml -f docker-compose.scale.yml up --build -d
```

### Przegląd Usług

| Usługa | Rola | Port |
|:---|:---|:---|
| `sport_db` | TimescaleDB + PostGIS (dev) / Koordynator Citus (prod) | 5432 |
| `sport_redis` | Redis standalone (dev) / Klaster x6 (prod) | 6379 |
| `sport_backend` | Django REST API | 8000 |
| `sport_telemetry` | Ingestia GPS w FastAPI | 8001 |
| `sport_admin` | Dashboard React (Owner OS) | 3000 |
| `sport_celery_worker` | Celery: kolejki krytyczne + powiadomienia | — |
| `sport_celery_beat` | Harmonogram Celery Beat | — |
| `sport_brouter` | Silnik routingu OSM (Anti-cheat Warstwa 3) | 17777 |
| `sport_traccar` | Odbiornik telemetrii urządzeń | 8082 |

---

## 3. Inicjalizacja Bazy Danych

```bash
# Uruchom wszystkie migracje Django
docker compose exec backend python manage.py migrate

# Utwórz superużytkownika (dostęp do panelu ownera)
docker compose exec backend python manage.py createsuperuser

# Zainicjalizuj widoki zmaterializowane (Rankingi Miast)
docker compose exec backend python manage.py shell -c \
  "from activities.tasks import refresh_city_rankings_mv; refresh_city_rankings_mv()"
```

### Tylko Hyperscale — Zastosuj Sharding Citus
Uruchom **po** podniesieniu stosu scale i zakończeniu migracji:
```bash
docker compose exec backend python manage.py shell -c \
  "from core.citus import apply_citus_sharding; apply_citus_sharding()"
```

### Tylko Hyperscale — Zastosuj PostgreSQL RLS
```bash
docker compose exec backend python manage.py shell -c \
  "from core.rls import apply_rls_policies; apply_rls_policies()"
```

---

## 4. Punkty Końcowe (Weryfikacja)

| Endpoint | Opis |
|:---|:---|
| `http://localhost:3000` | Dashboard Właściciela (Owner OS) |
| `http://localhost:8000/api/docs/` | Django REST API (Swagger UI) |
| `http://localhost:8001/api/telemetry/health` | Stan usługi telemetrii |
| `http://localhost:8000/api/infra/health/` | Status klastra Redis + Citus (tylko admin) |
| `http://localhost:8000/api/infra/health/redis/` | Topologia klastra Redis |
| `http://localhost:8000/api/infra/health/citus/` | Status węzłów i shardów Citus |

---

## 5. Przepływ Pracy (Workflow)

### Backend (Django)
```bash
# Uruchom testy anti-cheat + rankingów
docker compose exec backend python manage.py test activities

# Worker Celery (lokalnie, poza Dockerem)
celery -A core worker -Q critical,default -l info
```

### Frontend (Admin/Owner)
```bash
cd admin && npm install && npm run dev   # HMR na :5173
```

### Mobile (Expo / React Native) — Workflow "Zero Local Builds"

Od teraz aplikacja mobilna używa wyłącznie **EAS Build** (Expo Application Services) do generowania paczek natywnych. **Zero lokalnych buildów** na Twojej maszynie!

#### 💻 Uruchomienie na nowej maszynie / po formacie:
1. **Wymagania**: Upewnij się, że masz Node.js oraz zainstalowane globalnie narzędzie EAS CLI:
   ```bash
   npm install -g eas-cli
   ```
2. **Zależności**: Pobierz paczki w katalogu `mobile/` (foldery `node_modules` są w `.gitignore`, ale przepisy `package.json` i `lock` są w repozytorium):
   ```bash
   cd mobile
   npm install
   ```
3. **Logowanie do Expo**: Uruchom `eas login` i zaloguj się na swoje konto programisty.

#### 🚀 Przepływ pracy na co dzień:
* **Uruchomienie serwera deweloperskiego (Metro):**
  ```bash
  npm start
  ```
* **Budowanie nowej paczki deweloperskiej w chmurze (EAS):**
  ```bash
  npm run android   # Zleca build na Androida w EAS
  npm run ios       # Zleca build na iOS w EAS
  ```

W pliku `package.json` masz również dostęp do dedykowanych komend:
* `npm run build:dev:android` / `ios`
* `npm run build:preview:android` / `ios`
* `npm run build:prod:android` / `ios`

---

## 6. Przegląd Architektury (Pełny Potok)

```
MOBILE (RN 0.76)
  └─ GpsSyncManager v3 (adaptacja baterii, bufor MMKV)
  └─ Strefy Prywatności v2 (maskowanie na urządzeniu przed uploadem)
  └─ SentryService (raportowanie błędów z wyciętym GPS)
       │ POST /api/telemetry/ingest/batch (co 30s)
       ▼
FASTAPI :8001 (asyncpg + Redis Pipeline)
  └─ <1ms ingestii → Bufor Redis → TimescaleDB Hypertable
       │ Zadanie Celery: process_activity
       ▼
POTOK ANTI-CHEAT (Kolejka Celery `critical`)
  ├─ Warstwa 1:   Szybka Bramka Selekcji (matematyka O(N), ~0.5ms)
  ├─ Warstwa 1.5: ML IsolationForest (8 cech, ~5ms)
  ├─ Warstwa 2:   V-max Biomechanical Check (~1ms)
  ├─ Warstwa 3:   Topologiczne Viterbi w BRouter (~200ms)
  └─ Warstwa 4:   Sync Rankingów + Przyznanie Punktów
       │
       ▼
KLASTER REDIS (3 mastery + 3 repliki)
  └─ Sorted Sets: rankingi w czasie rzeczywistym dla 200 miast
       │
       ▼
CITUS POSTGRESQL (1 koordynator + 3 workerów)
  └─ 32 shardy na tabelę, kolokacja user_id, izolacja RLS
```

---

## 7. Kluczowe Zmienne Środowiskowe

| Zmienna | Cel | Domyślnie |
|:---|:---|:---|
| `SECRET_KEY` | Sekret Django | Wymagane |
| `DATABASE_URL` | Połączenie PostgreSQL | Wymagane |
| `REDIS_URL` | Pojedynczy Redis (dev) | `redis://redis:6379/0` |
| `REDIS_CLUSTER_NODES` | Węzły klastra (prod) | Puste = standalone |
| `SENTRY_DSN` | Śledzenie błędów | Puste = wyłączone |
| `STRIPE_SECRET_KEY` | Płatności | Puste = tryb mock |
| `ML_MODEL_PATH` | Model anti-cheat | `/app/models/anomaly_detector.pkl` |
| `ML_ANOMALY_THRESHOLD` | Próg odrzucenia | `-0.15` |

Pełna referencja: zobacz `.env.example`
