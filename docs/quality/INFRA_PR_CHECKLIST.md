# Infrastructure PR checklist


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../pl/quality/INFRA_PR_CHECKLIST.md) |
| **canonical_path** | docs/quality/INFRA_PR_CHECKLIST.md |

---

Use when the diff touches `infrastructure/`, `docker-compose*`, `*/railway.json`, OSRM/BRouter scripts, or routing service images.

## Before merge

- [ ] **Secrets:** no tokens, DB passwords, or private URLs in git; `.env.example` updated only with placeholders
- [ ] **Health:** new services expose a health endpoint or documented `curl` probe
- [ ] **Volumes:** Postgres/Redis/OSRM data paths documented in `docs/operations/`
- [ ] **BRouter/OSRM:** profile or graph URL changes noted in [BROUTER.md](../operations/BROUTER.md) or OSRM runbook
- [ ] **Railway:** service names match `railway.json`; variables listed in `.env.example`
- [ ] **Rollback:** one-paragraph rollback in PR description (revert image tag / env var)
- [ ] **Load:** if routing capacity changes, link [TELEMETRY_LOAD_TEST.md](../operations/TELEMETRY_LOAD_TEST.md) or sim preflight notes

## Related docs

- [BROUTER.md](../operations/BROUTER.md)
- [ADR 011](../adr/011-telemetry-ingest-durability-under-load.md) — ingest under load
- [PR_CHECKLIST.md](./PR_CHECKLIST.md) — general quality gates
