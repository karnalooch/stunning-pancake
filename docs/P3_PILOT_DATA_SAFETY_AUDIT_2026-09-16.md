# 4VELO — P3 Pilot Data Safety Audit

**Date:** 2026-09-16  
**Scope:** evidence-driven pilot gate for critical user/business data  
**Baseline:** `main` at `a2fec0b816c318933e868b4f90eb3bead5ebdc08` plus explicitly identified open hardening PRs  
**Owner decision:** critical data is to be treated with financial-record-system rigor: no silent loss, no false success, no cross-user/tenant mix-up, and every destructive cleanup must be justified by durable evidence.

## 1. Precedence and stage numbering

This owner decision inserts an explicit data-safety gate before further pilot-readiness work. For execution order, this document supersedes the stage labels in `PARTIAL_TAKEOVER_PILOT_PLAN.md` dated 2026-09-14:

- **P3 — Pilot Data Safety Audit + remediation gate** (this document);
- previous **P3 mobile UI** becomes **P4**;
- previous **P4 panels and operations** becomes **P5**;
- previous **P5 pilot** becomes **P6**.

No prior work is discarded. UI work already completed remains valid; only pilot-readiness ordering changes. P6 cannot start while a P0/P1 data-safety blocker below remains unresolved or explicitly waived by a new owner decision with evidence.

The normative ACK rule is now ADR 015: `docs/adr/015-critical-data-acknowledgement.md`.

## 2. Audit method

Statuses are deliberately conservative:

- **PASS** — repository/CI/runtime evidence proves the stated property for the stated scope;
- **PARTIAL** — a meaningful control exists, but the required pilot scope is not fully covered;
- **FAIL** — code/design evidence shows the required property is currently violated;
- **UNKNOWN** — the property may be true, but evidence is missing; UNKNOWN is not pilot-safe;
- **NOT RUN** — requires a physical Android/home-lab/target deployment test not performed in this audit.

Severity:

- **P0** — credible data loss, wrong-user/tenant disclosure/corruption, false durable success, or unrecoverable secret/identity risk; blocks pilot immediately;
- **P1** — important confidentiality/integrity/recovery control absent or unproven; blocks pilot under the owner-approved high-assurance standard;
- **P2** — operational hardening that should be completed before expansion and preferably before pilot if inexpensive.

## 3. Executive verdict

**P3 verdict: BLOCKED — remediation required before pilot.**

The repository has several strong foundations: required aggregate CI, activity-scoped telemetry tokens, real PostgreSQL RLS on five key tables, SecureStore token storage, idempotent route/finalize work, home-lab backup tooling, and active GPS durability hardening. However, current evidence does not yet justify a “bank-like” data-safety claim.

The blockers are finite and concrete. The highest priority is not more UI work; it is closing the durable ACK boundary, making the canonical ride route reconstructable from persisted telemetry, proving full backup/restore integrity with measured RPO/RTO, and proving tenant isolation for every pilot-scope data path.

## 4. Gate matrix

| ID | Area | Status | Sev | Evidence / finding | Required before P6 |
|---|---|---:|---:|---|---|
| DS-001 | Project-wide ACK semantics | PASS | P0 | ADR 015 created in this P3 slice; defines delete-after-durable-ACK invariant | Keep as architecture contract and test it |
| DS-002 | Mobile GPS delete-after-ACK | PARTIAL | P0 | Open PR #94 hardens outbox retention, `seq`, exact buffer deletion, pending finalization and STOP race; not yet on `main` at audit baseline | Merge green #94, then device/runtime tests |
| DS-003 | Telemetry direct-mode ACK | PARTIAL | P0 | Open PR #95 changes direct ACK to occur after DB flush and durable dedupe marker; not yet on `main` at baseline | Merge green #95 and integration-test client → telemetry → DB |
| DS-004 | Redis Stream as ACK boundary | FAIL | P0 | Queue mode may ACK after `XADD`; current pilot/home compose has no demonstrated Redis AOF/volume durability. Queue admission is not durable ACK under ADR 015 | Pilot: force DB-backed direct ACK (`TELEMETRY_INGEST_QUEUE=0`) OR prove durable Redis persistence/replay/restart contract |
| DS-005 | Canonical route completeness | FAIL | P0 | `gps_points` can contain points already removed from mobile buffer while `Activity.route_path` is populated by `sync_path`; existing resilience docs explicitly admit no full reconciliation. GPX/export/anti-cheat consume `route_path` | Implement server reconciliation/rebuild of `route_path` from durable `gps_points`, with deterministic ordering and tests |
| DS-006 | Finalization barrier | PARTIAL | P0 | #94 adds honest pending-finalization and blocks success when upload/finalize incomplete; canonical-route barrier still not proven | Finalize only after required telemetry ACK + route reconciliation; verify offline/restart cases |
| DS-007 | Telemetry token subject/activity binding | PARTIAL | P0 | #89 provides short-lived `aud=telemetry` token; #95 adds `sub`/`activity_id` payload enforcement but remains open | Merge #95; enable required audience/scope in pilot env; negative replay tests |
| DS-008 | Pilot-scope tenant isolation | PARTIAL | P0 | T11/#83 proves FORCE RLS for five tables with real Postgres. PR itself lists unprotected tenant tables and missing Celery/management-command context | Produce pilot data-table inventory; cross-tenant API/worker tests; extend RLS/context for every pilot-critical path |
| DS-009 | Signing-key compromise closure | UNKNOWN | P0 | #93 removed committed signing-key field and added CI guard, but explicitly did not rotate/revoke any value that may have been active | Verify external persistent key; rotate/revoke previously exposed key if ever active; record evidence without secret value |
| DS-010 | Full backup/restore integrity | PASS | P0 | T57 real home-lab drill on 2026-09-18 restored a deterministic two-tenant business fixture into isolated `4velo_restore_check`; canonical snapshot digest/count invariants matched and restricted-runtime ORM/telemetry critical-path smoke passed. Evidence file: `p3-recovery-20260918-001137.json`. | Preserve the measured recovery evidence and keep restore regression tests green. |
| DS-011 | RPO / RTO | PASS | P0 | T57 real home-lab drill measured RPO **64.397 s** and RTO **4.344 s** on 2026-09-18; both satisfy the current plan targets of RPO 24 h / RTO 4 h. | Preserve the evidence and re-run on the exact release candidate in the final regression gate. |
| DS-012 | Android screen-off / kill / offline durability | NOT RUN | P0 | Requires real Android + home lab | Execute scripted failure matrix at home; zero silent loss / duplicate business effect |
| DS-013 | Auth token storage | PASS | P1 | Access/refresh tokens use Expo SecureStore / Android Keystore path; legacy MMKV token migration deletes legacy values | Device test availability/migration/logout; ensure production never uses memory fallback persistently |
| DS-014 | GPS data encryption at rest on phone | FAIL | P1 | GPS MMKV store has no repository evidence of an encryption key; search found no `encryptionKey` usage | Design Keystore/SecureStore-wrapped key or equivalent; verify background task works while device locked |
| DS-015 | Audit-log completeness | PARTIAL | P1 | `AuditLog` exists for impersonation/admin mutations with actor/target/tenant/details/IP/status/time. No proof all critical mutations use it | Enumerate critical admin/membership/account mutations and assert audit event coverage |
| DS-016 | Audit-log tamper resistance | UNKNOWN | P1 | Model is ordinary Django table; no append-only DB policy/permission evidence established in this audit | Restrict mutation/deletion, add integrity/append-only contract and tests; define retention |
| DS-017 | PII / GPS / secret log redaction | UNKNOWN | P1 | Some targeted code (e.g. webhook) redacts aggressively, but no repository-wide Sentry/Crashlytics/request-header scrub contract was found | Inventory log sinks; test canary secrets/tokens/GPS; add central redaction policy and CI/static regression tests |
| DS-018 | Account deletion completeness | PARTIAL | P1 | `UserDeleteView` and tests exist; risk map says telemetry/GPS deletion completeness is not confirmed | Define deletion/anonymization contract across Django, `gps_points`, exports, caches, backups; test end-to-end |
| DS-019 | User export completeness | PARTIAL | P1 | Export pipeline exists, but activity export follows `route_path`; divergence from `gps_points` can omit raw/canonical telemetry | Define export source; reconcile route first; test exported data against canonical records |
| DS-020 | GPS retention policy | UNKNOWN | P1 | Risk map reports no unified policy for `gps_points`; live-position retention does not prove raw GPS retention | Set explicit raw GPS/derived route/audit/backup retention and test scheduled enforcement |
| DS-021 | Critical-write idempotency inventory | PARTIAL | P1 | GPS batching/finalize have idempotency work; no project-wide proof for every critical mutation | Inventory create/finalize/membership/reward/admin/delete/export operations; add keys/constraints where ambiguous retry is possible |
| DS-022 | Database runtime-role hardening | PARTIAL | P1 | T11 notes a role with direct SQL can set GUCs and lists deployment-role hardening as follow-up | Separate least-privilege runtime/migration/admin roles or document equivalent control; test no SUPERUSER/BYPASSRLS |
| DS-023 | Worker tenant context | PARTIAL | P1 | T11 explicitly lists Celery/management-command GUC integration as follow-up | Prove every pilot-critical worker sets/clears tenant context or uses safely scoped queries |
| DS-024 | TLS / transport protection | UNKNOWN | P1 | Local pilot intentionally uses controlled cleartext exception; target production transport not proven by this repo-only audit | Verify target pilot topology, TLS termination, no unintended public cleartext ingest/API |
| DS-025 | Backup confidentiality | UNKNOWN | P1 | Backup mechanics exist; encryption/access/retention for backup artifacts not proven here | Define encrypted storage, access, retention, disposal and restore authorization |
| DS-026 | Chaos/restart durability | NOT RUN | P1 | No end-to-end fault-injection evidence for commit/response boundaries | Run restart/timeout matrix for mobile, telemetry, Redis (if used), DB and backend |
| DS-027 | Required CI / merge protection | PASS | P1 | `Aggregate CI gate` is required/strict and branch protection was validated by T22 follow-up | Keep; P3 remediation PRs must pass exact required gate |
| DS-028 | Runtime dependency HIGH/CRITICAL closure | UNKNOWN | P1 | Partial plan records outstanding Dependabot/security inventory work; open dependency PRs alone are not evidence | Classify runtime vs dev; no unresolved runtime HIGH/CRITICAL according to release policy |
| DS-029 | Release gate composition | PARTIAL | P1 | T58/home-lab release gate remains planned | Add P3 data-safety checks/evidence to release checklist; fail closed on missing evidence |
| DS-030 | Monitoring/recovery observability | PARTIAL | P2 | GPS pending/ACK state and queue metrics exist in pieces; no single pilot data-loss alarm contract | Define alerts for pending age, ACK failures, reconciliation mismatch, backup freshness/restore test age |

## 5. P0 remediation slices — required order

### P3-A — Land the mobile durability contract (#94)

Acceptance:

- branch synchronized with current `main`;
- Mobile CI + Aggregate + release/config checks green on the synchronized HEAD;
- outbox never drops unacknowledged batches;
- `seq` monotonic per activity across ACK/restart;
- exact point deletion only after matching ACK;
- STOP quiesces GPS producer before final snapshot;
- failed finalize remains pending/recoverable.

Physical Android scenarios remain NOT RUN until home testing.

### P3-B — Land the telemetry durable ACK/scope contract (#95)

Acceptance:

- strict batch schema;
- no pre-persistence dedupe ACK;
- direct-mode ACK after completed DB write;
- token `sub` and `activity_id` bound to payload;
- malformed/partial/mismatched ACK cannot clear client data;
- Telemetry CI + Aggregate green on current `main`.

### P3-C — Pilot telemetry durability mode

Small configuration/contract PR:

- default/explicit pilot configuration uses DB-backed direct ACK, not volatile Redis Stream ACK;
- `TELEMETRY_INGEST_QUEUE=0` for pilot unless Redis persistence is proven;
- tests assert pilot config cannot silently enable an unqualified volatile ACK boundary;
- runbook documents how queue mode can later become eligible after AOF/volume/replay/trim/DLQ evidence.

### P3-D — Canonical GPS route reconciliation

Server-side route reconstruction is required because `route_path` drives history, GPX/export and verification while raw durable points live in telemetry storage.

Acceptance:

- deterministic query by `activity_id`, ordered by `seq` then time with explicit tie/error policy;
- ownership/tenant scope enforced;
- builds/repairs `Activity.route_path` from durable points;
- idempotent rerun;
- detects missing/invalid sequence ranges and records a recoverable error rather than fabricating continuity;
- finalization/verification sequencing cannot certify a route before reconciliation succeeds;
- tests include already-ACKed early points + final mobile buffer points, retry, duplicates and privacy-dropped points.

### P3-E — Pilot tenant-isolation inventory and negative tests

Inventory every table/end point/worker reachable in the P6 path:

`auth -> profile/tenant -> session -> telemetry -> route/history/detail/export -> club/admin moderation`.

For every object, document ORM scope + RLS coverage + worker context. Add two-tenant negative tests for direct object IDs and mutations. Any pilot-critical cross-tenant path is P0.

### P3-F — Secret rotation proof

No secret value is committed to the report.

Acceptance:

- external secret store has persistent signing key(s);
- previously repository-exposed signing value is confirmed never-active or rotated/revoked;
- backend/telemetry agreement validated after rotation;
- evidence records only identifiers/timestamps, never secret material.

### P3-G — Business-integrity backup/restore + RPO/RTO

Use isolated synthetic data only.

Seed at minimum two tenants, users/roles, departments/membership, activities with PostGIS route, representative GPS points, audit records and any pilot-critical derived state. Record pre-backup counts/hashes/invariants. Restore into a fresh disposable target, then compare the same invariants.

Measure:

- backup age / recoverable point = RPO evidence;
- elapsed restore-to-working-critical-path = RTO evidence.

A database that merely starts or contains `django_migrations` is not a PASS.

## 6. P1 remediation slices after P0

The following may be grouped only when their scopes naturally share code; otherwise keep one responsibility per PR:

1. encrypted local GPS storage with real Android locked/background test;
2. append-only/tamper-resistant audit contract + critical-action coverage;
3. centralized PII/token/GPS logging redaction with canary tests;
4. delete/export/retention contract including telemetry and backups;
5. database runtime role + Celery/management tenant-context hardening;
6. project-wide critical-write idempotency inventory and fixes;
7. transport/TLS and backup-confidentiality verification;
8. chaos/fault-injection matrix;
9. P3 checks wired into the home-lab release gate.

## 7. Required home validation pack

These checks must remain `NOT RUN` until executed on the home Android + isolated home lab:

- start ride online -> screen off -> continue -> screen on -> route continuity;
- ride offline long enough for multiple batches -> STOP offline -> reconnect -> exact recovery;
- kill/relaunch while pending -> no loss, no duplicate route points;
- network cut immediately after server DB commit but before response -> idempotent retry and one business effect;
- network cut before commit -> retained outbox and eventual success;
- STOP while final Android location callback is arriving -> final point preserved or explicitly filtered, never silently raced away;
- telemetry process restart during request;
- Redis restart: pilot direct-DB mode remains safe; if queue mode is ever tested, acknowledged stream entries survive;
- backend restart around finalize;
- wrong activity/user token replay -> reject;
- user A/tenant A direct-ID access to user B/tenant B route/history/export/admin mutation -> reject;
- backup -> isolated destruction -> restore -> critical dataset invariants identical;
- visual UI confirms `sync pending` is not presented as durable success.

## 8. Evidence already worth preserving

- #83 provides real PostgreSQL RLS integration evidence for its five protected tables, including FORCE RLS and fail-closed GUC lifecycle. It also explicitly documents remaining role/worker/table scope gaps.
- #89 provides activity-scoped short-lived telemetry JWT and mobile usage, but audience enforcement requires rollout configuration.
- #93 removes a committed signing-key field and adds a source-control guard; rotation is still a separate operational obligation.
- #51 provides the isolated home-lab foundation. T57 runtime validation on 2026-09-18 now supplies P3-G business-integrity recovery evidence: encrypted backup, isolated restore, matching business snapshot/invariants, restricted-runtime critical-path smoke, RPO 64.397 s and RTO 4.344 s.
- #94 and #95 are active remediation work and must not be counted as PASS on `main` until merged and revalidated against current base.

## 9. Exit criteria for P3

P3 is complete only when:

- no **P0** row is FAIL/UNKNOWN/NOT RUN;
- no **P1** row is FAIL/UNKNOWN/NOT RUN unless the owner explicitly changes the pilot safety contract with documented rationale;
- Android/home-lab scenarios have attached evidence, not recollection;
- the exact candidate commit has required CI green;
- the release gate fails closed when required P3 evidence/configuration is absent;
- unresolved P2 items are documented with owner and follow-up.

Until then the correct status is **P3 BLOCKED — not ready for P6 pilot**.
