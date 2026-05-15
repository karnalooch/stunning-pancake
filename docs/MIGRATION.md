# 🔄 Migration Guide — Przewodnik Migracji

Przewodnik migracji bazy danych, migracji RBAC, strategii zero-downtime deployment i procedur rollback.

---

## 🗄️ Migracje bazy danych

### Django Migrations

Platforma używa Django Migrations do zarządzania schematem bazy danych.

### Podstawowe komendy

```bash
# Sprawdzenie stanu migracji
python manage.py showmigrations

# Uruchomienie wszystkich migracji
python manage.py migrate

# Migracja konkretnej aplikacji
python manage.py migrate users
python manage.py migrate activities

# Cofnięcie migracji
python manage.py migrate users 0008
python manage.py migrate activities 0005

# Fake migration (oznaczenie jako wykonane bez uruchamiania)
python manage.py migrate users 0009 --fake

# Migracja do konkretnego stanu
python manage.py migrate users zero  # cofnięcie wszystkich
```

### Tworzenie nowych migracji

```bash
# Po zmianie w models.py
python manage.py makemigrations

# Dla konkretnej aplikacji
python manage.py makemigrations users
python manage.py makemigrations activities

# Z nazwą migracji
python manage.py makemigrations users --name add_custom_field

# Sprawdzenie SQL migracji
python manage.py sqlmigrate users 0010
```

### Struktura migracji

```
backend/users/migrations/
├── 0001_initial.py          # Pierwsze modele
├── 0002_...py               # Kolejne zmiany
├── ...
├── 0009_rbac_models.py      # Modele RBAC
├── 0010_seed_rbac_data.py   # Dane RBAC
├── 0011_migrate_legacy_roles.py  # Migracja legacy → RBAC
└── __init__.py
```

---

## 🛡️ Migracja RBAC (Legacy → Nowy system)

### Przegląd

System RBAC został zaprojektowany jako hybrydowy — nowy system z granularnymi uprawnieniami działa równolegle z legacy systemem opartym na polu `User.role`.

### Kroki migracji

#### Krok 1: Seedowanie systemu RBAC

```bash
# Utworzenie ról, uprawnień i relacji
python manage.py seed_rbac
```

To tworzy:
- 5 systemowych ról (`global_owner`, `tenant_admin`, `tenant_moderator`, `sponsor`, `athlete`)
- Wszystkie uprawnienia (`activities.view`, `users.create`, itp.)
- Relacje rola-uprawnienie

#### Krok 2: Migracja legacy roles

```bash
# Konwersja legacy User.role → UserRole assignments
python manage.py migrate_legacy_roles
```

To tworzy:
- `UserRole` dla każdego użytkownika na podstawie legacy `User.role`
- Zachowuje tenant scoping
- Zachowuje istniejące uprawnienia

#### Krok 3: Weryfikacja

```bash
# Sprawdzenie przypisań ról
python manage.py shell
>>> from users.rbac_models import UserRole
>>> UserRole.objects.count()  # Powinno być > 0
>>> from users.models import User
>>> user = User.objects.first()
>>> user.get_permissions()  # Powinno zwrócić uprawnienia
```

### Fallback legacy

Jeśli nowy system RBAC nie zwraca uprawnień, system używa legacy mapping:

```python
# users/permissions.py - _legacy_check()
role_perms = {
    'GLOBAL_OWNER': True,
    'TENANT_ADMIN': ['activities.view', 'activities.create', ...],
    'TENANT_MODERATOR': ['activities.view', 'activities.approve', ...],
    'SPONSOR': ['activities.view', 'poi.view', ...],
    'ATHLETE': ['activities.view', 'activities.create', ...],
}
```

---

## 🚀 Zero-Downtime Deployment Strategy

### Strategia

```
┌─────────────────────────────────────────────────────────────┐
│              ZERO-DOWNTIME DEPLOYMENT                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Deploy new code (backward compatible)                  │
│  2. Run migrations (additive only)                         │
│  3. Switch traffic to new version                          │
│  4. Remove old code (next deploy)                          │
│                                                             │
│  ZASADY:                                                    │
│  - Nigdy nie usuwaj kolumn w tym samym deployu             │
│  - Dodawaj kolumny z DEFAULT/NULL                          │
│  - Zmieniaj nazwy przez: ADD new → MIGRATE data → DROP old │
│  - Używaj feature flags dla breaking changes               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Krok po kroku

#### Faza 1: Przygotowanie

```bash
# 1. Stwórz branch feature
git checkout -b feature/new-migration

# 2. Dodaj nowe pole (nullable lub z default)
# models.py
class User(models.Model):
    new_field = models.CharField(max_length=100, null=True, blank=True)
```

#### Faza 2: Deploy kodu

```bash
# 1. Push na main
git push origin main

# 2. Railway automatycznie deployuje
# Lub ręcznie:
railway up
```

#### Faza 3: Migracje

```bash
# Uruchom migracje (backward compatible)
railway run python manage.py migrate
```

#### Faza 4: Weryfikacja

```bash
# Sprawdź health
curl https://<domena>/api/infra/health/

# Sprawdź logi
railway logs
```

#### Faza 5: Cleanup (następny deploy)

```bash
# Usuń legacy code
# models.py - usuń old_field

# Usuń kolumnę (opcjonalnie)
python manage.py makemigrations
python manage.py migrate
```

### Przykład: Zmiana nazwy kolumny

```python
# Faza 1: Dodaj nową kolumnę
class User(models.Model):
    old_name = models.CharField(max_length=100)  # legacy
    new_name = models.CharField(max_length=100, null=True)  # new

# Faza 2: Migracja danych
def migrate_data(apps, schema_editor):
    User = apps.get_model('users', 'User')
    for user in User.objects.all():
        user.new_name = user.old_name
        user.save()

# Faza 3: Usuń starą kolumnę (następny deploy)
class User(models.Model):
    new_name = models.CharField(max_length=100)  # only new
```

---

## ↩️ Procedury Rollback

### Rollback migracji

```bash
# Cofnij ostatnią migrację
python manage.py migrate users 0010  # cofnij do 0010

# Cofnij wszystkie migracje aplikacji
python manage.py migrate users zero

# Fake rollback (tylko oznaczenie)
python manage.py migrate users 0010 --fake
```

### Rollback kodu (Railway)

1. W Railway Dashboard przejdź do **Deployments**
2. Znajdź poprzednią wersję
3. Kliknij **"Redeploy"**

### Rollback kodu (Git)

```bash
# Sprawdź historię commitów
git log --oneline -10

# Cofnij do poprzedniego commita
git revert <commit-hash>

# Lub reset (uwaga: niszczy historię)
git reset --hard <commit-hash>
git push --force
```

### Rollback bazy danych

```bash
# Restore z backupu
railway run pg_restore -d 4velo_db --clean --if-exists backup.dump

# Lub przez Docker
docker compose exec -T db pg_restore -U 4velo_user -d 4velo_db < backup.dump
```

### Rollback plan — checklist

- [ ] Zidentyfikuj problem (logi, Sentry, health check)
- [ ] Zatrzymaj deployment (jeśli w trakcie)
- [ ] Cofnij migracje (jeśli dotyczy)
- [ ] Redeploy poprzedniej wersji
- [ ] Przywróć backup bazy (jeśli konieczne)
- [ ] Zweryfikuj działanie
- [ ] Powiadom zespół

---

## 📊 Monitorowanie migracji

### Przed migracją

```bash
# Backup bazy
railway run pg_dump -Fc 4velo_db > backup_$(date +%Y%m%d_%H%M%S).dump

# Sprawdź stan migracji
railway run python manage.py showmigrations

# Sprawdź liczbę rekordów
railway run python manage.py shell -c "
from users.models import User
from activities.models import Activity
print(f'Users: {User.objects.count()}')
print(f'Activities: {Activity.objects.count()}')
"
```

### Po migracji

```bash
# Sprawdź stan migracji
railway run python manage.py showmigrations

# Weryfikacja danych
railway run python manage.py shell -c "
from users.rbac_models import UserRole
print(f'UserRole assignments: {UserRole.objects.count()}')
"

# Health check
curl https://<domena>/api/infra/health/
```

---

> **Zobacz także:** [🌐 Deployment Guide](./DEPLOYMENT.md) — wdrożenie produkcyjne  
> **Zobacz także:** [🔍 Troubleshooting](./TROUBLESHOOTING.md) — rozwiązywanie problemów
