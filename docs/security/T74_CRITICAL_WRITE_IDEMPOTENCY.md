# T74 — critical-write idempotency contract

T74 reviews pilot-critical writes for the commit/response-cut case: the server may commit a write while the client, worker, or operator does not observe the response and retries. The invariant is **one user intent must not create two business effects**.

## Inventory

| Write path | Retry contract | T74 result |
| --- | --- | --- |
| Activity/session create | Mobile persists the start intent before the request. Backend derives a stable request identity from `start_time` when no explicit `client_request_id` is supplied. `(user, client_request_id)` is unique in PostgreSQL. Reusing an explicit id for a different type/time/tenant fails with `idempotency_conflict`. | Hardened in T74. |
| Activity finalize | `POST .../finalize/` returns the already-finalized activity when `end_time` is present; the first durable finalization is protected by the T63 receipt/reconciliation barrier. | Existing contract retained. |
| Route sync | Client path hash + canonical merge prevent a repeated path submission from appending the same route as a new business effect. | Existing contract retained. |
| Telemetry ingest | Point/batch identity and durable telemetry receipts from T60–T63 own this contract. | Existing contract retained; not reimplemented here. |
| Event membership | `join_event()` first returns an existing participation and ultimately uses `get_or_create(event, user)`. | Existing idempotent state transition. |
| Club membership | `join_club` uses `get_or_create(club, user)`; repeated join resolves to the same membership. | Existing idempotent state transition. |
| Admin single-user update / tenant config | PUT/PATCH set the requested final state. A retry may append another audit observation, but it does not create a second account, role assignment, tenant assignment, or status transition. Audit rows remain append-only evidence rather than a spend/issuance effect. | Reviewed; no extra key needed for pilot. |
| Admin bulk status/role | Workers apply a desired final value. A repeated operator submission can create a separate operational job, but the underlying user state is set-to-value rather than increment/decrement. | Reviewed; no duplicate financial/data-loss effect. Operational job dedupe is not a pilot data-safety blocker. |
| Account delete | First DELETE performs the T72 lifecycle cleanup; a retry after the resource is gone returns not-found and cannot delete a second user. | Existing terminal-state idempotency. |
| User data export | Concurrent/lost-response retries for the same user coalesce onto one non-expired PENDING/READY export. Creation is serialized on the user row and task dispatch happens only after commit. | Hardened in T74. |
| Activity points award | User row is locked, the ledger is rechecked, and PostgreSQL enforces one `(user, ACTIVITY_VERIFIED, activity:<id>)` critical effect. | Hardened in T74. |
| Voucher redemption | Request must carry a stable `Idempotency-Key`. User balance decisions are serialized; the assigned voucher stores the request id; PostgreSQL protects both redemption request identity and the critical spend ledger effect. Same-key replay returns the original voucher. | Hardened in T74. |

## Database boundaries added by T74

- `activities_activity_user_client_request_unique` — at most one Activity for a user/request identity.
- `rewards_voucher_user_pool_request_unique` — at most one voucher assignment for a user/pool/redemption intent.
- `rewards_ledger_critical_effect_unique` — at most one critical activity-credit or voucher-spend ledger effect for the same user/reason/reference.

These constraints are the final race boundary; application-side `exists()` checks alone are not treated as sufficient proof.

## Mobile durability boundary

`createSessionWithDurability()` now stores the pending session **before** sending the create request. If the process dies after the database commit but before the response is observed, recovery retries the same `start_time`, so the server resolves the retry to the same Activity.

Voucher redemption sends an `Idempotency-Key` on the request. The optional key argument on `RewardsService.redeemVoucher` allows a caller/retry layer to retain the same user-intent identity across an explicit retry.

## Blocking evidence

Focused T74 cases cover:

- same session-start retry -> one Activity;
- same explicit request id with different payload -> conflict, not silent replay;
- same voucher redemption key -> one voucher + one points spend;
- missing voucher idempotency key -> fail closed;
- repeated activity points award -> one credit;
- repeated active export request -> one export job and one task dispatch.

The existing backend CI focused test list already executes `activities/test_gpx_export.py`, `rewards/test_pools.py`, and `users/test_export.py`; T74 blocking assertions are included in those files so failure makes the Backend job and therefore `Aggregate CI gate` fail.

## Scope boundary

T74 is about duplicate business effects caused by retries. It does not replace T72 deletion/retention semantics, T73 tenant/runtime-role enforcement, T75 transport/backup confidentiality, or T76 physical Android/home-lab failure testing.
