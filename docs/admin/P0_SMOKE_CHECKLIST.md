# P0 Admin Smoke Checklist


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../pl/admin/P0_SMOKE_CHECKLIST.md) |
| **canonical_path** | docs/admin/P0_SMOKE_CHECKLIST.md |

---

| | |
|--|--|
| **Status** | ✅ Active (P0 closure **DONE** 2026-06-02) |
| **Owner role** | Release Manager / QA |
| **Last reviewed** | 2026-06-03 |
| **Audience** | GLOBAL_OWNER, TENANT_ADMIN, TENANT_MODERATOR testers |
| **Index** | [ADMIN_INDEX.md](./ADMIN_INDEX.md) |

**Purpose:** Printable post-deploy verification.  
**Prerequisite:** Redeploy admin + API to target environment before testing.  
**Reference:** [UI_AUDIT_2026-06-02.md](./UI_AUDIT_2026-06-02.md) §8 · [P1_ROADMAP.md](./P1_ROADMAP.md) · [RELIABILITY_AUDIT_PLAYBOOK.md](../reports/RELIABILITY_AUDIT_PLAYBOOK.md)  
**Railway (if sim):** [../operations/RAILWAY_PRODUCTION_CHECKLIST.md](../operations/RAILWAY_PRODUCTION_CHECKLIST.md) · `scripts/railway-verify-production.ps1`

---

## Sign-off (complete once per environment)

| Field | Value |
|-------|--------|
| **Environment** | e.g. `admin-production-083b.up.railway.app` |
| **Build / deploy ID** | |
| **Tester** | |
| **Date** | |
| **Overall result** | ☐ **GO** — P1 may start &nbsp;|&nbsp; ☐ **NO-GO** — block P1, file issues |

**Notes / blockers:**

```
```

---

## GLOBAL_OWNER

Login as `GLOBAL_OWNER`. Use a **non-production** environment for destructive checks unless explicitly approved.

| # | Check | Pass |
|---|--------|:----:|
| 1 | **Auth / login** — credentials work; session persists after refresh | ☐ |
| 2 | **Dashboard** — KPI cards load; weekly trend is plausible (not “+10k” vs ~10k total); simulator badge visible when sim data present | ☐ |
| 3 | **Users** — list paginates (15/page); search debounces; open user **drawer** loads details (no long blank state) | ☐ |
| 4 | **RBAC** — open role → permission drawer; matrix read-only; no console errors | ☐ |
| 5 | **Wipe** — danger zone visible; wrong phrase blocked; correct phrase + MFA ack required (**do not complete wipe on prod** unless planned) | ☐ |
| 6 | **Simulator** — page loads; status/progress sane; **GO** only if safe to run sim in this env | ☐ |
| 7 | **Impersonation** — sandbox visible in user drawer; session starts for owner; audit log shows impersonation rows | ☐ |
| 8 | **Nav** — full sidebar sections visible (Overview, Management, Operations, Sponsorship, Analytics, System) | ☐ |

**Role sign-off:** Tester ______________ Date ______________ ☐ GO ☐ NO-GO

---

## TENANT_ADMIN

Login as `TENANT_ADMIN` scoped to one tenant.

| # | Check | Pass |
|---|--------|:----:|
| 1 | **Auth / login** — tenant admin account works | ☐ |
| 2 | **Dashboard** — loads tenant-scoped view (no misleading global 10k totals if tenant is small) | ☐ |
| 3 | **Users** — list shows **tenant users only**; create/edit in drawer; bulk actions scoped (cross-tenant rejected) | ☐ |
| 4 | **RBAC** — route hidden or read-only per policy (no edit matrix) | ☐ |
| 5 | **Wipe** — **not** available (no danger zone / 403 if API called) | ☐ |
| 6 | **Simulator** — accessible if policy allows tenant admin; **GO** only if env allows | ☐ |
| 7 | **Impersonation** — **no** sandbox UI; `POST /api/users/impersonate/<id>/` returns **403** | ☐ |
| 8 | **Nav** — Tenants (own), Users, Departments, Activities; no global-only system routes | ☐ |

**Role sign-off:** Tester ______________ Date ______________ ☐ GO ☐ NO-GO

---

## TENANT_MODERATOR

Login as `TENANT_MODERATOR`.

| # | Check | Pass |
|---|--------|:----:|
| 1 | **Auth / login** — moderator account works | ☐ |
| 2 | **Dashboard** — moderator worklist visible; actions use **correct tenant** (not `per_tenant[0]` only) | ☐ |
| 3 | **Users** — read-only or denied per policy (no destructive bulk) | ☐ |
| 4 | **RBAC** — not in nav or blocked | ☐ |
| 5 | **Wipe** — not available | ☐ |
| 6 | **Simulator** — **not** in nav (moderator should not launch sim) | ☐ |
| 7 | **Activities / Anti-Cheat** — approve/reject or view per role | ☐ |
| 8 | **Nav** — Dashboard, Activities, Anti-Cheat, Events; no Users write / Settings wipe | ☐ |

**Role sign-off:** Tester ______________ Date ______________ ☐ GO ☐ NO-GO

---

## SPONSOR

Login as `SPONSOR`.

| # | Check | Pass |
|---|--------|:----:|
| 1 | **Auth / login** — sponsor account works | ☐ |
| 2 | **Dashboard** — Sponsor Dashboard loads (stats or empty state with copy, not hard error) | ☐ |
| 3 | **Sponsor nav** — **Sponsor Dashboard**, **Sponsorship Analytics**, **Vouchers** visible in sidebar | ☐ |
| 4 | **Users / RBAC / Wipe** — not in nav; direct URL returns guard or 403 | ☐ |
| 5 | **Simulator** — not available | ☐ |
| 6 | **Vouchers** — page loads; empty state acceptable | ☐ |
| 7 | **Analytics** — sponsorship analytics page loads | ☐ |
| 8 | **Impersonation** — not available | ☐ |

**Role sign-off:** Tester ______________ Date ______________ ☐ GO ☐ NO-GO

---

## Live Map — prod smoke (optional, GLOBAL_OWNER)

Wymaga `ADMIN_PASS` w środowisku. Artefakty trafiają do `admin/audit-screenshots/` (nie commitować).

**Lokalnie:**

```bash
cd admin
ADMIN_PASS='<secret>' node scripts/smoke-live-map-prod.mjs
ADMIN_PASS='<secret>' node scripts/audit-webgl-live-map.mjs
```

**GitHub Actions (post-deploy gate):**

Workflow [`.github/workflows/live-map-prod-smoke.yml`](../../.github/workflows/live-map-prod-smoke.yml) — uruchamiany ręcznie (`workflow_dispatch`) lub automatycznie po udanym **SPORT Container Registry — Build & Push** na `main` / `master`. Brak sekretów → workflow **fail** (wymagane przed GO).

| Secret | Wymagane | Opis |
|--------|:--------:|------|
| `ADMIN_PASS` | tak | Hasło konta admin (np. GLOBAL_OWNER) |
| `ADMIN_URL` | tak* | URL prod admin, np. `https://admin-production-083b.up.railway.app` |
| `E2E_BASE_URL` | tak* | Alternatywa dla `ADMIN_URL` |
| `ADMIN_USER` | nie | Domyślnie `global_owner` |

\* Co najmniej jeden z `ADMIN_URL` / `E2E_BASE_URL`.

Artefakty smoke (screenshoty + JSON) są uploadowane jako GitHub Actions artifact `live-map-prod-smoke` (14 dni).

| # | Check | Pass |
|---|--------|:----:|
| L1 | Login prod → `/#/owner/analytics/live-map` ładuje mapę (`data-map-ready=true`) | ☐ |
| L2 | Badge sync **Live** lub **cached** + licznik `in view` > 0 przy aktywnym sim | ☐ |
| L3 | Zoom meso (z≈10) — klastry widoczne; mikro (z≥12) — ikony rowerzystów | ☐ |
| L4 | `webgl-e2e-audit.json` / smoke report — `renderedPoints` > 0 w mikro | ☐ |

---

## Quick API spot-checks (optional)

Run with tenant admin token (should fail):

```http
POST /api/users/impersonate/<athlete_id>/
→ 403 Forbidden
```

---

## After checklist

| Result | Next step |
|--------|-----------|
| **GO** (all roles) | Start P1 per [UI_AUDIT_2026-06-02.md](./UI_AUDIT_2026-06-02.md) §5 P1 |
| **NO-GO** | Log defects; fix P0 regressions; redeploy and re-run this checklist |
