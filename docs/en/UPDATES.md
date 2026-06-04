# Document

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../UPDATES.md) |
| **canonical_path** | docs/en/UPDATES.md |
---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Tech Lead |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Developers |

4VELO platform upgrade guide - dependency updates, migrations, Docker images and changelog.

**Related:** [CHANGELOG](../../CHANGELOG.md) · [MIGRATION.md](./MIGRATION.md)

---

## 📦 Python dependencies update

### Backend (Django)

#### Check for current versions```bash
cd backend
pip list --outdated
```#### Single dependency update```bash
pip install --upgrade django
pip install --upgrade djangorestframework
pip install --upgrade celery
```#### Update all dependencies```bash
# Zaktualizuj requirements.txt
pip install --upgrade -r requirements.txt

# Lub użyj pip-tools
pip-compile requirements.in --upgrade
pip-sync
```#### Verification after update```bash
# Uruchom testy
python run_tests.py

# Sprawdź migracje
python manage.py showmigrations

# Uruchom serwer dev
python manage.py runserver
```### Pinned versions

In `requirements.txt` all dependencies are pinned to specific versions:```
django==4.2.30
djangorestframework==3.15.2
celery==5.4.0
```**Recommendation:** Update one at a time and test after each change.

---

## 📦 Node.js dependencies update

### Frontend (Admin Panel)

#### Check for current versions```bash
cd admin
npm outdated
```#### Dependency update```bash
# Aktualizacja w package.json
npm update

# Lub użyj npm-check-updates
npx npm-check-updates -u
npm install
```#### Single package update```bash
npm install react@latest
npm install @mantine/core@latest
```#### Verification after update```bash
# Uruchom testy
npm run test

# Lint
npm run lint

# Type check
npm run type-check

# Build
npm run build
```---

## 🗄️ Migration update

### After code update```bash
# Sprawdź nowe migracje
python manage.py showmigrations

# Uruchom migracje
python manage.py migrate

# Sprawdź stan
python manage.py showmigrations
```### Data migrations

If the update requires data migration:```bash
# Utwórz migrację danych
python manage.py makemigrations --empty users --name migrate_data

# Edytuj migrację
# Dodaj funkcję RunPython
```### Post-migration verification```bash
# Sprawdź liczbę rekordów
python manage.py shell -c "
from users.models import User
from activities.models import Activity
print(f'Users: {User.objects.count()}')
print(f'Activities: {Activity.objects.count()}')
"
```---

## 🐳 Docker images update

### Rebuild images```bash
# Rebuild wszystkich obrazów
docker compose build

# Rebuild konkretnego obrazu
docker compose build backend
docker compose build admin
```### Update base images```dockerfile
# backend/Dockerfile
FROM python:3.11-slim  # Aktualizuj do najnowszej 3.11

# admin/Dockerfile
FROM node:20-slim AS build  # Aktualizuj do najnowszej 20
```### Push images (if using registry)```bash
# Tagowanie
docker tag 4velo-backend registry.example.com/4velo-backend:v0.2.1
docker tag 4velo-admin registry.example.com/4velo-admin:v0.2.1

# Push
docker push registry.example.com/4velo-backend:v0.2.1
docker push registry.example.com/4velo-admin:v0.2.1
```### Verification after update```bash
# Uruchom kontenery
docker compose up -d

# Sprawdź health
curl http://localhost:8000/api/infra/health/

# Sprawdź logi
docker compose logs backend
docker compose logs admin
```---

## 🚂 Update on Railway

### Automatic update

Railway automatically deploys after push to `main`:```bash
git push origin main
```### Manual update```bash
# Sprawdź status
railway status

# Zobacz logi
railway logs

# Redeploy
railway up
```### Migrations after deployment```bash
railway run python manage.py migrate
railway run python manage.py collectstatic --no-input
```---

## 📋 Changelog Reference

### Changelog format

Use the [Keep a Changelog](https://keepachangelog.com/) format:```markdown
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
```### Types of changes

| Type | Description |
|-----|------|
| `Added` | New features |
| `Changed` | Changes to existing features |
| `Deprecated` | Features to be removed in the future |
| `Removed` | Removed features |
| `Fixed` | Fixed bugs |
| `Security` | Security changes |

### Versioning (SemVer)

Format: `MAJOR.MINOR.PATCH`

| Type | Description | Example |
|-----|------|----------|
| MAJOR | Breaking changes | 1.0.0 → 2.0.0 |
| MINOR | New features (backward compatible) | 0.1.0 → 0.2.0 |
| PATCH | Bugfixes | 0.2.0 → 0.2.1 |

---

## 🔄 Update process - checklist

### Before the update

- [ ] Database backup
- [ ] Backup media files
- [ ] Check the dependency changelog
- [ ] Run tests locally
- [ ] Create a branch feature

### While updating

- [ ] Update dependencies
- [ ] Run tests
- [ ] Update migrations
- [ ] Update documentation
- [ ] Commit changes

### After updating

- [ ] Push to main
- [ ] Deploy for staging
- [ ] Verification for staging
- [ ] Deploy to production
- [ ] Verification on production
- [ ] Monitor logs (Sentry)
- [ ] Notify the team

---

## 🚨 Rollback after update

###Python```bash
# Cofnij do poprzedniej wersji
pip install django==4.2.29
pip install -r requirements.txt
```### Node.js```bash
# Cofnij do poprzedniej wersji
npm install react@18.2.0
```### Docker```bash
# Użyj poprzedniego obrazu
docker compose down
docker tag registry.example.com/4velo-backend:v0.2.0 4velo-backend:latest
docker compose up -d
```### Railway

1. In Railway Dashboard, go to **Deployments**
2. Find the previous version
3. Click **"Redeploy"**

---

## Documentation update

After changes in the simulator, BRouter or Live Map, update:

1. [operations/SIMULATOR.md](./operations/SIMULATOR.md) or [operations/BROUTER.md](./operations/BROUTER.md)
2. [MAINTENANCE.md](./MAINTENANCE.md) - Review date
3. [docs/README.md](./README.md) - if you are adding a new file
4. [CHANGELOG](../../CHANGELOG.md) - Unreleased section

---

> **See also:** [🔄 Migration Guide](./MIGRATION.md) - migrations and rollback  
> **See also:** [🌐 Deployment Guide](./DEPLOYMENT.md) - production deployment  
> **See also:** [📦 CHANGELOG](../../CHANGELOG.md) - change history  
> **See also:** [MAINTENANCE.md](./MAINTENANCE.md) - Documentation Inventory
