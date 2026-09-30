# Architecture documentation reconciliation — 2026-09-30

| | |
|--|--|
| **Status** | ✅ Completed reconciliation snapshot |
| **Document class** | SNAPSHOT |
| **Owner role** | Tech Lead / Documentation maintainer |
| **Audit date** | 2026-09-30 |
| **Baseline** | stacked on #391 / architecture red-team #389 |
| **Scope** | architecture/data-resilience documentation only |

## Purpose

This report records the documentation purge triggered by architecture red-team #389. It is evidence of the cleanup decision, not a new architecture SSOT.

Current authority lives in [ARCHITECTURE.md](../ARCHITECTURE.md), [C4 diagrams](../diagrams/architecture_c4.md), [DATA_RESILIENCE.md](../DATA_RESILIENCE.md) and the ADR/mobile authorities they reference.

## Classification

| Area/document | Decision | Reason |
|---|---|---|
| `docs/ARCHITECTURE.md` + PL | **REWRITE** | Previous diagram omitted Mobile → FastAPI, receipt/finalization flow and domain authority |
| `docs/diagrams/architecture_c4.md` + PL | **REWRITE** | Previous container view made Redis queue look like a generic telemetry authority and omitted durable ACK/finalization |
| `docs/DATA_RESILIENCE.md` + PL | **REWRITE** | Contained pre-receipt assumptions: Redis dedupe as sufficient truth, old `sync_path`-centric stop flow, missing route reconciliation |
| `docs/design/MOBILE_APPLICATION_ARCHITECTURE_V1.md` | **KEEP** | Normative current mobile dependency direction |
| `docs/design/MOBILE_RIDE_FLOW_V1.md` | **KEEP** | Normative Ride state/terminal-truth contract |
| `docs/quality/MOBILE_RUNTIME_ACCEPTANCE_V1.md` | **KEEP** | Exact-artifact/runtime acceptance authority |
| ADR 015 | **KEEP / authority** | Critical-data delete-safe ACK contract |
| ADR 011 | **KEEP WITH AMENDMENT** | Useful burst-load design history; ADR 015 wins on current receipt-backed ACK semantics |
| `DEPARTMENT_ARCHITECTURE.md` EN/PL | **ARCHIVE / SUPERSEDE** | Was a June implementation proposal incorrectly labeled Active architecture |
| `docs/archive/plans/DEPARTMENT_ARCHITECTURE_2026-06-03.md` | **KEEP HISTORICAL** | One canonical provenance copy of the superseded proposal |
| takeover compatibility stubs | **KEEP** | Already correctly redirect to archived evidence and preserve links/CI contracts |
| dated audits/reports/screenshots | **KEEP AS SNAPSHOT/EVIDENCE** | Old does not mean useless; directory/class already communicates non-SSOT status |
| `docs/assets/system_architecture.png` | **DELETE** | Unreferenced active artifact; archive manifest already documented it as removed legacy architecture art |

## Resulting system authority

```text
docs/ARCHITECTURE.md
  ├─ system/domain authority
  ├─ Activity / Tracking domain
  ├─ Django command/domain plane
  ├─ FastAPI ingest/live plane
  └─ PostgreSQL vs Redis authority

docs/diagrams/architecture_c4.md
  └─ visual container + durable ACK flows

docs/DATA_RESILIENCE.md
  └─ producer copy -> receipt-backed durable ACK -> finalization

ADR 015
  └─ critical ACK invariant

MOBILE_APPLICATION_ARCHITECTURE_V1 / MOBILE_RIDE_FLOW_V1
  └─ mobile dependency and lifecycle contracts
```

## Explicit non-deletions

The audit intentionally did **not** mass-delete:

- `docs/audits/`;
- `docs/reports/`;
- historical UI screenshots;
- takeover archives;
- old ADR rationale.

Those artifacts are useful evidence when their class/date is clear. Purge means removing competing truth, not erasing project history.

## Guard against recurrence

The active central architecture and data-resilience documents are added to the freshness SLA. Future changes to Activity/Tracking authority or durability must update the corresponding SSOT/ADR in the same change.

## Follow-up outside this docs-only tranche

Architecture red-team #389 still tracks runtime decisions that documentation must not pretend are already solved:

1. semantic Ride PAUSE/RESUME;
2. background live-delivery freshness SLO;
3. production fail-closed telemetry auth/signing authority;
4. any future qualification of Redis as a durable critical-data journal.
