# 🛡️ RBAC — Role-Based Access Control Guide

Kompletny przewodnik systemu kontroli dostępu opartego na rolach (RBAC) w platformie 4VELO.

---

## 📋 Przegląd systemu RBAC

Platforma 4VELO używa hybrydowego systemu uprawnień — nowego systemu RBAC z granularnymi uprawnieniami oraz legacy systemu opartego na pojedynczym polu `role` w modelu User.

### Architektura

```
┌─────────────────────────────────────────────────────────────┐
│                    RBAC SYSTEM                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  User ──(legacy)──▶ role: CharField                        │
│       ──(new)──▶ UserRole[] ──▶ Role ──▶ Permission[]      │
│                                                             │
│  Permission = {codename, resource, action}                  │
│  Role = {slug, name, permissions[], is_system}              │
│  UserRole = {user, role, tenant, expires_at, granted_by}    │
│                                                             │
│  Fallback: Jeśli RBAC nie zwraca uprawnień,                │
│  system używa legacy role → permission mapping.             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Modele danych

| Model | Plik | Opis |
|-------|------|------|
| [`Permission`](../backend/users/rbac_models.py:12) | `rbac_models.py` | Granularne uprawnienie (np. `activities.view`) |
| [`Role`](../backend/users/rbac_models.py:28) | `rbac_models.py` | Rola systemowa z zestawem uprawnień |
| [`RolePermission`](../backend/users/rbac_models.py:51) | `rbac_models.py` | Relacja rola-uprawnienie z opcjonalnym tenant scoping |
| [`UserRole`](../backend/users/rbac_models.py:64) | `rbac_models.py` | Przypisanie roli do użytkownika |

---

## 👥 Dostępne role

### Role systemowe

| Rola (slug) | Nazwa | Opis | is_system |
|-------------|-------|------|-----------|
| `global_owner` | Global Owner | Pełny dostęp do całej platformy | ✅ |
| `tenant_admin` | Tenant Admin | Administrator tenantu — zarządzanie użytkownikami, aktywnościami | ✅ |
| `tenant_moderator` | Tenant Moderator | Moderator — zatwierdzanie aktywności, podgląd | ✅ |
| `sponsor` | Sponsor | Sponsor — zarządzanie POI i voucherami | ✅ |
| `athlete` | Athlete | Sportowiec — podstawowy dostęp | ✅ |

### Legacy role (pole `User.role`)

```python
class Role(models.TextChoices):
    GLOBAL_OWNER     = 'GLOBAL_OWNER',     'Global Owner'
    TENANT_ADMIN     = 'TENANT_ADMIN',     'Tenant Admin / Owner'
    TENANT_MODERATOR = 'TENANT_MODERATOR', 'Moderator'
    ATHLETE          = 'ATHLETE',          'Athlete'
    SPONSOR          = 'SPONSOR',          'Sponsor'
```

---

## 📊 Macierz uprawnień

### Legacy permission mapping

| Uprawnienie | GLOBAL_OWNER | TENANT_ADMIN | TENANT_MODERATOR | SPONSOR | ATHLETE |
|-------------|:------------:|:------------:|:----------------:|:-------:|:-------:|
| `activities.view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `activities.create` | ✅ | ✅ | ❌ | ❌ | ✅ |
| `activities.edit` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `activities.delete` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `activities.approve` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `users.view` | ✅ | ✅ | ✅ | ❌ | ✅ |
| `users.create` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `users.edit` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `tenants.view` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `tenants.edit` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `poi.view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `poi.create` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `poi.edit` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `poi.delete` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `vouchers.create` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `vouchers.view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `analytics.view` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `analytics.export` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `users.impersonate` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `rbac.manage_roles` | ✅ | ✅ | ❌ | ❌ | ❌ |

### Zasoby i akcje

| Resource | Dostępne akcje | Opis |
|----------|---------------|------|
| `activities` | `view`, `create`, `edit`, `delete`, `approve` | Aktywności sportowe |
| `users` | `view`, `create`, `edit`, `impersonate` | Użytkownicy |
| `tenants` | `view`, `edit` | Tenanci (organizacje) |
| `poi` | `view`, `create`, `edit`, `delete` | Punkty zainteresowania |
| `vouchers` | `view`, `create` | Vouchery nagród |
| `analytics` | `view`, `export` | Analityka i raporty |
| `rbac` | `manage_roles` | Zarządzanie rolami |

---

## 🔧 Jak przypisywać role

### Przez API

```bash
# Przypisanie roli do użytkownika
POST /api/users/rbac/user-roles/
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": 42,
  "role_id": 3,
  "tenant_id": "uuid-tenant-id",
  "expires_at": "2026-12-31T23:59:59Z"
}
```

### Przez management command

```bash
# Seedowanie systemu RBAC
python manage.py seed_rbac

# Migracja legacy roles do RBAC
python manage.py migrate_legacy_roles
```

### Programistycznie

```python
from users.rbac_models import Role, UserRole

# Pobierz rolę
role = Role.objects.get(slug='tenant_admin')

# Przypisz rolę do użytkownika
UserRole.objects.create(
    user=user,
    role=role,
    tenant=user.tenant,
    granted_by=admin_user,
)
```

---

## 🎨 Jak tworzyć customowe role

### Przez API

```bash
# Utworzenie nowej roli
POST /api/users/rbac/roles/
Authorization: Bearer <token>
Content-Type: application/json

{
  "slug": "custom_role",
  "name": "Custom Role",
  "description": "Opis customowej roli",
  "permission_ids": [1, 2, 3, 5],
  "is_system": false
}
```

### Programistycznie

```python
from users.rbac_models import Role, Permission, RolePermission

# Utwórz rolę
role = Role.objects.create(
    slug='city_organizer',
    name='City Organizer',
    description='Organizator wydarzeń miejskich',
    is_system=False,
)

# Dodaj uprawnienia
permissions = Permission.objects.filter(
    resource__in=['activities', 'events', 'poi']
)
for perm in permissions:
    RolePermission.objects.create(
        role=role,
        permission=perm,
    )
```

> **Uwaga:** Role systemowe (`is_system=True`) nie mogą być usuwane.

---

## 📡 API endpoints — zarządzanie rolami

### Base URL: `/api/users/rbac/`

| Endpoint | Metoda | Opis | Wymagana rola |
|----------|--------|------|---------------|
| `/permissions/` | GET | Lista wszystkich uprawnień | Authenticated |
| `/permissions/by_resource/` | GET | Uprawnienia pogrupowane po zasobie | Authenticated |
| `/roles/` | GET | Lista wszystkich ról | GLOBAL_OWNER |
| `/roles/` | POST | Utworzenie nowej roli | GLOBAL_OWNER |
| `/roles/{id}/` | GET | Szczegóły roli | GLOBAL_OWNER |
| `/roles/{id}/` | PUT/PATCH | Edycja roli | GLOBAL_OWNER |
| `/roles/{id}/` | DELETE | Usunięcie roli | GLOBAL_OWNER |
| `/user-roles/` | GET | Lista przypisań ról | TENANT_ADMIN+ |
| `/user-roles/` | POST | Przypisanie roli | TENANT_ADMIN+ |
| `/user-roles/{id}/` | GET | Szczegóły przypisania | TENANT_ADMIN+ |
| `/user-roles/{id}/` | DELETE | Usunięcie przypisania | TENANT_ADMIN+ |
| `/user-roles/{id}/revoke/` | POST | Cofnięcie roli | TENANT_ADMIN+ |
| `/user-roles/my_roles/` | GET | Moje role (current user) | Authenticated |

### Przykłady odpowiedzi

#### GET `/permissions/by_resource/`

```json
{
  "activities": [
    {"codename": "activities.view", "action": "view", "name": "View Activities"},
    {"codename": "activities.create", "action": "create", "name": "Create Activity"},
    {"codename": "activities.approve", "action": "approve", "name": "Approve Activity"}
  ],
  "users": [
    {"codename": "users.view", "action": "view", "name": "View Users"},
    {"codename": "users.create", "action": "create", "name": "Create User"}
  ]
}
```

#### GET `/user-roles/my_roles/`

```json
[
  {
    "id": "uuid-1",
    "user": "john_doe",
    "role": {
      "id": 2,
      "slug": "tenant_admin",
      "name": "Tenant Admin",
      "permissions": [
        {"permission": {"codename": "activities.view", ...}},
        {"permission": {"codename": "users.view", ...}}
      ]
    },
    "tenant": "Warsaw",
    "expires_at": null,
    "granted_by": "admin",
    "created_at": "2026-01-15T10:00:00Z"
  }
]
```

---

## 🖥️ Frontend Permission Guards

### PermissionGuard

Komponent [`PermissionGuard`](../admin/src/core/guards/PermissionGuard.tsx:1) chroni komponenty i trasy na podstawie uprawnień.

```tsx
import { PermissionGuard } from './core/guards/PermissionGuard';

// Wymaga WSZYSTKICH uprawnień
<PermissionGuard permissions={['activities.view', 'users.view']} requireAll={true}>
  <ProtectedComponent />
</PermissionGuard>

// Wymaga DOWOLNEGO uprawnienia
<PermissionGuard permissions={['activities.edit', 'activities.delete']} requireAll={false}>
  <EditOrDeleteButton />
</PermissionGuard>
```

### RoleGuard (deprecated)

Komponent [`RoleGuard`](../admin/src/core/guards/RoleGuard.tsx:1) jest oznaczony jako deprecated na rzecz `PermissionGuard`.

```tsx
import { RoleGuard } from './core/guards/RoleGuard';

// Ochrona trasy
<Route
  path="/admin"
  element={
    <RoleGuard allowedRoles={['GLOBAL_OWNER', 'TENANT_ADMIN']}>
      <AdminDashboard />
    </RoleGuard>
  }
/>
```

### Hook `useAuth`

Hook [`useAuth`](../admin/src/core/auth/useAuth.ts:32) dostarcza metody sprawdzania uprawnień:

```tsx
const { hasPermission, hasAnyPermission, hasRole } = useAuth();

// Sprawdzenie uprawnienia
if (hasPermission('activities.approve')) {
  // Pokaż przycisk zatwierdzania
}

// Sprawdzenie dowolnego uprawnienia
if (hasAnyPermission(['activities.edit', 'activities.delete'])) {
  // Pokaż przycisk edycji/usuwania
}

// Sprawdzenie roli
if (hasRole('global_owner')) {
  // Pokaż opcje globalne
}
```

### Stan auth (Zustand store)

```typescript
interface AuthState {
  user: User | null;
  permissions: string[];  // ['activities.view', 'users.create', ...]
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasRole: (roleSlug: string) => boolean;
}
```

---

## 🔐 Backend Permission Classes

### HasPermission

Klasa [`HasPermission`](../backend/users/permissions.py:11) sprawdza konkretne uprawnienie.

```python
from users.permissions import HasPermission

class ActivityApproveView(APIView):
    permission_classes = [HasPermission('activities.approve')]
```

### HasAnyPermission

Klasa [`HasAnyPermission`](../backend/users/permissions.py:99) sprawdza dowolne uprawnienie z listy.

```python
from users.permissions import HasAnyPermission

class ActivityEditView(APIView):
    permission_classes = [HasAnyPermission(['activities.edit', 'activities.delete'])]
```

### Legacy permission classes

| Klasa | Opis |
|-------|------|
| `IsGlobalOwner` | Tylko GLOBAL_OWNER |
| `IsTenantAdmin` | GLOBAL_OWNER + TENANT_ADMIN |
| `IsAdminOrModerator` | GLOBAL_OWNER + TENANT_ADMIN + TENANT_MODERATOR |

---

## 🔄 Fallback legacy

Jeśli system RBAC nie jest w pełni skonfigurowany, uprawnienia są wyznaczane na podstawie legacy `User.role`:

```python
# users/permissions.py - _legacy_check()
role_perms = {
    'GLOBAL_OWNER': True,  # Wszystkie uprawnienia
    'TENANT_ADMIN': ['activities.view', 'activities.create', ...],
    'TENANT_MODERATOR': ['activities.view', 'activities.approve', ...],
    'SPONSOR': ['activities.view', 'poi.view', ...],
    'ATHLETE': ['activities.view', 'activities.create', ...],
}
```

---

> **Zobacz także:** [📡 API Reference](./API.md) — endpointy RBAC  
> **Zobacz także:** [🏛️ Architecture](./ARCHITECTURE.md) — middleware RLS
