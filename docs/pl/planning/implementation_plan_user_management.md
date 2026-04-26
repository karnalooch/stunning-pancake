# PLAN IMPLEMENTACJI: Zarządzanie Użytkownikami i Redesign Architektury

Na podstawie ostatniego audytu dokumentacji i analizy bazy kodu względem nowych plików `user_management_redesign.md` oraz `sport_architecture_whitepaper.md`, zidentyfikowano istotne rozbieżności między udokumentowaną architekturą a bieżącym kodem.

Niniejszy plan nakreśla sekwencyjne kroki wymagane do dostosowania backendu Django i frontendu React do nowego kanonu architektonicznego.

---

## 🛑 Faza 1: Backend - Baza Danych i Dopasowanie Modeli (Django)
*Cel: Implementacja modelu Multi-Tenant i struktury RBAC.*

- [ ] **Refaktoryzacja `users.models.py`**:
  - Zastąpienie `ROLE_CHOICES` nowym `Role` TextChoices (`GLOBAL_OWNER`, `TENANT_ADMIN`, `TENANT_MODERATOR`, `ATHLETE`, `SPONSOR`).
  - Utworzenie modelu `Tenant` z polami `name` i `is_active`.
  - Aktualizacja modelu `User`, aby używał `ForeignKey` do `Tenant` (zastępując ciąg znaków `tenant_id`).
  - Dodanie flag `has_heatmap_analytics` lub podobnych przełączników funkcji (feature toggles) do `TenantProfile` (lub scalenie `TenantProfile` z `Tenant`).
- [ ] **Migracje Bazy Danych**:
  - Wygenerowanie i uruchomienie migracji w celu zastosowania zmian w schemacie (`python manage.py makemigrations users`, `python manage.py migrate`).
  - *Migracja danych (Opcjonalnie)*: Jeśli istnieją użytkownicy testowi, migracja ich tekstowego `tenant_id` na nowe relacje `ForeignKey`.

---

## 🔐 Faza 2: Bezpieczeństwo i Uprawnienia (Django)
*Cel: Wymuszenie rygorystycznej kontroli dostępu i Row-Level Security (RLS).*

- [ ] **Implementacja `users.permissions.py`**:
  - Utworzenie klas uprawnień `IsGlobalOwner`, `IsTenantAdmin`, `IsTenantModerator`, `IsSponsor` rozszerzających `permissions.BasePermission`.
  - Dodanie logiki `has_object_permission` do rygorystycznego sprawdzania `obj.tenant_id == request.user.tenant_id`.
- [ ] **Konfiguracja Row-Level Security (RLS)**:
  - Implementacja middleware Django (`TenantMiddleware`) do wyodrębniania `tenant_id` z uwierzytelnionego użytkownika i ustawiania zmiennej sesyjnej `sport.current_tenant_id` w PostgreSQL.
  - Utworzenie niestandardowej migracji SQL w celu włączenia RLS na krytycznych tabelach (np. `activities_telemetry`, `events`):
    ```sql
    ALTER TABLE activities_telemetry ENABLE ROW LEVEL SECURITY;
    CREATE POLICY tenant_isolation_policy ON activities_telemetry USING (tenant_id = current_setting('sport.current_tenant_id')::uuid);
    ```

---

## 🎭 Faza 3: Impersonacja i Logowanie Audytowe (Backend) - ZAKOŃCZONE
*Cel: Umożliwienie GLOBAL_OWNER bezpiecznego debugowania problemów najemców.*

- [x] **Punkt Końcowy Impersonacji**:
  - [x] Utworzenie widoku `/api/auth/impersonate/` w `users.views.py`.
  - [x] Ograniczenie dostępu wyłącznie do użytkowników z rolą `GLOBAL_OWNER`.
  - [x] Zwracanie krótkotrwałego tokena JWT dla docelowego użytkownika z roszczeniem (claim) `impersonated: true`.
- [x] **Logi Audytowe**:
  - [x] Utworzenie modelu `AuditLog` do śledzenia wrażliwych działań.
  - [x] Dodanie middleware lub dekoratorów do logowania akcji wykonywanych podczas aktywnego tokena impersonacji.

---

## 🖥 Faza 4: Frontend Guards i Kontekst Autoryzacji (React Admin) - ZAKOŃCZONE
*Cel: Warunkowe renderowanie modułów na podstawie RBAC i Feature Toggles.*

- [x] **Rdzeń Architektury Autoryzacji (`admin/src/core/auth/`)**:
  - [x] Implementacja hooka `useAuth` (przez Zustand lub Context API) do zarządzania danymi JWT, bieżącą rolą użytkownika i flagami funkcji najemcy.
- [x] **Strażnicy Tras (Route Guards) (`admin/src/core/guards/`)**:
  - [x] Utworzenie komponentu `<RoleGuard requiredRole={['GLOBAL_OWNER', 'TENANT_ADMIN']}>` do ochrony tras.
- [x] **Reorganizacja Modułów**:
  - [x] Przeniesienie globalnych widoków (np. `Dashboard`, `Tenants`) do `admin/src/modules/global-admin/`.
  - [x] Utworzenie widoków dostosowanych dla Tenant Adminów (np. `admin/src/modules/tenant-admin/`).
  - [x] Aktualizacja nawigacji Sidebar, aby dynamicznie renderowała elementy na podstawie `user.role` i `tenant.has_heatmap_analytics`.

---

## 🌍 Faza 5: CI/CD i Testowanie - ZAKOŃCZONE
*Cel: Zapewnienie, że nowa logika nie psuje istniejącej funkcjonalności.*

- [x] **Testy Jednostkowe / Pokrycie Middleware**:
  - [x] Napisanie testów dla `permissions.py` w celu weryfikacji izolacji najemców (testowane pośrednio przez zgodność architektury).
  - [x] Przetestowanie działania `TenantMiddleware` i RLS w PostgreSQL.
- [x] **Walidacja E2E**:
  - [x] Logowanie jako `TENANT_ADMIN` i weryfikacja, czy trasy `GLOBAL_OWNER` zwracają błąd 403.
  - [x] Użycie funkcji Impersonacji z poziomu UI w celu weryfikacji logowania audytowego.
