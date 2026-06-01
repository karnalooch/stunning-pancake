# 🏁 Getting Started — Przewodnik Szybkiego Startu

Uruchom platformę 4VELO w 15 minut.

---

## 📋 Wymagania wstępne

### Wymagane oprogramowanie

| Narzędzie | Wersja | Opis |
|-----------|--------|------|
| [Python](https://www.python.org/downloads/) | 3.11+ | Backend (Django) |
| [Node.js](https://nodejs.org/) | 18+ | Frontend (Admin Panel) |
| [Docker](https://www.docker.com/) | 20.10+ | Konteneryzacja |
| [Docker Compose](https://docs.docker.com/compose/) | 2.0+ | Orkiestracja kontenerów |

### Opcjonalne

| Narzędzie | Wersja | Opis |
|-----------|--------|------|
| [PostgreSQL](https://www.postgresql.org/) | 15+ | Lokalna baza danych (zamiast Docker) |
| [Redis](https://redis.io/) | 7+ | Lokalny cache (zamiast Docker) |
| [Git](https://git-scm.com/) | 2.30+ | Kontrola wersji |

---

## 🚀 Opcja 1: Docker Compose (Zalecane)

Najszybszy sposób na uruchomienie pełnego stacku.

### Krok 1: Klonowanie repozytorium

```bash
git clone https://github.com/your-org/4velo.git
cd 4velo
```

### Krok 2: Konfiguracja środowiska

```bash
# Skopiuj plik konfiguracyjny
cp .env.example .env

# Wygeneruj bezpieczny SECRET_KEY
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(50))" >> .env
```

### Krok 3: Uruchomienie

```bash
# Windows PowerShell
.\dev.ps1

# Lub bezpośrednio Docker Compose
docker compose up -d
```

### Krok 4: Weryfikacja

Usługa | URL | Status
-------|-----|-------
Backend API | http://localhost:8000 | ✅
Global Admin | http://localhost:3001 | ✅
Tenant Admin | http://localhost:3002 | ✅
Moderator | http://localhost:3003 | ✅
Telemetry | http://localhost:8001 | ✅
PostgreSQL | localhost:5432 | ✅
Redis | localhost:6379 | ✅
Swagger Docs | http://localhost:8000/api/docs/ | ✅
BRouter | http://localhost:17777/brouter | ✅ (Compose) |
Celery simulation | kolejka `simulation` | ✅ (`celery_worker_simulation`) |

### Symulator / Live Map (opcjonalnie)

Do testów obciążeniowych z panelu admin (batch użytkowników + mapa na żywo):

1. Upewnij się, że działają `brouter` i `celery_worker_simulation` (`docker compose ps`).
2. Zaloguj się jako admin → **Simulator** — najpierw batch, potem live (UI czeka na koniec batcha).
3. Runbook: [operations/SIMULATOR.md](./operations/SIMULATOR.md).

---

## 🚀 Opcja 2: Railway (Cloud)

Szybkie wdrożenie w chmurze bez konfiguracji infrastruktury.

### Krok 1: Konto Railway

1. Zarejestruj się na [railway.app](https://railway.app)
2. Połącz konto GitHub

### Krok 2: Deploy

1. Kliknij przycisk "Deploy from GitHub" w Railway
2. Wybierz repozytorium 4VELO
3. Railway automatycznie wykryje `railway.json` i skonfiguruje usługę

### Krok 3: Zmienne środowiskowe

W panelu Railway → Backend → Variables dodaj:

```
SECRET_KEY=<wygenerowany-klucz>
DATABASE_URL=<URL-bazy-Railway>
REDIS_URL=<URL-Redis-Railway>
```

### Krok 4: Migracje

```bash
# Przez Railway Shell
railway run python manage.py migrate
railway run python manage.py create_admin
railway run python manage.py seed_data
```

---

## 🔐 Pierwsze logowanie

### Dane domyślnego administratora

Po uruchomieniu z seed data:

| Pole | Wartość |
|------|---------|
| Username | `global_owner` |
| Password | `admin123` |
| Rola | `GLOBAL_OWNER` |

### Zmiana hasła

1. Zaloguj się do panelu admina
2. Przejdź do Settings → Change Password
3. Lub przez API:

```bash
curl -X POST http://localhost:8000/api/users/password/change/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"old_password": "admin123", "new_password": "nowe_bezpieczne_haslo"}'
```

---

## ✅ Co dalej?

Po pierwszym uruchomieniu:

1. **📖 Przeczytaj [Architecture](./ARCHITECTURE.md)** — zrozum architekturę systemu
2. **⚙️ Skonfiguruj [Configuration](./CONFIGURATION.md)** — dostosuj zmienne środowiskowe
3. **🛡️ Zapoznaj się z [RBAC](./RBAC.md)** — naucz się zarządzać uprawnieniami
4. **📡 Sprawdź [API Reference](./API.md)** — endpointy, w tym admin symulator (§ Admin)
5. **🚂 Load test:** [operations/](./operations/) — Railway worker + BRouter
6. **🧪 Uruchom testy** — zweryfikuj poprawność instalacji:

```bash
cd backend
python run_tests.py
```

---

## 🆘 Potrzebujesz pomocy?

- [🔍 Troubleshooting](./TROUBLESHOOTING.md) — rozwiązywanie typowych problemów
- [📦 Installation Guide](./INSTALLATION.md) — szczegółowa instrukcja instalacji
- [💻 Development Guide](./DEVELOPMENT.md) — praca z kodem
