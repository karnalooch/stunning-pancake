# Document

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../MAINTENANCE.md) |
| **canonical_path** | docs/en/MAINTENANCE.md |
---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Tech Lead / Platform Operator |
| **Last reviewed** | 2026-06-03 |

---

## Rules

1. **Single entry point:** [README.md](./README.md) - full tree + paths per role.
2. **Standard:** [DOCUMENTATION_STANDARDS.md](./DOCUMENTATION_STANDARDS.md).
2b. **Code quality (monorepo):** [quality/README.md](../quality/README.md) · baseline: `scripts/run-quality-baseline.ps1`.
3. **Section indexes:** [operations/OPERATIONS_INDEX.md](./operations/OPERATIONS_INDEX.md) · [admin/ADMIN_INDEX.md](../admin/ADMIN_INDEX.md) · [compliance/COMPLIANCE_INDEX.md](./compliance/COMPLIANCE_INDEX.md).
4. **Runbooks** - short steps in [operations/](./operations/); spec in the root / ADR.
5. **Reports** - snapshot; new file with date in [reports/](./reports/).
6. **After changing the simulator / BRouter / Railway workers** — SIMULATOR, BROUTER, `RAILWAY_*`, [TROUBLESHOOTING.md](./TROUBLESHOOTING.md), [CHANGELOG](../../CHANGELOG.md).

---

## Inventory (status 2026-06-03)

| Section | .md files (est.) | Latest enterprise review |
|--------|-------------------|-----------------------------|
| Root `docs/` | 18 | 2026-06-03 - metadata + SSOT links |
| `operations/` | 9 + README + INDEX | 2026-06-03 |
| `admin/` | 6 + README + ADMIN_INDEX | 2026-06-03 — P0 DONE, P1 1a done |
| `compliance/` | 4 + INDEX | 2026-06-03 |
| `adr/` | 10 | 2026-06-03 - metadata headers |
| `reports/` | 8 + README | Snapshot - No Content Editing |
| `archive/` | 5 + plans README | Deprecated banners |
| `onboarding/`, `product/` | 2 | 2026-06-03 |
| `runbooks/` | 1 | 2026-06-03 - db_recovery extended |
| `diagrams/`, `assets/` | 2 | 2026-06-03 |

**Total:** ~68 files in scope `check_docs_links.py` (no duplicate Windows paths).

---

## Product statuses (docs must match)

| Subject | Status in docs |
|-------|----------------|
| Admin P0 smoke | ✅ DONE - [P0_SMOKE_CHECKLIST](../admin/P0_SMOKE_CHECKLIST.md) |
| Admin P1 Package 1a | ✅ done - [P1_ROADMAP](../admin/P1_ROADMAP.md) |
| Admin P1 1b + Sponsor | 🚧 next |
| Railway verify script | ✅ - [RAILWAY_PRODUCTION_CHECKLIST](./operations/RAILWAY_PRODUCTION_CHECKLIST.md) |

---

## Known vulnerabilities (documentation backlog)

| Subject | Status |
|-------|--------|
| OpenAPI drift | Manually verifying `/api/docs/` after API changes |
| Live Map Screenshots | Optional `docs/assets/live/` after UI change |
| `plans/`, `.kilo/plans/` | Outside `docs/` - [archive/plans/README](../archive/plans/README.md) |
| Staging admin | None - deploy without staging (P1 §4) |

---

## Post-release checklist

- [ ] [CHANGELOG](../../CHANGELOG.md)
- [ ] Env / Railway → [RAILWAY_CELERY_SIMULATION.md](./RAILWAY_CELERY_SIMULATION.md) + operations
- [ ] Admin deploy → [P0_SMOKE_CHECKLIST.md](../admin/P0_SMOKE_CHECKLIST.md)
- [ ] Public release → [compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md](../compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md)
- [ ] **Last reviewed** in [README.md](./README.md)
- [ ] `python scripts/check_docs_links.py`
