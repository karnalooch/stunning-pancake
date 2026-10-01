# Security Policy — 4VELO (SPORT Platform)

| | |
|--|--|
| **Status** | Active |
| **Owner role** | Security / Platform Lead |
| **Last reviewed** | 2026-10-01 |

---

## Reporting a vulnerability

If you discover a security issue, **do not** open a public GitHub issue with exploit details.

| Channel | Use |
|---------|-----|
| **Email** | Set `SECURITY_CONTACT_EMAIL` in Railway / env and publish it here before any public release |
| **Scope** | Backend (Django), admin panel, mobile client, infrastructure configs, CI secrets handling |

Include: affected component, steps to reproduce, impact assessment, and optional proof-of-concept. We aim to acknowledge reports within **5 business days** and provide a remediation timeline when confirmed.

**Do not** include production credentials, API tokens, or personal data in reports.

---

## Supported versions

Security fixes are applied on the active development line. Older tags may not receive backports unless agreed under a support contract.

| Version / line | Support |
|----------------|---------|
| `main` (latest) | ✅ Active — security fixes and dependency updates |
| Tagged releases (`CHANGELOG.md`) | ✅ Until superseded by a newer release |
| Pre-release / feature branches | ⚠️ Best-effort only |

Current application version is tracked in root `package.json` and [CHANGELOG.md](./CHANGELOG.md).

---

## Dependency and supply-chain policy

| Area | Policy |
|------|--------|
| **Dependencies** | Pin or lock versions in repo (`package-lock.json`, `requirements.txt`, Docker base images). Review high/critical advisories before release. |
| **Secrets** | Never commit `.env`, tokens, or keys. Use platform secret stores (e.g. Railway variables). See [CONTRIBUTING.md](./CONTRIBUTING.md). |
| **CI** | Security-related checks in `.github/workflows/` (audit, docs link check). |
| **Third-party maps / OSS** | License and attribution: [docs/compliance/](./docs/compliance/) |

Run locally before release:

```powershell
cd backend; python run_tests.py
python scripts/check_docs_links.py
```

---

## Production startup authority

Production authentication is **mandatory**, not an optional rollout flag. The local/dev defaults do not authorize an unauthenticated production deployment.

- Django requires an explicit, nonblank `SECRET_KEY` whenever `DEBUG=0`, on PaaS as well as other hosts. The known development default is rejected. No key is generated at startup; an explicit key is preserved unchanged.
- Telemetry requires `TELEMETRY_INGEST_JWT_REQUIRED=1`, `TELEMETRY_INGEST_AUDIENCE_REQUIRED=1` and a usable `TELEMETRY_INGEST_JWT_SECRET` or shared `SECRET_KEY` on production/PaaS. Missing, blank and known development-default authority is rejected before database access, privacy loading or background workers.
- Production labels (`production`/`prod`) in Sentry/Railway environment markers are evaluated independently. Railway service/project/environment metadata, Heroku `DYNO` and Render metadata also enable the guard. `DEBUG`, `TELEMETRY_SKIP_DB` and `TELEMETRY_SKIP_BROADCAST` do not bypass telemetry startup security.
- Outside recognized production/PaaS environments, local/development flag behavior is unchanged. Other production hosts must explicitly identify the environment, for example with `SENTRY_ENVIRONMENT=production`; do not rely on an absent environment marker.
- Errors report setting names, never key values. A whitespace-only dedicated key is invalid; it is not silently replaced by the shared key.

### Operator rollout contract

Before deploying this change, configure the **effective service environment** in the platform's variables/secret store: persistent signing authority, both telemetry enforcement flags, and the canonical direct-persistence mode `TELEMETRY_INGEST_QUEUE=0`. Ensure Django's scoped-token issuer and telemetry verify against the same intended key. Clients must obtain activity-scoped telemetry tokens; ordinary Django access tokens are not a substitute.

`telemetry/railway.json` records the intended non-secret variable contract. Its legacy `variables` block is **not proof** that Railway injects those values or that the deployed environment matches Git. Check effective service configuration; the runtime guard is the final fail-closed authority. Never place a real key in this file.

A startup refusal after rollout is a configuration failure to resolve, not a reason to disable authentication or restore generated signing keys. Existing Home Lab flags already require JWT/audience/direct persistence and remain unchanged.

This code change does **not** perform a key rotation, revoke a previous value, or close T68. Follow the [signing-key runbook](docs/operations/SIGNING_KEY_ROTATION.md) and retain secret-free evidence for issue #343. Production release remains blocked until the real environment and remaining release evidence are verified.

Verification: `telemetry/test_production_security.py` exercises the actual lifespan with mocked external resources and checks fail-before-resource behavior; `backend/core/test_signing_authority.py` checks key resolution and early settings rejection. These tests are not a live deployment, database integration or device-acceptance proof.

---

## Compliance and privacy

Legal, GDPR (RODO), release gates, and map licensing are documented under **[docs/compliance/](./docs/compliance/)** ([COMPLIANCE_INDEX](./docs/compliance/COMPLIANCE_INDEX.md)).

Operational security runbooks: **[docs/runbooks/](./docs/runbooks/)** · **[docs/operations/](./docs/operations/)**.

---

## Safe disclosure

We support coordinated disclosure. Credit will be given in release notes when the reporter agrees and the issue is resolved.

---

## Documentation

| Resource | Link |
|----------|------|
| Contributing (no secrets in PRs) | [CONTRIBUTING.md](./CONTRIBUTING.md) |
| Documentation index | [docs/README.md](./docs/README.md) |
| RBAC | [docs/RBAC.md](./docs/RBAC.md) |
