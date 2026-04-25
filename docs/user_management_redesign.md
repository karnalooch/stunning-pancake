# USER MANAGEMENT & LOGIC REDESIGN (USER MANAGEMENT V2)

This document describes the updated architecture for user management, the Role-Based Access Control (RBAC) system, and its connection to the Multi-Tenant (B2B2C) system on the SPORT platform. The system is now an ecosystem consisting of Instances (Tenants) – where an Instance can be "City X" or "Company Y".

## A. Role Hierarchy and Permissions (Business Logic)

Here is the breakdown of roles within the ecosystem:

1. **GLOBAL_OWNER (Platform Owner)**
   - **Visibility:** Everything ("God Mode").
   - **Permissions:** Creating new Instances (adding cities/companies), global analytics of the entire application, subscription and payment management (Stripe), banning entire organizations, access to system logs and telemetry.

2. **TENANT_ADMIN (Integrators / City Mayors / Company Owners)**
   - **Visibility:** Only data assigned to their Instance (their city/company).
   - **Permissions:** Inviting Moderators, creating local events/challenges (e.g., "Cycling May in Warsaw"), viewing aggregated statistics (heatmaps), assigning roles within their instance.

3. **TENANT_MODERATOR (Support / Local Staff)**
   - **Visibility:** Same as Tenant Admin, but without access to billing settings and the management of other administrative users.
   - **Permissions:** Handling the Anti-Cheat system (verifying suspicious routes via BRouter), moderating reports from users in the given city/company, accepting results from specific events.

4. **ATHLETE (End Users / Cyclists / Runners)**
   - **Visibility:** Own statistics, rankings of cities/clubs they participate in.
   - **Permissions:** Recording routes, joining challenges, defining their "Privacy Zones", reporting fraud by others. Can belong to multiple instances.

5. **SPONSOR (External Company Owners)**
   - **Visibility:** A special "Sponsor Dashboard" tied to the event they are sponsoring.
   - **Permissions:** Creating rewards/vouchers (Rewards), adding their stores to the map (POI), viewing anonymous statistics (how many people used a voucher).

---

## B. Code Implementation (Readability and Structure)

To keep the code clean, we strictly separate the authorization layer from the business logic.

### 1. Backend (Python / Django)
We use a database model based on a Multi-Tenant architecture with a junction table/foreign key.

**Directories and Naming Conventions (Django):**
```text
backend/
├── users/
│   ├── models.py        # CustomUser, Tenant, TenantProfile, UserRole
│   ├── permissions.py   # Classes: IsGlobalOwner, IsTenantAdmin, IsModerator
│   └── views.py
├── events/
│   ├── models.py        # Event (has a foreign key to Tenant)
│   └── views.py
```

**Role Logic Example (models.py):**
```python
from django.db import models
from django.contrib.auth.models import AbstractUser

class Role(models.TextChoices):
    GLOBAL_OWNER = 'GLOBAL_OWNER', 'Global Owner'
    TENANT_ADMIN = 'TENANT_ADMIN', 'Tenant Admin / Owner'
    TENANT_MODERATOR = 'TENANT_MODERATOR', 'Moderator'
    ATHLETE = 'ATHLETE', 'Athlete'
    SPONSOR = 'SPONSOR', 'Sponsor'

class Tenant(models.Model):
    name = models.CharField(max_length=255) # e.g., "City of Poznan", "Corp X"
    is_active = models.BooleanField(default=True)

class User(AbstractUser):
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.ATHLETE)
    tenant = models.ForeignKey(Tenant, on_delete=models.SET_NULL, null=True, blank=True)
    is_premium = models.BooleanField(default=False)
```

**Custom Permissions (permissions.py):**
```python
from rest_framework import permissions

class IsTenantAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.role == 'TENANT_ADMIN'
        
    def has_object_permission(self, request, view, obj):
        # Check if the edited object (e.g., Event) belongs to this Admin's city!
        return obj.tenant_id == request.user.tenant_id
```

### 2. Frontend (TypeScript / React)
In the web and mobile applications, we use the Context API or Zustand to hold user information in order to conditionally render views.

**Directory Structure (TypeScript):**
```text
admin/src/
├── core/
│   ├── auth/          # Login logic, JWT decoding
│   └── guards/        # ProtectedRoute.tsx (e.g., <RoleGuard requiredRole="TENANT_ADMIN">)
├── modules/
│   ├── global-admin/  # Views ONLY for you (GLOBAL_OWNER)
│   ├── tenant-admin/  # Views for Mayors/Companies
│   └── sponsor/       # Dashboards for sponsors
```

---

## C. Architectural Best Practices and Pro-Tips

In the architecture of such systems, we apply the following patterns to prevent future pitfalls:

### 1. Database: Row-Level Security (RLS) in PostgreSQL
Since we serve different cities and companies, a bug in the code could expose data of runners from "Company A" to the boss of "Company B". PostGIS and PostgreSQL support RLS. 
At the database level, we set a rule: *"User X can only query rows where `tenant_id` matches their `tenant_id`"*. Even if we forget to add a filter in a Django view, the database will strictly block the data leak.

### 2. "Login As" Feature (Impersonation)
As the GLOBAL_OWNER, there is often a need to verify issues reported by support (e.g., "Mr. Luke, I don't see yesterday's run on my mayor's panel").
Implementing a "Login as" feature is necessary (it's very simple in Django). It allows you to enter the panel, seeing exactly what the given `TENANT_ADMIN` sees, without knowing their password, with the click of a single button.

### 3. Feature Toggles at the Instance (Tenant) Level
Just as we flag paid features on a user object (`is_premium`), we do the same for entire instances.
If the "City of Warsaw" pays for a higher tier, we enable a flag in their `TenantProfile`, e.g., `has_heatmap_analytics = True`. The front-end (React) fetches these settings upon login and automatically generates or hides dedicated modules and options in the sidebar for all moderators from Warsaw.
