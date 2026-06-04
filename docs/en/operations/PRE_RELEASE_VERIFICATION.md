# Pre-release verification

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/PRE_RELEASE_VERIFICATION.md) |
| **translation_status** | reviewed |
| **translation_reviewed** | 2026-06-04 |
| **canonical_path** | docs/en/operations/PRE_RELEASE_VERIFICATION.md |

---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Release Manager |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Release Manager |
| **Compliance** | [COMPLIANCE_INDEX.md](../compliance/COMPLIANCE_INDEX.md) |

Short runbook for CI, reliability, and compliance before a release.

## 1) Single command (local quick gate)

Run from the repository root:

```bash
python scripts/release/pre_release_check.py
```

This is a quick artifact gate (required release and k8s baseline files).
It does not replace full CI testing.

## 2) CI reliability gate (required)

Workflow: `.github/workflows/k8s-release-gate.yml`

Must-pass jobs:

- `Build/Test Baseline`
- `Docker Build/Publish Placeholder`
- `Kubernetes Manifest Validation` (`kubeconform`)
- `Reliability + Release Gate`

Deploy job:

- `Deploy Placeholder (Manual + Protected)` runs only with manual `workflow_dispatch` and `production` selected.
- Defaults to failure on purpose to force secrets/auth/reviewer completion.

## 3) Reliability playbook connection

Before release go:

1. `docs/reports/RELIABILITY_AUDIT_PLAYBOOK.md` (must-pass matrix + Go/No-Go),
2. CI results from the release-gate workflow,
3. legal/compliance checklist: `docs/compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md`.

## 4) Release operator checklist (practical)

- [ ] All required CI jobs are green.
- [ ] k8s manifest validation (`kubeconform`) passed without errors.
- [ ] Reliability matrix and Go/No-Go from the playbook checked off.
- [ ] Legal/compliance checklist completed and signed.
- [ ] Rollback plan and on-call owner confirmed.
- [ ] Release owner decision: GO.

## 5) Automatic vs manual

Automatic:

- build/test baseline,
- Docker image build (without publication),
- k8s manifest validation,
- presence of critical release artifacts.

Manual:

- actual image publication to the registry,
- cluster authentication and `kubectl apply`,
- legal/compliance sign-off and final GO/NO-GO.
