# T73 scope note

This branch is intentionally stacked on `security/t72-delete-export-retention` while PR #110 is still open. Review T73 against that branch, not against `main`, so T72 lifecycle changes are not re-reviewed as part of the runtime-role/worker-context tranche.

T73 does not rotate owner secrets (T68), change the Android storage contract (T69), alter audit retention (T70), change log-redaction policy (T71), or implement the later critical-write idempotency inventory (T74).
