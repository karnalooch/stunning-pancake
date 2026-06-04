# Pre-release Verification (single command + checklist)


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | pl |
| **translation** | [English](../../en/operations/PRE_RELEASE_VERIFICATION.md) |
| **canonical_path** | docs/pl/operations/PRE_RELEASE_VERIFICATION.md |

---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Release Manager |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Release Manager |
| **Compliance** | [COMPLIANCE_INDEX.md](../../compliance/COMPLIANCE_INDEX.md) |

Krótki runbook spinający CI, niezawodność i compliance przed wypuszczeniem release.

## 1) Single command (lokalny quick gate)

Uruchom z root repo:

```bash
python scripts/release/pre_release_check.py
```

To jest szybki "artifact gate" (sprawdza wymagane pliki release i k8s baseline).
Nie zastępuje pełnych testów CI.

## 2) CI reliability gate (wymagane)

Workflow: `.github/workflows/k8s-release-gate.yml`

Must-pass jobs:
- `Build/Test Baseline`
- `Docker Build/Publish Placeholder`
- `Kubernetes Manifest Validation` (`kubeconform`)
- `Reliability + Release Gate`

Deploy job:
- `Deploy Placeholder (Manual + Protected)` uruchamia się tylko przy ręcznym `workflow_dispatch` i wyborze `production`.
- Domyślnie kończy się błędem celowo, aby wymusić świadome uzupełnienie sekretów/auth/reviewerów.

## 3) Połączenie z reliability playbook

Przed release przejdź:
1. `docs/reports/RELIABILITY_AUDIT_PLAYBOOK.md` (must-pass matrix + Go/No-Go),
2. wyniki CI z workflow release gate,
3. checklistę legal/compliance:
   - `docs/compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md`.

## 4) Checklista operatora release (praktyczna)

- [ ] Wszystkie wymagane joby CI są zielone.
- [ ] Walidacja manifestów k8s (`kubeconform`) przeszła bez errorów.
- [ ] Reliability matrix i Go/No-Go z playbooka odhaczone.
- [ ] Legal/compliance checklist wypełniona i podpisana.
- [ ] Plan rollback i owner on-call potwierdzeni.
- [ ] Decyzja release owner: GO.

## 5) Co automatyczne vs manualne

Automatyczne:
- build/test baseline,
- budowa obrazów docker (bez publikacji),
- walidacja manifestów k8s,
- obecność krytycznych artefaktów release.

Manualne:
- faktyczna publikacja obrazów do rejestru,
- autentykacja do klastra i `kubectl apply`,
- podpis prawny/compliance oraz finalna decyzja GO/NO-GO.
