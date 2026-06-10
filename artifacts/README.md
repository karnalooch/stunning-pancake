# Monorepo artifacts policy

| Location | Purpose | Committed? |
|----------|---------|------------|
| `reports/` | Security scans (bandit, npm-audit, detect-secrets), reliability playbooks output | Yes (summaries) |
| `admin/audit-screenshots/` | UI route/screen audit captures (`audit:screens`) | Yes |
| `admin/probe-screenshots/` | Live Map / probe smoke captures | Yes |
| `admin/e2e/live-map-zoom-snapshots/` | Playwright visual regression (Live Map) | Yes |
| `docs/admin/reports/` | Dated admin audit write-ups (markdown + JSON) | Yes |
| `scripts/load/reports/` | Load test output | No (gitignored) |
| `admin/test-results/` | Playwright run output | No (gitignored) |

**Rule:** New automated reports go to the closest existing home above. Do not add a fourth `reports/` tree without updating this file.
