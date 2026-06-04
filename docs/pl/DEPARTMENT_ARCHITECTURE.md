# Document

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Zobacz dokument kanoniczny |
| **lang** | pl |
| **translation** | [English](../DEPARTMENT_ARCHITECTURE.md) |
| **canonical_path** | docs/pl/DEPARTMENT_ARCHITECTURE.md |
---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Product / Backend Lead |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Deweloperzy, product |

Kompletny plan dodania hierarchii "Department/Class" do wielodzierżawczej platformy SaaS 4VELO.

**Powiązane:** [RBAC.md](../RBAC.md) · [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 📋 Spis treści

1. [Diagram hierarchii](#1-diagram-hierarchii)
2. [Schemat bazy danych (ERD)](#2-schemat-bazy-danych-erd)
3. [Macierz uprawnień RBAC](#3-macierz-uprawnień-rbac)
4. [Endpointy API](#4-endpointy-api)
5. [Projekt polityk RLS](#5-projekt-polityk-rls)
6. [Strategia migracji](#6-strategia-migracji)
7. [Zmiany w frontendzie](#7-zmiany-w-frontendzie)
8. [Fazy implementacji](#8-fazy-implementacji)

---

## 1. Diagram hierarchii

### 1.1. Pełna hierarchia systemu```
┌─────────────────────────────────────────────────────────────────────────┐
│                        GLOBAL_OWNER                                     │
│              (właściciel platformy 4VELO)                               │
│         Pełny dostęp do wszystkich tenantów i departamentów             │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│     TENANT 1     │ │     TENANT 2     │ │     TENANT N     │
│   (Miasto)       │ │   (Firma)        │ │   (Szkoła)       │
├──────────────────┤ ├──────────────────┤ ├──────────────────┤
│ Tenant Admin     │ │ Tenant Admin     │ │ Tenant Admin     │
│ (Integrator)     │ │ (CEO/HR Director)│ │ (Dyrektor)       │
├──────────────────┤ ├──────────────────┤ ├──────────────────┤
│ Department       │ │ Department       │ │ Department       │
│ (Dzielnica A)    │ │ (IT)             │ │ (Klasa 4A)       │
│ ├── Moderator    │ │ ├── Moderator    │ │ ├── Moderator    │
│ │   (Organizator)│ │ │   (Team Lead)  │ │ │   (Nauczyciel) │
│ │   └── Users    │ │ │   └── Users    │ │ │   └── Users    │
│ └── Users        │ │ └── Users        │ │ └── Users        │
│                  │ │                  │ │                  │
│ Department       │ │ Department       │ │ Department       │
│ (Dzielnica B)    │ │ (HR)             │ │ (Klasa 4B)       │
│ ├── Moderator    │ │ ├── Moderator    │ │ ├── Moderator    │
│ │   └── Users    │ │ │   └── Users    │ │ │   └── Users    │
│ └── Users        │ │ └── Users        │ │ └── Users        │
│                  │ │                  │ │                  │
│ Sponsor          │ │ Sponsor          │ │ Sponsor          │
│ (Partner lokalny)│ │ (Partner firmy)  │ │ (Partner szkoły) │
│                  │ │                  │ │                  │
│ Users (bez działu)│ │ Users (bez działu)│ │ Users (bez działu)│
└──────────────────┘ └──────────────────┘ └──────────────────┘
```### 1.2. Typy tenantów i odpowiadające departamenty```
┌──────────────────┬──────────────────────────┬──────────────────────────────┐
│ Typ Tenanta      │ Typ Departamentu         │ Przykłady nazw               │
├──────────────────┼──────────────────────────┼──────────────────────────────┤
│ city             │ district                 │ "Śródmieście", "Mokotów"     │
│ company          │ department               │ "IT", "HR", "Sales", "Marketing" │
│ school           │ class                    │ "4A", "4B", "5A", "5B"       │
│ university       │ faculty                  │ "Wydział Informatyki",        │
│                  │                          │ "Wydział Mechaniczny"         │
│ ngo              │ team                     │ "Zespół Ekologiczny",         │
│                  │                          │ "Wolontariat"                 │
└──────────────────┴──────────────────────────┴──────────────────────────────┘
```### 1.3. Hierarchia departamentów (zagnieżdżanie)```
Tenant: Firma "Acme Corp"
├── Department: "IT" (parent: null)
│   ├── Department: "Backend Team" (parent: IT)
│   │   ├── Moderator: Jan Kowalski
│   │   └── Users: 5 programistów
│   ├── Department: "Frontend Team" (parent: IT)
│   │   ├── Moderator: Anna Nowak
│   │   └── Users: 3 programistów
│   └── Department: "DevOps" (parent: IT)
│       ├── Moderator: Piotr Wiśniewski
│       └── Users: 2 inżynierów
├── Department: "HR" (parent: null)
│   ├── Moderator: Maria Zielińska
│   └── Users: 4 specjalistów
└── Department: "Sales" (parent: null)
    ├── Department: "Enterprise" (parent: Sales)
    │   └── Users: 6 handlowców
    └── Department: "SMB" (parent: Sales)
        └── Users: 8 handlowców
```---

## 2. Schemat bazy danych (ERD)

### 2.1. Nowy model: `Department````
┌─────────────────────────────────────────────────────────────────────┐
│                        DEPARTMENT                                    │
├─────────────────────────────────────────────────────────────────────┤
│ id              UUID            PK       Unikalny identyfikator     │
│ name            VARCHAR(200)    NOT NULL Nazwa działu/klasy         │
│ tenant_id       UUID            FK→Tenant  Przypisanie do tenanta   │
│ parent_id       UUID            FK→self    NULL=brak rodzica         │
│ moderator_id    INT             FK→User    NULL=brak moderatora      │
│ department_type VARCHAR(50)     NOT NULL 'department','class',...    │
│ description     TEXT            NOT NULL Opis (opcjonalny)          │
│ is_active       BOOLEAN         DEFAULT True                        │
│ created_at      TIMESTAMP       AUTO_NOW_ADD                        │
│ updated_at      TIMESTAMP       AUTO_NOW                            │
├─────────────────────────────────────────────────────────────────────┤
│ UNIQUE: (tenant_id, name)                                           │
│ INDEX: tenant_id, parent_id, moderator_id, department_type          │
└─────────────────────────────────────────────────────────────────────┘
```### 2.2. Relacja User-Department (ManyToMany)```
┌─────────────────────────────────────────────────────────────────────┐
│                       USERDEPARTMENT                                 │
│              (Through model — przypisanie użytkownika)               │
├─────────────────────────────────────────────────────────────────────┤
│ id              UUID            PK                                  │
│ user_id         INT             FK→User                             │
│ department_id   UUID            FK→Department                       │
│ role_in_dept    VARCHAR(50)     DEFAULT 'member'  'member','lead'   │
│ joined_at       TIMESTAMP       AUTO_NOW_ADD                        │
├─────────────────────────────────────────────────────────────────────┤
│ UNIQUE: (user_id, department_id)                                    │
│ INDEX: user_id, department_id                                       │
└─────────────────────────────────────────────────────────────────────┘
```### 2.3. Pełny ERD z relacjami```
┌──────────┐       1:N        ┌─────────────┐       1:N        ┌──────────────┐
│  Tenant  │─────────────────▶│ Department  │◀──────────────────│ UserDepartment│
└──────────┘                  └──────┬──────┘                  └──────┬───────┘
                                     │ 1:N                            │ N:1
                                     │ self-ref (parent)              │
                                     ▼                                │
                              ┌─────────────┐                        │
                              │ Department  │                        │
                              │  (child)    │                        │
                              └─────────────┘                        │
                                                                     │
┌──────────┐       1:N        ┌─────────────┐       N:M             │
│  Tenant  │─────────────────▶│    User     │◀───────────────────────┘
└──────────┘                  └──────┬──────┘
                                     │ 1:N
                                     ▼
                              ┌─────────────┐
                              │  UserRole   │
                              └─────────────┘

┌──────────┐       1:N        ┌─────────────┐
│  User    │─────────────────▶│  Activity   │
└──────────┘                  └──────┬──────┘
                                     │
                                     ▼ (nowe pole: department_id)
                              ┌─────────────┐
                              │  Activity   │
                              │ (rozszerzony)│
                              └─────────────┘
```### 2.4. Rozszerzenie modelu Activity (opcjonalne)```
┌─────────────────────────────────────────────────────────────────────┐
│                       ACTIVITY (rozszerzenie)                        │
├─────────────────────────────────────────────────────────────────────┤
│ ... (istniejące pola)                                               │
│ department_id   UUID            FK→Department  NULL=bez departamentu │
├─────────────────────────────────────────────────────────────────────┤
│ INDEX: department_id, tenant_id, department_id                      │
└─────────────────────────────────────────────────────────────────────┘
```> **Uwaga:** Pole `department_id` w Activity jest opcjonalne. Można je dodać, jeśli potrzebne są rankingi i analityka na poziomie departamentów. Alternatywnie, departament użytkownika można wyznaczyć przez relację User→UserDepartment.

---

## 3. Macierz uprawnień RBAC

### 3.1. Nowe uprawnienia departamentowe```
┌──────────────────────────────┬──────────────┬────────────────────────────────────┐
│ Codename                     │ Resource     │ Opis                               │
├──────────────────────────────┼──────────────┼────────────────────────────────────┤
│ departments.view             │ departments  │ Podgląd listy departamentów        │
│ departments.create           │ departments  │ Tworzenie nowego departamentu      │
│ departments.edit             │ departments  │ Edycja departamentu                │
│ departments.delete           │ departments  │ Usuwanie departamentu              │
│ departments.view_users       │ departments  │ Podgląd użytkowników w departamencie│
│ departments.assign_users     │ departments  │ Przypisywanie użytkowników         │
│ departments.remove_users     │ departments  │ Usuwanie użytkowników z depart.    │
│ departments.view_activities  │ departments  │ Podgląd aktywności departamentu    │
│ departments.view_analytics   │ departments  │ Analityka departamentu             │
└──────────────────────────────┴──────────────┴────────────────────────────────────┘
```### 3.2. Zaktualizowana macierz uprawnień```
┌──────────────────────────────┬────────────┬──────────────┬──────────────────┬─────────┬─────────┐
│ Uprawnienie                  │ Global     │ Tenant       │ Dept. Moderator  │ Sponsor │ Athlete │
│                              │ Owner      │ Admin        │                  │         │         │
├──────────────────────────────┼────────────┼──────────────┼──────────────────┼─────────┼─────────┤
│ departments.view             │ ✅ WSZYSTKIE│ ✅ WSZYSTKIE │ ✅ SWÓJ          │ ❌      │ ❌      │
│ departments.create           │ ✅         │ ✅           │ ❌               │ ❌      │ ❌      │
│ departments.edit             │ ✅         │ ✅           │ ✅ SWÓJ          │ ❌      │ ❌      │
│ departments.delete           │ ✅         │ ✅           │ ❌               │ ❌      │ ❌      │
│ departments.view_users       │ ✅ WSZYSTKIE│ ✅ WSZYSTKIE │ ✅ SWÓJ          │ ❌      │ ❌      │
│ departments.assign_users     │ ✅         │ ✅           │ ✅ SWÓJ          │ ❌      │ ❌      │
│ departments.remove_users     │ ✅         │ ✅           │ ✅ SWÓJ          │ ❌      │ ❌      │
│ departments.view_activities  │ ✅ WSZYSTKIE│ ✅ WSZYSTKIE │ ✅ SWÓJ          │ ❌      │ ❌      │
│ departments.view_analytics   │ ✅ WSZYSTKIE│ ✅ WSZYSTKIE │ ✅ SWÓJ          │ ❌      │ ❌      │
├──────────────────────────────┼────────────┼──────────────┼──────────────────┼─────────┼─────────┤
│ activities.view              │ ✅         │ ✅           │ ✅ SWÓJ          │ ✅      │ ✅      │
│ activities.approve           │ ✅         │ ✅           │ ✅ SWÓJ          │ ❌      │ ❌      │
│ users.view                   │ ✅         │ ✅           │ ✅ SWÓJ          │ ❌      │ ✅      │
│ users.create                 │ ✅         │ ✅           │ ✅ SWÓJ          │ ❌      │ ❌      │
│ users.edit                   │ ✅         │ ✅           │ ✅ SWÓJ          │ ❌      │ ❌      │
│ analytics.view               │ ✅         │ ✅           │ ✅ SWÓJ          │ ✅      │ ❌      │
│ analytics.export             │ ✅         │ ✅           │ ❌               │ ❌      │ ❌      │
└──────────────────────────────┴────────────┴──────────────┴──────────────────┴─────────┴─────────┘

Legenda:
  ✅ WSZYSTKIE = widzi wszystkie departamenty w systemie/tenancie
  ✅ SWÓJ    = widzi tylko dane swojego departamentu
  ✅         = standardowe uprawnienie (bez scope'u departamentu)
```### 3.3. Nowa rola systemowa: `department_moderator````python
class Role(models.Model):
    SLUG_CHOICES = [
        ('global_owner', 'Global Owner'),
        ('tenant_admin', 'Tenant Admin'),
        ('department_moderator', 'Department Moderator'),  # NOWA ROLA
        ('tenant_moderator', 'Tenant Moderator'),
        ('sponsor', 'Sponsor'),
        ('athlete', 'Athlete'),
    ]
```### 3.4. Uprawnienia dla roli `department_moderator````
┌──────────────────────────────┬──────────────────────────────────────────────┐
│ Uprawnienie                  │ Scope                                        │
├──────────────────────────────┼──────────────────────────────────────────────┤
│ departments.view             │ Tylko swój departament (i pod-departamenty)  │
│ departments.edit             │ Tylko swój departament                       │
│ departments.view_users       │ Tylko użytkownicy w swoim departamencie      │
│ departments.assign_users     │ Tylko przypisywanie do swojego departamentu  │
│ departments.remove_users     │ Tylko usuwanie ze swojego departamentu       │
│ departments.view_activities  │ Tylko aktywności użytkowników z departamentu │
│ departments.view_analytics   │ Tylko analityka swojego departamentu         │
│ activities.view              │ Tylko aktywności użytkowników z departamentu │
│ activities.approve           │ Tylko aktywności użytkowników z departamentu │
│ users.view                   │ Tylko użytkownicy w swoim departamencie      │
│ users.create                 │ Tylko tworzenie użytkowników w departamencie │
│ users.edit                   │ Tylko edycja użytkowników w departamencie    │
└──────────────────────────────┴──────────────────────────────────────────────┘
```---

## 4. API punktu końcowego

### 4.1. Podstawowy adres URL: `/api/users/rbac/departments/````
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ Endpoint                              │ Metoda  │ Opis                    │ Wymagana rola   │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ /api/users/rbac/departments/          │ GET     │ Lista departamentów     │ Authenticated   │
│                                       │         │ (filtrowana po roli)    │                 │
│ /api/users/rbac/departments/          │ POST    │ Utwórz departament      │ Tenant Admin+   │
│ /api/users/rbac/departments/{id}/     │ GET     │ Szczegóły departamentu  │ Authenticated   │
│ /api/users/rbac/departments/{id}/     │ PUT     │ Edytuj departament      │ Tenant Admin+   │
│ /api/users/rbac/departments/{id}/     │ PATCH   │ Częściowa edycja        │ Tenant Admin+   │
│ /api/users/rbac/departments/{id}/     │ DELETE  │ Usuń departament        │ Tenant Admin+   │
│                                       │         │ lub Dept. Moderator*    │                 │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ /api/users/rbac/departments/{id}/users/          │ GET  │ Lista użytkowników w departamencie │
│ /api/users/rbac/departments/{id}/assign/         │ POST │ Przypisz użytkownika do depart.   │
│ /api/users/rbac/departments/{id}/remove/         │ POST │ Usuń użytkownika z departamentu   │
│ /api/users/rbac/departments/{id}/activities/     │ GET  │ Aktywności użytkowników depart.   │
│ /api/users/rbac/departments/{id}/analytics/      │ GET  │ Analityka departamentu            │
│ /api/users/rbac/departments/{id}/leaderboard/    │ GET  │ Ranking departamentu              │
│ /api/users/rbac/departments/tree/                │ GET  │ Drzewo departamentów (hierarchia) │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ /api/users/rbac/departments/my/                    │ GET  │ Moje departamenty (current user) │
│ /api/users/rbac/departments/{id}/moderator/        │ PUT  │ Ustaw moderatora departamentu   │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

* Dept. Moderator może usunąć TYLKO pusty departament bez użytkowników.
```### 4.2. Parametry zapytań dla GET `/departments/````
┌──────────────────┬──────────────┬──────────────────────────────────────────────┐
│ Parametr         │ Typ          │ Opis                                         │
├──────────────────┼──────────────┼──────────────────────────────────────────────┤
│ tenant_id        │ UUID         │ Filtruj po tenancie (Tenant Admin+)          │
│ department_type  │ string       │ Filtruj po typie: 'department','class',...   │
│ is_active        │ boolean      │ Filtruj po statusie aktywności               │
│ parent_id        │ UUID         │ Filtruj po departamencie rodzica             │
│ search           │ string       │ Wyszukiwanie po nazwie                       │
│ include_inactive │ boolean      │ Czy uwzględniać nieaktywne (domyślnie false) │
└──────────────────┴──────────────┴──────────────────────────────────────────────┘
```### 4.3. Przykłady request/response

#### POST `/api/users/rbac/departments/` — Tworzenie departamentu```json
// Request
{
  "name": "Dział IT",
  "department_type": "department",
  "parent_id": null,
  "moderator_id": 42,
  "description": "Zespół odpowiedzialny za infrastrukturę IT"
}

// Response 201 Created
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Dział IT",
  "tenant": {
    "id": "tenant-uuid",
    "name": "Acme Corp"
  },
  "parent": null,
  "moderator": {
    "id": 42,
    "username": "jan_kowalski"
  },
  "department_type": "department",
  "description": "Zespół odpowiedzialny za infrastrukturę IT",
  "is_active": true,
  "user_count": 0,
  "created_at": "2026-05-15T18:00:00Z"
}
```#### POST `/api/users/rbac/departments/{id}/assign/` — Przypisanie użytkownika```json
// Request
{
  "user_id": 15,
  "role_in_dept": "member"
}

// Response 200 OK
{
  "status": "assigned",
  "user": {
    "id": 15,
    "username": "anna_nowak"
  },
  "department": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Dział IT"
  },
  "role_in_dept": "member"
}
```#### GET `/api/users/rbac/departments/tree/` — Drzewo departamentów```json
// Response 200 OK
[
  {
    "id": "dept-it-uuid",
    "name": "IT",
    "department_type": "department",
    "user_count": 10,
    "children": [
      {
        "id": "dept-backend-uuid",
        "name": "Backend Team",
        "department_type": "department",
        "user_count": 5,
        "children": []
      },
      {
        "id": "dept-frontend-uuid",
        "name": "Frontend Team",
        "department_type": "department",
        "user_count": 3,
        "children": []
      }
    ]
  },
  {
    "id": "dept-hr-uuid",
    "name": "HR",
    "department_type": "department",
    "user_count": 4,
    "children": []
  }
]
```---

## 5. Projekt polityk RLS

### 5.1. Nowe polityki RLS dla tabeli `Department````sql
-- ─────────────────────────────────────────────────────────────────────
-- RLS Policies: users_department
-- ─────────────────────────────────────────────────────────────────────

-- Włącz RLS na tabeli
ALTER TABLE users_department ENABLE ROW LEVEL SECURITY;

-- 1. Global Owner — pełny dostęp do wszystkich departamentów
CREATE POLICY dept_global_owner_select ON users_department
    FOR SELECT
    USING (
        current_setting('app.user_role', '') = 'global_owner'
    );

CREATE POLICY dept_global_owner_all ON users_department
    FOR ALL
    USING (
        current_setting('app.user_role', '') = 'global_owner'
    );

-- 2. Tenant Admin — pełny dostęp do departamentów w swoim tenancie
CREATE POLICY dept_tenant_admin_select ON users_department
    FOR SELECT
    USING (
        current_setting('app.user_role', '') = 'tenant_admin'
        AND tenant_id = current_setting('app.tenant_id', '')::uuid
    );

CREATE POLICY dept_tenant_admin_all ON users_department
    FOR ALL
    USING (
        current_setting('app.user_role', '') = 'tenant_admin'
        AND tenant_id = current_setting('app.tenant_id', '')::uuid
    );

-- 3. Department Moderator — dostęp do swojego departamentu
CREATE POLICY dept_moderator_select ON users_department
    FOR SELECT
    USING (
        current_setting('app.user_role', '') = 'department_moderator'
        AND id = current_setting('app.user_department_id', '')::uuid
    );

CREATE POLICY dept_moderator_update ON users_department
    FOR UPDATE
    USING (
        current_setting('app.user_role', '') = 'department_moderator'
        AND id = current_setting('app.user_department_id', '')::uuid
    );

-- 4. Athlete/Sponsor — widzą tylko departamenty, do których należą
CREATE POLICY dept_member_select ON users_department
    FOR SELECT
    USING (
        id IN (
            SELECT department_id
            FROM users_userdepartment
            WHERE user_id = current_setting('app.user_id', '')::int
        )
    );
```### 5.2. Nowe polityki RLS dla tabeli `UserDepartment````sql
-- ─────────────────────────────────────────────────────────────────────
-- RLS Policies: users_userdepartment
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE users_userdepartment ENABLE ROW LEVEL SECURITY;

-- 1. Global Owner — pełny dostęp
CREATE POLICY userdept_global_owner_all ON users_userdepartment
    FOR ALL
    USING (
        current_setting('app.user_role', '') = 'global_owner'
    );

-- 2. Tenant Admin — dostęp do przypisań w swoim tenancie
CREATE POLICY userdept_tenant_admin_all ON users_userdepartment
    FOR ALL
    USING (
        current_setting('app.user_role', '') = 'tenant_admin'
        AND department_id IN (
            SELECT id FROM users_department
            WHERE tenant_id = current_setting('app.tenant_id', '')::uuid
        )
    );

-- 3. Department Moderator — dostęp do przypisań w swoim departamencie
CREATE POLICY userdept_moderator_all ON users_userdepartment
    FOR ALL
    USING (
        current_setting('app.user_role', '') = 'department_moderator'
        AND department_id = current_setting('app.user_department_id', '')::uuid
    );

-- 4. Użytkownik — widzi tylko swoje przypisania
CREATE POLICY userdept_self_select ON users_userdepartment
    FOR SELECT
    USING (
        user_id = current_setting('app.user_id', '')::int
    );
```### 5.3. Rozszerzenie polityk RLS dla Activity```sql
-- ─────────────────────────────────────────────────────────────────────
-- Rozszerzenie RLS: activities_activity (dla Department Moderator)
-- ─────────────────────────────────────────────────────────────────────

-- Department Moderator widzi aktywności użytkowników ze swojego departamentu
CREATE POLICY activity_dept_moderator_select ON activities_activity
    FOR SELECT
    USING (
        current_setting('app.user_role', '') = 'department_moderator'
        AND user_id IN (
            SELECT user_id FROM users_userdepartment
            WHERE department_id = current_setting('app.user_department_id', '')::uuid
        )
    );
```### 5.4. Middleware — rozszerzenie TenantRLSMiddleware```
┌─────────────────────────────────────────────────────────────────────┐
│              ROZSZERZENIE: TenantRLSMiddleware                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Istniejące zmienne sesji PostgreSQL:                               │
│  - app.tenant_id        — ID tenanta                                │
│  - app.user_role        — rola użytkownika                          │
│  - app.user_id          — ID użytkownika                            │
│                                                                     │
│  NOWE zmienne sesji PostgreSQL:                                     │
│  - app.user_department_id  — ID głównego departamentu użytkownika   │
│  - app.user_departments    — lista ID departamentów (JSON array)    │
│                                                                     │
│  Flow:                                                              │
│  1. Użytkownik się loguje → pobierz jego departamenty               │
│  2. Ustaw app.user_department_id = pierwszy departament             │
│  3. Ustaw app.user_departments = JSON array wszystkich depart.      │
│  4. RLS policies używają tych zmiennych do filtrowania              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```---

## 6. Strategia migracji

### 6.1. Zasady migracji```
┌─────────────────────────────────────────────────────────────────────┐
│                    ZASADY MIGRACJI                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ✅ ADDITIVE ONLY — żadne istniejące dane nie są usuwane            │
│  ✅ ZERO-DOWNTIME — aplikacja działa podczas migracji               │
│  ✅ BACKWARD-COMPATIBLE — stare API nadal działa                    │
│  ✅ FEATURE FLAG — funkcja wyłączona domyślnie, włączana per tenant │
│  ✅ ROLLBACK — każda migracja ma operację wycofania                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```### 6.2. Kolejność migracji```
┌──────┬──────────────────────────────────────────────────────────────┐
│ Krok │ Opis                                                         │
├──────┼──────────────────────────────────────────────────────────────┤
│  1   │ Dodaj model Department (nowa tabela)                         │
│      │ - users_department z polami: id, name, tenant_id, parent_id, │
│      │   moderator_id, department_type, description, is_active      │
│      │ - Indeksy: tenant_id, parent_id, moderator_id                │
│      │ - UNIQUE: (tenant_id, name)                                  │
├──────┼──────────────────────────────────────────────────────────────┤
│  2   │ Dodaj model UserDepartment (tabela through)                  │
│      │ - users_userdepartment z polami: id, user_id, department_id, │
│      │   role_in_dept, joined_at                                    │
│      │ - UNIQUE: (user_id, department_id)                           │
│      │ - Dodaj pole M2M User.departments = ManyToMany(Department,   │
│      │   through='UserDepartment')                                  │
├──────┼──────────────────────────────────────────────────────────────┤
│  3   │ Dodaj nową rolę 'department_moderator' do RBAC               │
│      │ - Seedowanie roli w migracji danych                          │
│      │ - Dodaj uprawnienia departamentowe do Permission             │
│      │ - Przypisz uprawnienia do roli department_moderator          │
├──────┼──────────────────────────────────────────────────────────────┤
│  4   │ Rozszerz TenantRLSMiddleware                                 │
│      │ - Dodaj ustawianie app.user_department_id                    │
│      │ - Dodaj ustawianie app.user_departments (JSON array)         │
├──────┼──────────────────────────────────────────────────────────────┤
│  5   │ Dodaj polityki RLS dla nowych tabel                          │
│      │ - users_department: select, insert, update, delete           │
│      │ - users_userdepartment: select, insert, update, delete       │
│      │ - activities_activity: rozszerzenie dla dept. moderator      │
├──────┼──────────────────────────────────────────────────────────────┤
│  6   │ Dodaj endpointy API departamentów                            │
│      │ - CRUD departamentów                                         │
│      │ - Zarządzanie użytkownikami w departamencie                  │
│      │ - Drzewo departamentów                                       │
├──────┼──────────────────────────────────────────────────────────────┤
│  7   │ (Opcjonalnie) Dodaj pole department_id do Activity           │
│      │ - Tylko jeśli potrzebne są rankingi per departament          │
│      │ - Migracja: NULL dla istniejących aktywności                 │
├──────┼──────────────────────────────────────────────────────────────┤
│  8   │ Dodaj feature flag w Tenant.config_json                      │
│      │ - "departments_enabled": true/false                          │
│      │ - Domyślnie false, włączane per tenant                       │
└──────┴──────────────────────────────────────────────────────────────┘
```### 6.3. Migracja danych — automatyczne tworzenie departamentów```
┌─────────────────────────────────────────────────────────────────────┐
│              MIGRACJA DANYCH (opcjonalna)                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Dla istniejących tenantów można automatycznie utworzyć             │
│  departamenty na podstawie typu tenanta:                            │
│                                                                     │
│  Company → departamenty z pliku CSV/Excel importowanego przez       │
│            Tenant Admina                                            │
│                                                                     │
│  School  → klasy z importu dziennika elektronicznego                │
│                                                                     │
│  City    → dzielnice z danych GUS/URM                               │
│                                                                     │
│  Dla tenantów bez departamentów:                                    │
│  - Użytkownicy bez przypisania do departamentu nadal działają       │
│  - Ich dane są widoczne na poziomie tenant (bez filtrowania)        │
│  - Rankingi i analityka działają jak dotychczas                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```### 6.4. Plan wycofania```
┌─────────────────────────────────────────────────────────────────────┐
│                    PLAN WYCOFANIA                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Każda migracja ma metodę reverse():                                │
│                                                                     │
│  1. DROP TABLE users_userdepartment CASCADE                         │
│  2. DROP TABLE users_department CASCADE                             │
│  3. Usuń rolę 'department_moderator' i powiązane uprawnienia        │
│  4. Przywróć TenantRLSMiddleware do poprzedniej wersji              │
│  5. Usuń polityki RLS dla departamentów                             │
│                                                                     │
│  UWAGA: Przed usunięciem tabel należy wyeksportować dane            │
│  do pliku JSON/CSV w przypadku potrzeby przywrócenia.               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```---

## 7. Zmiany w frontendzie

### 7.1. Nowe komponenty```
┌─────────────────────────────────────────────────────────────────────┐
│                    NOWE KOMPONENTY FRONTEND                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  admin/src/modules/departments/                                     │
│  ├── Departments.tsx              # Główny widok listy departamentów│
│  ├── DepartmentTree.tsx           # Widok drzewa departamentów      │
│  ├── DepartmentDetail.tsx         # Szczegóły departamentu          │
│  ├── DepartmentForm.tsx           # Formularz tworzenia/edycji      │
│  ├── DepartmentUsers.tsx          # Użytkownicy w departamencie     │
│  ├── DepartmentLeaderboard.tsx    # Ranking departamentu            │
│  └── DepartmentAnalytics.tsx      # Analityka departamentu          │
│                                                                     │
│  admin/src/modules/departments/components/                          │
│  ├── DepartmentCard.tsx           # Karta departamentu na liście    │
│  ├── DepartmentTreeNode.tsx       # Węzeł drzewa departamentów      │
│  ├── AssignUserModal.tsx          # Modal przypisania użytkownika   │
│  ├── SetModeratorModal.tsx        # Modal ustawienia moderatora     │
│  └── DepartmentTypeSelector.tsx   # Selector typu departamentu      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```### 7.2. Rozszerzenie istniejących komponentów```
┌─────────────────────────────────────────────────────────────────────┐
│                  ROZSZERZENIE ISTNIEJĄCYCH                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  admin/src/modules/users/Users.tsx                                  │
│  ├── Dodaj kolumnę "Departament" w tabeli użytkowników              │
│  ├── Dodaj filtr po departamencie                                   │
│  ├── Dodaj akcję "Przypisz do departamentu" w drawerze użytkownika  │
│  └── Dodaj badge z nazwą departamentu przy użytkowniku              │
│                                                                     │
│  admin/src/modules/dashboard/Dashboard.tsx                          │
│  ├── Dodaj widget "Top Departamenty"                                │
│  ├── Dodaj filtr dashboardu po departamencie                        │
│  └── Dodaj statystyki departamentowe (jeśli włączone)               │
│                                                                     │
│  admin/src/modules/analytics/CityAnalytics.tsx                      │
│  ├── Dodaj zakładkę "Analityka Departamentów"                       │
│  ├── Dodaj porównanie departamentów                                 │
│  └── Dodaj heatmapę aktywności per departament                      │
│                                                                     │
│  admin/src/api/client.ts                                            │
│  ├── Dodaj DepartmentApi z metodami:                                │
│  │   - getDepartments()                                             │
│  │   - getDepartmentTree()                                          │
│  │   - createDepartment()                                           │
│  │   - updateDepartment()                                           │
│  │   - deleteDepartment()                                           │
│  │   - getDepartmentUsers()                                         │
│  │   - assignUserToDepartment()                                     │
│  │   - removeUserFromDepartment()                                   │
│  │   - getDepartmentLeaderboard()                                   │
│  │   - getDepartmentAnalytics()                                     │
│  └── Dodaj typy TypeScript dla Department, UserDepartment           │
│                                                                     │
│  admin/src/core/guards/PermissionGuard.tsx                          │
│  ├── Dodaj obsługę scope'u departamentowego                         │
│  └── PermissionGuard z departmentScope prop                         │
│                                                                     │
│  admin/src/core/auth/useAuth.ts                                     │
│  ├── Dodaj user.departments do stanu auth                           │
│  ├── Dodaj hasDepartmentPermission()                                │
│  └── Dodaj userDepartmentId do stanu                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```### 7.3. Typowy TypeScript```typescript
// admin/src/api/client.ts — nowe typy

interface Department {
  id: string;                    // UUID
  name: string;
  tenant: {
    id: string;
    name: string;
  };
  parent: Department | null;
  moderator: {
    id: number;
    username: string;
  } | null;
  department_type: 'department' | 'class' | 'faculty' | 'team' | 'district';
  description: string;
  is_active: boolean;
  user_count: number;
  created_at: string;
}

interface DepartmentTree extends Department {
  children: DepartmentTree[];
}

interface UserDepartment {
  id: string;                    // UUID
  user: {
    id: number;
    username: string;
  };
  department: {
    id: string;
    name: string;
  };
  role_in_dept: 'member' | 'lead';
  joined_at: string;
}

interface DepartmentAnalytics {
  total_activities: number;
  total_distance: number;
  total_duration: number;
  active_users: number;
  avg_activities_per_user: number;
  top_users: Array<{
    user: { id: number; username: string };
    activities_count: number;
    total_distance: number;
  }>;
}
```### 7.4. Rozszerzenie stanu auth (Zustand)```typescript
interface AuthState {
  user: User | null;
  // ... istniejące pola ...

  // NOWE: Departamenty
  departments: Department[];          // Departamenty użytkownika
  primaryDepartmentId: string | null; // Główny departament
  hasDepartmentPermission: (permission: string, departmentId?: string) => boolean;
}

interface User {
  // ... istniejące pola ...
  departments?: Department[];         // NOWE: Lista departamentów użytkownika
  primary_department_id?: string;     // NOWE: ID głównego departamentu
}
```### 7.5. Widok listy departamentów — mockup```
┌─────────────────────────────────────────────────────────────────────┐
│  🏢 Departamenty                                    [+ Nowy depart.]│
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [🔍 Szukaj departamentu...]  [Typ: Wszystkie ▼]  [Status: Aktywne] │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 📁 IT (10 użytkowników)                      [⚙️] [👥] [📊] │   │
│  │   Moderator: Jan Kowalski                                    │   │
│  │   ┌───────────────────────────────────────────────────────┐ │   │
│  │   │ 📂 Backend Team (5 użytkowników)        [⚙️] [👥] [📊]│ │   │
│  │   └───────────────────────────────────────────────────────┘ │   │
│  │   ┌───────────────────────────────────────────────────────┐ │   │
│  │   │ 📂 Frontend Team (3 użytkowników)       [⚙️] [👥] [📊]│ │   │
│  │   └───────────────────────────────────────────────────────┘ │   │
│  │   ┌───────────────────────────────────────────────────────┐ │   │
│  │   │ 📂 DevOps (2 użytkowników)              [⚙️] [👥] [📊]│ │   │
│  │   └───────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 📁 HR (4 użytkowników)                       [⚙️] [👥] [📊] │   │
│  │   Moderator: Maria Zielińska                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 📁 Sales (14 użytkowników)                   [⚙️] [👥] [📊] │   │
│  │   Brak moderatora  [🔗 Ustaw moderatora]                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```---

## 8. Fazy implementacji

### 8.1. Faza 1: Fundamenty (Backend) — ~2 tygodnie```
┌─────────────────────────────────────────────────────────────────────┐
│  FAZA 1: MODELE I MIGRACJE                                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Zadania:                                                           │
│  ├── [1.1] Dodaj model Department do users/models.py                │
│  ├── [1.2] Dodaj model UserDepartment (through model)               │
│  ├── [1.3] Dodaj pole M2M User.departments                          │
│  ├── [1.4] Utwórz migrację Django (0012_department_models.py)       │
│  ├── [1.5] Dodaj nową rolę 'department_moderator' do seed_rbac      │
│  ├── [1.6] Dodaj uprawnienia departamentowe do PERMISSIONS          │
│  ├── [1.7] Uruchom seed_rbac dla nowych uprawnień                   │
│  └── [1.8] Testy jednostkowe modeli                                 │
│                                                                     │
│  Deliverables:                                                      │
│  - Nowe tabele w bazie danych                                       │
│  - Nowa rola i uprawnienia w RBAC                                   │
│  - Testy przechodzące                                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```### 8.2. Faza 2: API i RLS — ~2 tygodnie```
┌─────────────────────────────────────────────────────────────────────┐
│  FAZA 2: API ENDPOINTY I RLS                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Zadania:                                                           │
│  ├── [2.1] DepartmentSerializer (DRF)                               │
│  ├── [2.2] DepartmentViewSet (CRUD)                                 │
│  ├── [2.3] Endpointy akcji (assign, remove, tree, my)               │
│  ├── [2.4] Department URL routing (users/rbac_urls.py)              │
│  ├── [2.5] Rozszerz TenantRLSMiddleware o departamenty              │
│  ├── [2.6] Dodaj polityki RLS dla users_department                  │
│  ├── [2.7] Dodaj polityki RLS dla users_userdepartment              │
│  ├── [2.8] Rozszerz RLS dla activities_activity                     │
│  ├── [2.9] Testy API (pytest)                                       │
│  └── [2.10] Testy RLS (symulacja różnych ról)                      │
│                                                                     │
│  Deliverables:                                                      │
│  - Działające endpointy CRUD departamentów                          │
│  - Polityki RLS wdrożone                                            │
│  - Testy API i RLS przechodzące                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```### 8.3. Faza 3: Frontend — Departamenty — ~2 tygodnie```
┌─────────────────────────────────────────────────────────────────────┐
│  FAZA 3: FRONTEND — ZARZĄDZANIE DEPARTAMENTAMI                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Zadania:                                                           │
│  ├── [3.1] Dodaj typy TypeScript dla Department                     │
│  ├── [3.2] Dodaj DepartmentApi w client.ts                          │
│  ├── [3.3] Utwórz moduł departments/ z widokiem listy               │
│  ├── [3.4] DepartmentTree — widok drzewa                            │
│  ├── [3.5] DepartmentForm — formularz tworzenia/edycji              │
│  ├── [3.6] DepartmentUsers — lista użytkowników w departamencie     │
│  ├── [3.7] AssignUserModal — modal przypisania użytkownika          │
│  ├── [3.8] SetModeratorModal — modal ustawienia moderatora          │
│  ├── [3.9] Dodaj nawigację do departamentów w Layout.tsx            │
│  └── [3.10] PermissionGuard z obsługą scope'u departamentowego      │
│                                                                     │
│  Deliverables:                                                      │
│  - Pełny CRUD departamentów w panelu admina                         │
│  - Zarządzanie użytkownikami w departamentach                       │
│  - Nawigacja i routing                                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```### 8.4. Faza 4: Integracja z istniejącymi modułami — ~2 tygodnie```
┌─────────────────────────────────────────────────────────────────────┐
│  FAZA 4: INTEGRACJA                                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Zadania:                                                           │
│  ├── [4.1] Rozszerz Users.tsx o kolumnę "Departament"               │
│  ├── [4.2] Dodaj filtr po departamencie w Users.tsx                 │
│  ├── [4.3] Rozszerz Dashboard.tsx o widget departamentów            │
│  ├── [4.4] Dodaj DepartmentLeaderboard.tsx                          │
│  ├── [4.5] Rozszerz CityAnalytics.tsx o analitykę departamentów     │
│  ├── [4.6] Dodaj endpoint GET /departments/{id}/leaderboard/        │
│  ├── [4.7] Dodaj endpoint GET /departments/{id}/analytics/          │
│  ├── [4.8] Rozszerz useAuth.ts o departamenty                       │
│  └── [4.9] Testy integracyjne                                       │
│                                                                     │
│  Deliverables:                                                      │
│  - Departamenty widoczne w module użytkowników                      │
│  - Rankingi i analityka per departament                             │
│  - Dashboard z widgetem departamentów                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```### 8.5. Faza 5: Feature Flag i dokumentacja — ~1 tydzień```
┌─────────────────────────────────────────────────────────────────────┐
│  FAZA 5: FEATURE FLAG I DOKUMENTACJA                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Zadania:                                                           │
│  ├── [5.1] Dodaj "departments_enabled" do Tenant.config_json        │
│  ├── [5.2] Middleware sprawdza feature flag przed RLS               │
│  ├── [5.3] Frontend ukrywa departamenty jeśli wyłączone             │
│  ├── [5.4] Dokumentacja API departamentów                           │
│  ├── [5.5] Dokumentacja RLS policies                                │
│  ├── [5.6] Przewodnik konfiguracji dla Tenant Admina                │
│  └── [5.7] Testy end-to-end                                         │
│                                                                     │
│  Deliverables:                                                      │
│  - Feature flag wdrożony                                            │
│  - Pełna dokumentacja                                               │
│  - Testy E2E przechodzące                                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```### 8.6. Harmonogram tak```
┌─────────────────────────────────────────────────────────────────────┐
│                        HARMONOGRAM                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Tydzień 1-2:  FAZA 1 — Modele i migracje                           │
│  Tydzień 3-4:  FAZA 2 — API i RLS                                   │
│  Tydzień 5-6:  FAZA 3 — Frontend departamenty                       │
│  Tydzień 7-8:  FAZA 4 — Integracja z modułami                       │
│  Tydzień 9:    FAZA 5 — Feature flag i dokumentacja                 │
│                                                                     │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐          │
│  │ F1  │ F1  │ F2  │ F2  │ F3  │ F3  │ F4  │ F4  │ F5  │          │
│  └─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘          │
│                                                                     │
│  Kamienie milowe:                                                   │
│  - Po Fazie 1: Modele gotowe, migracje wykonane                     │
│  - Po Fazie 2: API działa, RLS wdrożone                            │
│  - Po Fazie 3: Frontend CRUD gotowy                                │
│  - Po Fazie 4: Pełna integracja z platformą                        │
│  - Po Fazie 5: Gotowe do produkcji z feature flagiem               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```---

## 9. Rozszerzenia przyszłościowe

### 9.1. Potencjalne rozszerzenia```
┌─────────────────────────────────────────────────────────────────────┐
│                    ROZSZERZENIA PRZYSZŁOŚCIOWE                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Cross-department challenges                                     │
│     - Rywalizacja między departamentami                             │
│     - Wspólne wyzwania dla wielu departamentów                      │
│                                                                     │
│  2. Department budgets & goals                                      │
│     - Cele aktywnościowe per departament                            │
│     - Budżety sponsorskie przypisane do departamentów               │
│                                                                     │
│  3. Department-level sponsors                                       │
│     - Sponsorzy przypisani do konkretnych departamentów             │
│     - Vouchery dostępne tylko dla danego departamentu               │
│                                                                     │
│  4. Department analytics dashboard                                  │
│     - Porównanie departamentów wewnątrz tenant                      │
│     - Trendy aktywności per departament                             │
│                                                                     │
│  5. Department import/export                                        │
│     - Import departamentów z CSV/Excel                              │
│     - Export struktury organizacyjnej                               │
│                                                                     │
│  6. Department notifications                                        │
│     - Powiadomienia push dla członków departamentu                  │
│     - Ogłoszenia departamentowe                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```---

## 10. Podsumowanie

### 10.1. Kluczowe decyzje architektoniczne```
┌─────────────────────────────────────────────────────────────────────┐
│                    DECYZJE ARCHITEKTONICZNE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. ManyToMany vs ForeignKey dla User-Department                    │
│     → ManyToMany z through modelem (UserDepartment)                 │
│     → Użytkownik może należeć do wielu departamentów                │
│     → Through model pozwala na role_in_dept ('member', 'lead')      │
│                                                                     │
│  2. department_id w Activity — czy dodawać?                         │
│     → NIE w fazie 1 (opcjonalne w przyszłości)                      │
│     → Departament użytkownika wyznaczany przez UserDepartment       │
│     → Jeśli potrzebne rankingi per departament → dodać w Fazie 4    │
│                                                                     │
│  3. RLS — czy używać app.user_department_id?                        │
│     → TAK, ale jako JSON array (app.user_departments)               │
│     → Użytkownik może mieć wiele departamentów                      │
│     → app.user_department_id = główny departament (pierwszy)        │
│                                                                     │
│  4. Feature flag — czy włączać domyślnie?                           │
│     → NIE, domyślnie wyłączone (departments_enabled: false)         │
│     → Włączane per tenant przez Tenant Admina / Global Owner        │
│                                                                     │
│  5. Nowa rola systemowa vs rozszerzenie istniejącej                 │
│     → NOWA ROLA: 'department_moderator'                             │
│     → Nie mylić z 'tenant_moderator' (istniejąca rola)              │
│     → Department Moderator ma scope ograniczony do swojego depart.  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```### 10.2. Ryzyka i mitigacje```
┌─────────────────────────────────────────────────────────────────────┐
│                        RYZYKA                                        │
├──────────────────────────┬──────────────────────────────────────────┤
│ Ryzyko                   │ Mitigacja                                │
├──────────────────────────┼──────────────────────────────────────────┤
│ Wydajność zapytań z      │ Indeksy na department_id, user_id;       │
│ wieloma JOIN-ami         │ cacheowanie wyników w Redis              │
├──────────────────────────┼──────────────────────────────────────────┤
│ Złożoność RLS policies   │ Dokładne testy RLS dla każdej roli;      │
│                          │ symulacja różnych scenariuszy            │
├──────────────────────────┼──────────────────────────────────────────┤
│ Migracja danych dla      │ Import z CSV/Excel; narzędzie do         │
│ istniejących tenantów    │ automatycznego tworzenia departamentów   │
├──────────────────────────┼──────────────────────────────────────────┤
│ Backward compatibility   │ Feature flag; stare API nadal działa;    │
│                          │ użytkownicy bez departamentu działają    │
├──────────────────────────┼──────────────────────────────────────────┤
│ Złożoność frontendu      │ Stopniowe wdrażanie; najpierw CRUD,      │
│                          │ potem integracja z modułami              │
└──────────────────────────┴──────────────────────────────────────────┘
```---

> **Zobacz także:** [🛡️ RBAC Guide](../RBAC.md) — system uprawnień  
> **Zobacz także:** [🏛️ Architecture](./ARCHITECTURE.md) — architektura systemu  
> **Zobacz także:** [📡 API Reference](./API.md) — endpointy API
