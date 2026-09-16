# ADR 015: Critical-data acknowledgement and deletion safety

| | |
|---|---|
| **Status** | Accepted |
| **Decision date** | 2026-09-16 |
| **Owner role** | Tech Lead / Platform Operator |
| **Audience** | Mobile, backend, telemetry, platform, operations |
| **lang** | en |
| **translation** | [Polski](../pl/adr/015-critical-data-acknowledgement.md) |

**Related:** [ADR 011](./011-telemetry-ingest-durability-under-load.md) · [DATA_RESILIENCE](../DATA_RESILIENCE.md) · [Partial Takeover Pilot Plan](../PARTIAL_TAKEOVER_PILOT_PLAN.md)

## Context

4VELO records data whose silent loss or cross-user corruption would directly damage user trust: ride sessions, GPS tracks, profile/tenant state, membership/admin mutations, rewards/leaderboard credits, and deletion/export requests. The pilot therefore treats critical user and business data with the same engineering posture as financial-record systems: ambiguity is retried safely; success is never inferred from transport success alone; destructive local cleanup requires proof that another durable copy exists.

ADR 011 already requires a durable mobile outbox for telemetry. This ADR generalizes the acknowledgement rule into a project-wide invariant and removes an ambiguity that previously allowed an HTTP `2xx` or a volatile queue admission to be confused with durable acceptance.

## Decision

### 1. Project-wide ACK invariant

For **critical data**, an ACK means exactly:

> **The producer may now irreversibly delete its only local/retryable copy without creating a credible data-loss scenario.**

An endpoint, queue, worker, or client MUST NOT call a write acknowledged merely because:

- the request reached a process;
- validation passed;
- an in-memory queue accepted the item;
- a cache contains the item;
- a volatile Redis instance/stream accepted the item;
- an HTTP status is `200`, `201`, or `202`;
- a background task was scheduled.

Transport success and durable acknowledgement are separate concepts.

### 2. What may back an ACK

A critical write may be acknowledged only after one of the following is true:

1. **Canonical durable commit** — the data is committed to the canonical durable store and that commit completed successfully; or
2. **Durable journal commit** — the data is committed to a journal that has all of the following proven properties:
   - persistence across process/container restart;
   - persistence across host/service restart according to the target deployment contract;
   - replay/recovery procedure;
   - bounded retention that cannot silently trim unconsumed acknowledged entries;
   - monitored backlog / failed-delivery path;
   - inclusion in backup/recovery or an explicitly documented equivalent durability mechanism.

If any of those properties is unknown, the journal is **not** an ACK boundary.

For the pilot, direct telemetry ingest should therefore use **database-backed ACK** unless Redis Stream durability is explicitly configured and proven by restart/recovery testing. `XADD` into a Redis instance without proven persistence is queue admission, not a durable ACK.

### 3. ACK identity and coverage

Every ACK for a retryable critical operation MUST be bound to the operation it confirms.

For telemetry batches this means at minimum:

- matching `client_batch_id`;
- matching activity/user scope;
- complete point coverage (`inserted + deliberately privacy-dropped + already-durably-deduped` covers the submitted batch);
- no ACK for a different or partially persisted batch.

Equivalent correlation/idempotency identifiers are required for other retryable business writes where an ambiguous response could otherwise create duplication or loss.

### 4. Ambiguous outcome rule

Timeout, connection reset, process death, or missing/malformed ACK means **UNKNOWN**, not failure and not success.

The producer MUST retain its retryable copy and retry using an idempotent identifier. The consumer MUST make repeated delivery safe by using a database constraint, durable idempotency record, or another mechanism with equivalent guarantees.

A duplicate/replay response may be treated as acknowledged only when the consumer can prove the original operation reached a durable ACK boundary.

### 5. Delete-after-ACK rule

A client/outbox/worker MUST NOT delete the last retryable copy before a valid ACK.

State machines should make this explicit, e.g.:

`pending -> syncing -> acked -> eligible_for_delete`

A process restart during `syncing` MUST result in retry/recovery, not deletion.

### 6. Finalization is a commit barrier

A ride/session MUST NOT be presented as fully saved/finalized while critical child data is still pending unless the product explicitly presents a recoverable "saving/sync pending" state.

For ride recording:

1. stop/quiesce the GPS producer;
2. persist the final local state;
3. drain/retry all required telemetry batches to durable ACK;
4. reconcile/build the canonical activity route and derived data;
5. finalize the activity;
6. only then present durable completion.

If any step is incomplete, the state remains recoverable and visibly pending.

### 7. Critical-data scope

This invariant applies at least to:

- ride/session create and finalize;
- GPS/telemetry points and route reconstruction;
- tenant/profile identity changes that affect authorization scope;
- club/team membership and privileged admin mutations;
- rewards, leaderboard or balance-like credits;
- account deletion and data-export requests;
- billing/payment state if enabled later;
- any future operation where duplicate or missing writes can harm a user or alter authorization/accounting state.

Caches, render state and reproducible derived data may use weaker semantics only when the canonical source is proven complete and reconstruction is deterministic.

### 8. Scope binding

A durable ACK is valid only for the authenticated and authorized subject/object it represents. Correlation identifiers do not replace authorization.

Where applicable the receiver MUST validate user, tenant, activity/resource and audience/scope before persistence and acknowledgement.

### 9. Logging is not durability

Logs, analytics events, Sentry/Crashlytics events, metrics, Redis cache keys and UI success messages are never the canonical proof of persistence.

They may provide observability, but an ACK must be justified by the durable data path itself.

## Pilot acceptance tests

Before P6 pilot entry, the critical paths governed by this ADR must demonstrate at minimum:

- retry after timeout occurring after server commit but before response;
- retry after timeout occurring before server commit;
- process/container restart between persistence and response;
- duplicate delivery with no duplicate business effect;
- offline client restart with pending outbox retained;
- server restart while a batch is pending;
- finalization blocked while required child data is unacknowledged;
- cross-user/cross-tenant correlation-id replay rejected;
- backup/restore preserves the durable state used to justify ACK.

Tests requiring a real Android device or home-lab runtime remain `NOT RUN` until executed in that environment; code inspection is not evidence of runtime durability.

## Consequences

- Some endpoints may become slower because synchronous durable commit is preferred over early success during the pilot.
- High-throughput queueing remains allowed, but the queue must earn its place as an ACK boundary through explicit durability evidence.
- Retry/idempotency becomes part of the API contract, not an implementation detail.
- "Accepted" UI states must distinguish pending synchronization from durable completion.
- P3 Pilot Data Safety Audit is required before UI/panel polish can be treated as pilot readiness.
