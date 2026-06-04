# Document

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../DOCUMENTATION_STANDARDS.md) |
| **canonical_path** | docs/en/DOCUMENTATION_STANDARDS.md |
---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Tech Lead |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Runbook authors, operators, tech lead |

---

## Purpose

One consistent format for runbooks, specifications and indexes - easy review, audit and onboarding without duplication of content.

**Main Index:** [README.md](./README.md)

**Section indexes:**

| Section | Index |
|--------|--------|
| Operations | [operations/OPERATIONS_INDEX.md](./operations/OPERATIONS_INDEX.md) |
| Admin | [admin/ADMIN_INDEX.md](../admin/ADMIN_INDEX.md) |
| Compliance | [compliance/COMPLIANCE_INDEX.md](./compliance/COMPLIANCE_INDEX.md) |
| Reports | [reports/README.md](./reports/README.md) |

---

## Metadata (required at the top of the file)

Each **Active** document in `docs/` (except snapshots in `reports/` and `archive/`) should have a table:```markdown
| | |
|--|--|
| **Status** | ✅ Active \| 🚧 Draft \| 📦 Deprecated \| 📦 Snapshot |
| **Owner role** | np. Platform Operator (bez imion) |
| **Last reviewed** | YYYY-MM-DD |
| **Audience** | Kto czyta |
```Optional: **Purpose** (one sentence), link to SSOT.

---

## Required sections (runbook / operations)

Each runbook in `docs/operations/` and `docs/runbooks/`:

| Section | Content |
|--------|-----------|
| **Metadata** | Table above; language PL |
| **Target** | One sentence |
| **Audience** | Role - **no names** |
| **Prerequisites** | CLI, permissions, env **by name** |
| **Procedure** | Steps numbered; role at step |
| **Verification** | How to confirm success |
| **Rollback** | What to undo in case of failure?
| **Troubleshooting** | Symptom → cause → action |
| **Related** | SSOT Links |

Reference documents (`ARCHITECTURE.md`, `API.md`): metadata + **Purpose** + **Related** will be enough; full procedure only when the file is a runbook.

---

## Safety rules

- **Ban** tokens, passwords, `DATABASE_URL` with value in docs.
- References: `RAILWAY_API_TOKEN`, `SECRET_KEY`, `REDIS_URL` - only names and where to set (User env, Railway Variables).
- Local examples: `.env.railway.local.example` → `.env.railway.local` (gitignored).
- In screenshots: no PII and secrets - [assets/live/README.md](./assets/live/README.md).

---

## Single source of truth (SSOT)

| Subject | Canonical document |
|-------|---------------------|
| Railway Celery OOM / caps | [operations/RAILWAY_CELERY_MEMORY.md](./operations/RAILWAY_CELERY_MEMORY.md) |
| Product checklist + verification | [operations/RAILWAY_PRODUCTION_CHECKLIST.md](./operations/RAILWAY_PRODUCTION_CHECKLIST.md) |
| Verification script | `scripts/railway-verify-production.ps1` (description in checklist) |
| Worker `simulation` | [RAILWAY_CELERY_SIMULATION.md](./RAILWAY_CELERY_SIMULATION.md) |
| Railway vs K8s | [operations/RAILWAY_KUBERNETES.md](./operations/RAILWAY_KUBERNETES.md) |
| K8s manifestos | [operations/KUBERNETES.md](./operations/KUBERNETES.md) |
| Mobile GPS/release | [operations/MOBILE.md](./operations/MOBILE.md) |
| Simulator (ops) | [operations/SIMULATOR.md](./operations/SIMULATOR.md) |
| Simulator (spec) | [SIMULATOR_ARCHITECTURE.md](../SIMULATOR_ARCHITECTURE.md) |
| BRouter ops | [operations/BROUTER.md](./operations/BROUTER.md) |
| P1 admin roadmap | [admin/P1_ROADMAP.md](../admin/P1_ROADMAP.md) |
| P2 admin roadmap | [admin/P2_ROADMAP.md](../admin/P2_ROADMAP.md) |
| Post-deploy admin smoke | [admin/P0_SMOKE_CHECKLIST.md](../admin/P0_SMOKE_CHECKLIST.md) |
| Admin hub | [admin/README.md](../../admin/README.md) |
| Release legal gate | [compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md](../compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md) |
| RCP / GDPR | [compliance/RCP.md](./compliance/RCP.md) |
| env configuration (list) | [CONFIGURATION.md](./CONFIGURATION.md) + `.env.example` |
| RBAC | [RBAC.md](./RBAC.md) |
| Troubleshooting cross-cutting | [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) |
| Project constitution | [CONSTITUTION.md](./CONSTITUTION.md) (not [archive/CHARTER.md](../archive/CHARTER.md)) |

Other files **link**, do not duplicate full env tables.

---

## Snapshots and archive

| Type | Principle |
|-----|--------|
| `docs/reports/*_YYYY-MM-DD.md` | 📦 Snapshot - do not edit; new file on audit |
| `docs/archive/*` | 📦 Deprecated/historical - redirect banner at top |
| `docs/admin/UI_AUDIT_*.md` | 📦 UI Audit Snapshot |

---

## Naming and dates

- Files: `UPPER_SNAKE` for domain runbooks (`RAILWAY_*`, `P0_*`).
- Indexes: `*_INDEX.md` in section folder.
- **Last reviewed** updated when substantive content changes.

---

## Runbooks - Step Format```markdown
### 1. Przygotowanie (rola: Platform Operator)

1. Ustaw `RAILWAY_API_TOKEN` w Windows User env.
2. `railway link --project marvelous-gratitude --environment production`

### 2. Weryfikacja

1. `.\scripts\railway-verify-production.ps1`
2. Oczekiwany wynik: `PASS: all checks`

### Rollback (rola: Platform Operator)

1. Railway → Deployments → przywróć poprzedni deployment serwisu.
2. Przy OOM: obniż `SCALE_MAX_STARTS_PER_LIVE_TICK` — patrz RAILWAY_CELERY_MEMORY.
```---

## Language (EN + PL - enterprise)

Each **Active** document (except snapshots) ultimately has an **EN/PL pair** with a mirrored path in `docs/en/` and `docs/pl/`. ADR and API contracts remain **canonically in English**.

| Element | Where |
|---------|--------|
| Politics and phases of migration | [locales/STANDARD.pl.md](../locales/STANDARD.pl.md) · [STANDARD.en.md](../locales/STANDARD.en.md) |
| Status file by file | [locales/MIGRATION_REGISTRY.md](../locales/MIGRATION_REGISTRY.md) |
| EN/PL index | [en/README.md](../en/README.md) · [pl/README.md](../pl/README.md) |
| CI pairs | `python scripts/check_docs_i18n.py` |

| Folder (legacy) | Default language | Couple EN |
|-----------------|----------------|---------|
| `docs/operations/`, `docs/runbooks/` | Polish | `docs/en/operations/`, `docs/en/runbooks/` |
| `docs/admin/` | EN (checklists) + PL (roadmap) | `docs/pl/admin/` when needed |
| `docs/compliance/` | PL (RCP) / EN (release, map licensing) | according to register |
| `docs/product/`, `docs/onboarding/` | Polish | `docs/en/product/`, … |
| `docs/adr/`, `API.md`, architecture spec | English (canonical) | Optional summary PL |

Index abbreviation: [README.md § Language policy](./README.md#language-policy).

---

## After the change

1. Update **Last reviewed** in the changed file.
2. New runbook → entry in [operations/OPERATIONS_INDEX.md](./operations/OPERATIONS_INDEX.md) and [operations/README.md](./operations/README.md).
3. New admin/compliance document → appropriate `*_INDEX.md`.
4. [MAINTENANCE.md](./MAINTENANCE.md) + date in [README.md](./README.md).
5. Run `python scripts/check_docs_links.py`.
