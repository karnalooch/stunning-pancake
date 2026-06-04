# Document

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../../pl/operations/PRE_RELEASE_VERIFICATION.md) |
| **translation_status** | machine-translated |
| **canonical_path** | docs/en/operations/PRE_RELEASE_VERIFICATION.md |
---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Release Manager |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Release Manager |
| **Compliance** | [COMPLIANCE_INDEX.md](../compliance/COMPLIANCE_INDEX.md) |

A short runbook covering CI, reliability and compliance before the release.

## 1) Single command (local quick gate)

Run from root repo:```bash
python scripts/release/pre_release_check.py
```This is a quick "artifact gate" (checks required release and k8s baseline files).
It does not replace full CI testing.

## 2) CI reliability gate (required)

Workflow: `.github/workflows/k8s-release-gate.yml`

Must-pass jobs:
- `Build/Test Baseline`
- `Docker Build/Publish Placeholder`
- `Kubernetes Manifest Validation` (`kubeconform`)
- `Reliability + Release Gate`

Deploy job:
- `Deploy Placeholder (Manual + Protected)` only runs with manual `workflow_dispatch` and selecting `production`.
- Defaults to an error on purpose to force conscious completion of secrets/auth/reviewers.

## 3) Connection to reliability playbook

Before release go:
1. `docs/reports/RELIABILITY_AUDIT_PLAYBOOK.md` (must-pass matrix + Go/No-Go),
2. CI results from the workflow release gate,
3. legal/compliance checklist:
   - `docs/compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md`.

## 4) Release operator checklist (practical)

- [ ] All required CI jobs are green.
- [ ] Validation of k8s manifests (`kubeconform`) passed without errors.
- [ ] Reliability matrix and Go/No-Go from the playbook checked off.
- [ ] Legal/compliance checklist completed and signed.
- [ ] Rollback plan and owner on-call confirmed.
- [ ] Decision of release owner: GO.

## 5) Automatic vs manual

Automatic:
- build/test baseline,
- building docker images (without publication),
- validation of k8s manifests,
- presence of critical release artifacts.

Manual:
- actual publication of images to the register,
- cluster authentication and `kubectl apply`,
- legal/compliance signature and final GO/NO-GO decision.
