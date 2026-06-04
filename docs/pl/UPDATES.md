# 📈 Updates Guide — Przewodnik Aktualizacji


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | pl |
| **translation** | [English](en/UPDATES.md) |
| **canonical_path** | docs/pl/UPDATES.md |

---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Tech Lead |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Deweloperzy |

Przewodnik aktualizacji platformy 4VELO — aktualizacja zależności, migracje, obrazy Docker i changelog.

**Powiązane:** [CHANGELOG](../../CHANGELOG.md) · [MIGRATION.md](./MIGRATION.md)

---

## 📦 Aktualizacja zależności Python

### Backend (Django)

#### Sprawdzenie aktualnych wersji

```bash
cd backend
pip list --outdated
```

#### Aktualizacja pojedynczej zależności

```bash
pip install --upgrade django
pip install --upgrade djangorestframework
pip install --upgrade celery
```

#### Aktualizacja wszystkich zależności

```bash
# Zaktualizuj requirements.txt
pip install --upgrade -r requirements.txt

# Lub użyj pip-tools
pip-compile requirements.in --upgrade
pip-sync
```

#### Weryfikacja po aktualizacji

```bash
# Uruchom testy
python run_tests.py

# Sprawdź migracje
python manage.py showmigrations

# Uruchom serwer dev
python manage.py runserver
```

### Pinned versions

W `requirements.txt` wszystkie zależności są przypięte do konkretnych wersji:

```
django==4.2.30
djangorestframework==3.15.2
celery==5.4.0
```

**Zalecenie:** Aktualizuj pojedynczo i testuj po każdej zmianie.

---

## 📦 Aktualizacja zależności Node.js

### Frontend (Admin Panel)

#### Sprawdzenie aktualnych wersji

```bash
cd admin
npm outdated
```

#### Aktualizacja zależności

```bash
# Aktualizacja w package.json
npm update

# Lub użyj npm-check-updates
npx npm-check-updates -u
npm install
```

#### Aktualizacja pojedynczej paczki

```bash
npm install react@latest
npm install @mantine/core@latest
```

#### Weryfikacja po aktualizacji

```bash
# Uruchom testy
npm run test

# Lint
npm run lint

# Type check
npm run type-check

# Build
npm run build
```

---

## 🗄️ Aktualizacja migracji

### Po aktualizacji kodu

```bash
# Sprawdź nowe migracje
python manage.py showmigrations

# Uruchom migracje
python manage.py migrate

# Sprawdź stan
python manage.py showmigrations
```

### Migracje z danymi

Jeśli aktualizacja wymaga migracji danych:

```bash
# Utwórz migrację danych
python manage.py makemigrations --empty users --name migrate_data

# Edytuj migrację
# Dodaj funkcję RunPython
```

### Weryfikacja po migracji

```bash
# Sprawdź liczbę rekordów
python manage.py shell -c "
from users.models import User
from activities.models import Activity
print(f'Users: {User.objects.count()}')
print(f'Activities: {Activity.objects.count()}')
"
```

---

## 🐳 Aktualizacja obrazów Docker

### Rebuild obrazów

```bash
# Rebuild wszystkich obrazów
docker compose build

# Rebuild konkretnego obrazu
docker compose build backend
docker compose build admin
```

### Aktualizacja bazowych obrazów

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim  # Aktualizuj do najnowszej 3.11

# admin/Dockerfile
FROM node:20-slim AS build  # Aktualizuj do najnowszej 20
```

### Push obrazów (jeśli używasz registry)

```bash
# Tagowanie
docker tag 4velo-backend registry.example.com/4velo-backend:v0.2.1
docker tag 4velo-admin registry.example.com/4velo-admin:v0.2.1

# Push
docker push registry.example.com/4velo-backend:v0.2.1
docker push registry.example.com/4velo-admin:v0.2.1
```

### Weryfikacja po aktualizacji

```bash
# Uruchom kontenery
docker compose up -d

# Sprawdź health
curl http://localhost:8000/api/infra/health/

# Sprawdź logi
docker compose logs backend
docker compose logs admin
```

---

## 🚂 Aktualizacja na Railway

### Automatyczna aktualizacja

Railway automatycznie deployuje po push na `main`:

```bash
git push origin main
```

### Ręczna aktualizacja

```bash
# Sprawdź status
railway status

# Zobacz logi
railway logs

# Redeploy
railway up
```

### Migracje po deployu

```bash
railway run python manage.py migrate
railway run python manage.py collectstatic --no-input
```

---

## 📋 Changelog Reference

### Format changeloga

Używaj formatu [Keep a Changelog](https://keepachangelog.com/):

```markdown
# Changelog

## [0.2.1] - 2026-05-15

### Added
- Nowy endpoint do ML anomaly detection

### Changed
- Zaktualizowano Django do 4.2.30

### Fixed
- Naprawiono CORS headers dla admin panel

### Security
- Wzmocniono JWT token rotation
```

### Typy zmian

| Typ | Opis |
|-----|------|
| `Added` | Nowe funkcje |
| `Changed` | Zmiany w istniejących funkcjach |
| `Deprecated` | Funkcje do usunięcia w przyszłości |
| `Removed` | Usunięte funkcje |
| `Fixed` | Naprawione błędy |
| `Security` | Zmiany bezpieczeństwa |

### Wersjonowanie (SemVer)

Format: `MAJOR.MINOR.PATCH`

| Typ | Opis | Przykład |
|-----|------|----------|
| MAJOR | Breaking changes | 1.0.0 → 2.0.0 |
| MINOR | Nowe funkcje (backward compatible) | 0.1.0 → 0.2.0 |
| PATCH | Bugfixy | 0.2.0 → 0.2.1 |

---

## 🔄 Process aktualizacji — checklist

### Przed aktualizacją

- [ ] Backup bazy danych
- [ ] Backup plików media
- [ ] Sprawdź changelog zależności
- [ ] Uruchom testy lokalnie
- [ ] Stwórz branch feature

### Podczas aktualizacji

- [ ] Zaktualizuj zależności
- [ ] Uruchom testy
- [ ] Zaktualizuj migracje
- [ ] Zaktualizuj dokumentację
- [ ] Commituj zmiany

### Po aktualizacji

- [ ] Push na main
- [ ] Deploy na staging
- [ ] Weryfikacja na staging
- [ ] Deploy na production
- [ ] Weryfikacja na production
- [ ] Monitoruj logi (Sentry)
- [ ] Powiadom zespół

---

## 🚨 Rollback po aktualizacji

### Python

```bash
# Cofnij do poprzedniej wersji
pip install django==4.2.29
pip install -r requirements.txt
```

### Node.js

```bash
# Cofnij do poprzedniej wersji
npm install react@18.2.0
```

### Docker

```bash
# Użyj poprzedniego obrazu
docker compose down
docker tag registry.example.com/4velo-backend:v0.2.0 4velo-backend:latest
docker compose up -d
```

### Railway

1. W Railway Dashboard przejdź do **Deployments**
2. Znajdź poprzednią wersję
3. Kliknij **"Redeploy"**

---

## Aktualizacja dokumentacji

Po zmianach w symulatorze, BRouter lub Live Map zaktualizuj:

1. [operations/SIMULATOR.md](./operations/SIMULATOR.md) lub [operations/BROUTER.md](./operations/BROUTER.md)
2. [MAINTENANCE.md](./MAINTENANCE.md) — data przeglądu
3. [docs/README.md](./README.md) — jeśli dodajesz nowy plik
4. [CHANGELOG](../../CHANGELOG.md) — sekcja Unreleased / wydanie

---

> **Zobacz także:** [🔄 Migration Guide](./MIGRATION.md) — migracje i rollback  
> **Zobacz także:** [🌐 Deployment Guide](./DEPLOYMENT.md) — wdrożenie produkcyjne  
> **Zobacz także:** [📦 CHANGELOG](../../CHANGELOG.md) — historia zmian  
> **Zobacz także:** [MAINTENANCE.md](./MAINTENANCE.md) — inwentarz dokumentacji
