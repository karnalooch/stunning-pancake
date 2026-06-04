# ADR 009: Admin User Customization and Dynamic Inter-Tenant Matchmaking


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../pl/adr/009-admin-user-management-and-event-matchmaking.md) |
| **canonical_path** | docs/adr/009-admin-user-management-and-event-matchmaking.md |

---

| | |
|--|--|
| **Status** | Accepted |
| **Owner role** | Tech Lead |
| **Last reviewed** | 2026-06-03 |
| **Language** | English |
| **Index** | [docs/README.md](../README.md) |


## Status
Accepted (2026-05-21)

## Context
In the SPORT/4VELO platform, as part of the v3.0 Admin Portal overhaul, two key architectural design questions were posed regarding administrator permissions and event configurations:
1. **User Profile Customization scope**: Should administrators (`GLOBAL_OWNER` or `TENANT_ADMIN`) have the power to edit and assign custom avatars and bio descriptions for other users, or should they only edit core identity information (`username`/`nickname`, `email`, `role`, `tenant`, `password`)?
2. **Inter-Tenant Matchmaking list**: For cross-city (`INTER_TENANT`) events, should the opponent city/tenant selector dynamically fetch and display active tenants from the database, or should it be pre-configured statically?

Both decisions were answered in the affirmative ("Yes") to enable maximum flexibility, dynamic operation, and a premium administrative experience.

## Decision
We have implemented and codified the following architectural specifications:

### 1. Advanced Administrative User Profile Control
- **Full Customization Rights**: Administrators (`GLOBAL_OWNER` and `TENANT_ADMIN`) are authorized to modify all aspect of user identities, including custom avatar image URLs/file pointers and biography descriptions (`bio`).
- **Form Integration**: The high-performance Users Manager Drawer incorporates dynamic text fields for custom avatar URL inputs and a rich text block for bio details.
- **Backend Enforcement**: The `UserUpdateView` serializer (`UserAdminUpdateSerializer`) includes both `avatar` and `bio` as writeable fields.
- **RLS and Scope Guarding**:
  - `GLOBAL_OWNER` can edit avatars/bios globally across all cities.
  - `TENANT_ADMIN` is restricted by backend checks to editing users whose `tenant_id` matches their own.

### 2. Dynamic City vs City (Inter-Tenant) Matchmaking
- **Dynamic Selector Ingestion**: When configuring an event of type `INTER_TENANT` (City vs City) in the Events Manager CRUD form, the frontend queries `/api/users/tenants/all/` dynamically to pull active cities/tenants.
- **Opponent Tenant Selection**: This list populates a premium dropdown, letting the administrator pick which active city the home city will battle against.
- **RBAC Extension**:
  - The `TenantListView` in `backend/users/views.py` has been updated from `IsGlobalOwner` to `IsTenantAdmin`.
  - This allows `TENANT_ADMIN` to query the list of active cities solely for the purpose of matchmaking, while maintaining RLS constraints over write operations.

## Consequences
- **Positive (Flexibility)**: City administrators can now fully handle user visual representation and biographies, which is crucial for managing sponsor accounts or branded athletes.
- **Positive (Dynamic Operations)**: Cross-city matches can be arranged on the fly as new tenants register and become active in the system, eliminating static code maps or manual configurations.
- **Positive (Security)**: RLS permissions are strictly enforced on write operations. A `TENANT_ADMIN` can read the list of active city names, but has zero authorization to view user lists or modify settings of another tenant.
