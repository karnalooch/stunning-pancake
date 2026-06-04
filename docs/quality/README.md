# Jakość kodu — program monorepo 4VELO


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../pl/quality/README.md) |
| **canonical_path** | docs/quality/README.md |

---

| | |
|--|--|
| **Status** | Active |
| **Owner role** | Tech Lead |
| **Last reviewed** | 2026-06-04 |
| **SSOT standardów** | [CONSTITUTION.md §5](../CONSTITUTION.md#5-standardy-kodu) |
| **Contributing** | [CONTRIBUTING.md](../../CONTRIBUTING.md) |

Program **całego repozytorium** (nie tylko telemetry/ADR): backend, telemetry, admin, mobile, skrypty Python, dokumentacja, infrastruktura, shared tokens.

---

## Mapa monorepo

| Obszar | Ścieżka | Lint / format | Testy | CI job |
|--------|---------|---------------|-------|--------|
| **Backend** | `backend/` | Ruff check + format (`pyproject.toml`) | `manage.py test`, `run_pytest.py` | `backend` |
| **Telemetry** | `telemetry/` — `main.py` + `routes`, `ingest_service`, `db`, … | Ruff (extends backend) | `pytest` | `telemetry` |
| **Admin** | `admin/` | ESLint, `tsc --noEmit` | Playwright E2E | `admin`, `e2e`, `audit` |
| **Mobile** | `mobile/` | Expo lint (docelowo) | Jest | `mobile` |
| **Skrypty Python** | `scripts/*.py` | Ruff (root `pyproject.toml`) | — | `scripts-python` |
| **Dokumentacja** | `docs/` | `check_docs_links.py` | — | `docs` (workflow) |
| **Tokeny design** | `shared/tokens/` | `npm run tokens:check` | — | `repo-assets` |
| **Infrastruktura** | `infrastructure/`, `docker-compose*` | Review + Trivy | Manual / deploy | `trivy` |
| **Root** | `.env.example`, workflows | Env drift (`audit:env`) | — | `audit` |

---

## Fazy 0 → 5 (co robić w praktyce)

| Faza | Cel | Artefakt | Ten repo |
|------|-----|----------|----------|
| **0 Baseline** | Stan faktyczny vs Konstytucja | [BASELINE.md](./BASELINE.md) | `scripts/run-quality-baseline.ps1` |
| **1 Bramki CI** | Regresja łapana automatycznie | Zielony CI | `.github/workflows/ci.yml`, `docs.yml` |
| **2 Audyt tematyczny** | Czytelność ścieżek krytycznych | [BACKLOG.md](./BACKLOG.md) | Issues `quality-p*` |
| **3 Remediacja** | Małe PR-y, refaktor + testy | Kod | Patrz backlog P0 |
| **4 Review** | Checklista każdego PR | [PR_CHECKLIST.md](./PR_CHECKLIST.md) | Szablon GitHub |
| **5 Weryfikacja prod** | Dowód pod obciążeniem | [VERIFICATION.md](./VERIFICATION.md) | Runbooki operations |

**Zasada:** Faza 0–1 bez Fazy 3 = tylko pomiar. Faza 3 bez 1 = regresje wracają.

---

## Szybki start (lokalnie)

```powershell
# Cały monorepo — jeden skrypt (Faza 0)
.\scripts\run-quality-baseline.ps1

# Przed PR (minimum)
cd backend && ruff check . && ruff format --check .
cd telemetry && ruff check . && ruff format --check . && python -m pytest -q
cd admin && npm run lint && npx tsc --noEmit
cd mobile && npm test -- --ci
python scripts/check_docs_links.py
```

---

## Powiązane dokumenty

- [BASELINE.md](./BASELINE.md) — wyniki ostatniego przebiegu
- [BACKLOG.md](./BACKLOG.md) — P0/P1/P2 całego projektu
- [PR_CHECKLIST.md](./PR_CHECKLIST.md) — review
- [VERIFICATION.md](./VERIFICATION.md) — load/chaos/Railway
