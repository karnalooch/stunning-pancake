# Security documentation

| | |
|--|--|
| **Status** | ✅ Active |
| **Document class** | REFERENCE / EVIDENCE |
| **Owner role** | Security / Platform maintainer |
| **Last reviewed** | 2026-09-28 |

Start with repository-level [SECURITY.md](../../SECURITY.md) for vulnerability reporting and supported policy.

## Active contracts

- [T70 audit log contract](T70_AUDIT_LOG_CONTRACT.md)
- [T71 log redaction](T71_LOG_REDACTION.md)
- [T72 data lifecycle contract](T72_DATA_LIFECYCLE_CONTRACT.md)
- [T73 runtime role / worker context](T73_RUNTIME_ROLE_WORKER_CONTEXT.md)
- [T74 critical write idempotency](T74_CRITICAL_WRITE_IDEMPOTENCY.md)
- [T75 transport / backup confidentiality](T75_TRANSPORT_BACKUP_CONFIDENTIALITY.md)
- [T76 Android Home Lab chaos](T76_ANDROID_HOME_LAB_CHAOS.md)

## Evidence / snapshots

- `PILOT_RELEASE_EVIDENCE.json` — machine-readable release evidence.
- [T28 dependency inventory (2026-09-28)](T28_SECURITY_DEPENDENCY_INVENTORY_2026-09-28.md) — dated inventory; do not treat it as an evergreen dependency list.