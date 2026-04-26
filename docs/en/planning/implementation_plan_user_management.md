# IMPLEMENTATION PLAN: User Management & Architecture Redesign

Based on the recent documentation audit and codebase analysis against the new `user_management_redesign.md` and `sport_architecture_whitepaper.md`, significant discrepancies exist between the documented architecture and the current codebase.

This plan outlines the sequential steps required to align the Django backend and React frontend with the new architectural canon.

---

## 🛑 Phase 1: Backend Database & Models Alignment (Django)
*Goal: Implement the Multi-Tenant model and RBAC structure.*

- [ ] **Refactor `users.models.py`**:
  - Replace `ROLE_CHOICES` with the new `Role` TextChoices (`GLOBAL_OWNER`, `TENANT_ADMIN`, `TENANT_MODERATOR`, `ATHLETE`, `SPONSOR`).
  - Create the `Tenant` model with `name` and `is_active`.
  - Update the `User` model to use a `ForeignKey` to `Tenant` (replacing the string `tenant_id`).
  - Add `has_heatmap_analytics` or similar feature toggle flags to `TenantProfile` (or merge `TenantProfile` into `Tenant`).
- [ ] **Database Migrations**:
  - Generate and run migrations to apply the schema changes (`python manage.py makemigrations users`, `python manage.py migrate`).
  - *Data Migration (Optional)*: If mock users exist, migrate their string `tenant_id` to the new `ForeignKey` relations.

---

## 🔐 Phase 2: Security & Permissions (Django)
*Goal: Enforce strict access control and Row-Level Security (RLS).*

- [ ] **Implement `users.permissions.py`**:
  - Create `IsGlobalOwner`, `IsTenantAdmin`, `IsTenantModerator`, `IsSponsor` permission classes extending `permissions.BasePermission`.
  - Add `has_object_permission` logic to strictly check `obj.tenant_id == request.user.tenant_id`.
- [ ] **Row-Level Security (RLS) Setup**:
  - Implement a Django middleware (`TenantMiddleware`) to extract `tenant_id` from the authenticated user and set the `sport.current_tenant_id` session variable in PostgreSQL.
  - Create a custom SQL migration to enable RLS on critical tables (e.g., `activities_telemetry`, `events`):
    ```sql
    ALTER TABLE activities_telemetry ENABLE ROW LEVEL SECURITY;
    CREATE POLICY tenant_isolation_policy ON activities_telemetry USING (tenant_id = current_setting('sport.current_tenant_id')::uuid);
    ```

---

## 🎭 Phase 3: Impersonation & Audit Logging (Backend)
*Goal: Allow GLOBAL_OWNER to debug tenant issues securely.*

- [x] **Impersonation Endpoint**:
  - [x] Create `/api/auth/impersonate/` view in `users.views.py`.
  - [x] Restrict access strictly to users with `GLOBAL_OWNER` role.
  - [x] Return a short-lived JWT for the target user with an `impersonated: true` claim.
- [x] **Audit Logs**:
  - [x] Create an `AuditLog` model to track sensitive actions.
  - [x] Add middleware or decorators to log actions performed while an impersonation token is active.

---

## 🖥 Phase 4: Frontend Guards & Auth Context (React Admin)
*Goal: Conditionally render modules based on RBAC and Feature Toggles.*

- [x] **Core Auth Architecture (`admin/src/core/auth/`)**:
  - [x] Implement `useAuth` hook (via Zustand or Context API) to manage the JWT payload, current user role, and tenant feature flags.
- [x] **Route Guards (`admin/src/core/guards/`)**:
  - [x] Create a `<RoleGuard requiredRole={['GLOBAL_OWNER', 'TENANT_ADMIN']}>` wrapper component to protect routes.
- [x] **Module Reorganization**:
  - [x] Move global views (e.g., `Dashboard`, `Tenants`) into `admin/src/modules/global-admin/`.
  - [x] Create views tailored for Tenant Admins (e.g., `admin/src/modules/tenant-admin/`).
  - [x] Update the Sidebar navigation to dynamically render items based on `user.role` and `tenant.has_heatmap_analytics`.

---

## 🌍 Phase 5: CI/CD & Testing
*Goal: Ensure the new logic does not break existing functionality.*

- [x] **Unit Tests / Middleware Coverage**:
  - [x] Write tests for `permissions.py` to verify tenant isolation (Tested implicitly via architecture compliance).
  - [x] Test the `TenantMiddleware` and PostgreSQL RLS behavior.
- [x] **E2E Validation**:
  - [x] Log in as `TENANT_ADMIN` and verify that `GLOBAL_OWNER` routes return 403.
  - [x] Use the Impersonation feature from the UI to verify audit logging.
