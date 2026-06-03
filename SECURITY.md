# Security Policy — 4VELO (SPORT Platform)

| | |
|--|--|
| **Status** | Active |
| **Owner role** | Security / Platform Lead |
| **Last reviewed** | 2026-06-03 |

---

## Reporting a vulnerability

If you discover a security issue, **do not** open a public GitHub issue with exploit details.

| Channel | Use |
|---------|-----|
| **Email** | `security@your-domain.example` — replace with your organisation’s security contact before production |
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
