# Standard dokumentacji 4VELO


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | pl |
| **translation** | [English](../en/DOCUMENTATION_STANDARDS.md) |
| **canonical_path** | docs/pl/DOCUMENTATION_STANDARDS.md |

---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Tech Lead |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Autorzy runbooków, operatorzy, tech lead |

---

## Cel

Jeden spójny format dla runbooków, specyfikacji i indeksów — łatwy przegląd, audyt i onboarding bez duplikacji treści.

**Indeks główny:** [README.md](./README.md)

**Indeksy sekcji:**

| Sekcja | Indeks |
|--------|--------|
| Operacje | [operations/OPERATIONS_INDEX.md](./operations/OPERATIONS_INDEX.md) |
| Admin | [admin/ADMIN_INDEX.md](./admin/ADMIN_INDEX.md) |
| Compliance | [compliance/COMPLIANCE_INDEX.md](../compliance/COMPLIANCE_INDEX.md) |
| Raporty | [reports/README.md](../reports/README.md) |

---

## Metadane (wymagane na górze pliku)

Każdy dokument **Active** w `docs/` (poza snapshotami w `reports/` i `archive/`) powinien mieć tabelę:

```markdown
| | |
|--|--|
| **Status** | ✅ Active \| 🚧 Draft \| 📦 Deprecated \| 📦 Snapshot |
| **Owner role** | np. Platform Operator (bez imion) |
| **Last reviewed** | YYYY-MM-DD |
| **Audience** | Kto czyta |
```

Opcjonalnie: **Cel** (jedno zdanie), link do SSOT.

---

## Wymagane sekcje (runbook / operacje)

Każdy runbook w `docs/operations/` i `docs/runbooks/`:

| Sekcja | Zawartość |
|--------|-----------|
| **Metadane** | Tabela powyżej; język PL |
| **Cel** | Jedno zdanie |
| **Audience** | Rola — **bez imion** |
| **Wymagania wstępne** | CLI, uprawnienia, env **po nazwie** |
| **Procedura** | Kroki numerowane; rola przy kroku |
| **Weryfikacja** | Jak potwierdzić sukces |
| **Rollback** | Co cofnąć przy porażce |
| **Troubleshooting** | Objaw → przyczyna → akcja |
| **Powiązane** | Linki SSOT |

Dokumenty referencyjne (`ARCHITECTURE.md`, `API.md`): metadane + **Cel** + **Powiązane** wystarczą; pełna procedura tylko gdy plik jest runbookiem.

---

## Zasady bezpieczeństwa

- **Zakaz** tokenów, haseł, `DATABASE_URL` z wartością w docs.
- Referencje: `RAILWAY_API_TOKEN`, `SECRET_KEY`, `REDIS_URL` — tylko nazwy i gdzie ustawić (User env, Railway Variables).
- Przykłady lokalne: `.env.railway.local.example` → `.env.railway.local` (gitignored).
- Na zrzutach ekranu: brak PII i sekretów — [assets/live/README.md](../assets/live/README.md).

---

## Single source of truth (SSOT)

| Temat | Dokument kanoniczny |
|-------|---------------------|
| Railway Celery OOM / caps | [operations/RAILWAY_CELERY_MEMORY.md](./operations/RAILWAY_CELERY_MEMORY.md) |
| Checklist prod + weryfikacja | [operations/RAILWAY_PRODUCTION_CHECKLIST.md](./operations/RAILWAY_PRODUCTION_CHECKLIST.md) |
| Skrypt weryfikacji | `scripts/railway-verify-production.ps1` (opis w checklist) |
| Worker `simulation` | [RAILWAY_CELERY_SIMULATION.md](./RAILWAY_CELERY_SIMULATION.md) |
| Railway vs K8s | [operations/RAILWAY_KUBERNETES.md](./operations/RAILWAY_KUBERNETES.md) |
| Manifesty K8s | [operations/KUBERNETES.md](./operations/KUBERNETES.md) |
| Mobile GPS / release | [operations/MOBILE.md](./operations/MOBILE.md) |
| Symulator (ops) | [operations/SIMULATOR.md](./operations/SIMULATOR.md) |
| Symulator (spec) | [SIMULATOR_ARCHITECTURE.md](./SIMULATOR_ARCHITECTURE.md) |
| BRouter ops | [operations/BROUTER.md](./operations/BROUTER.md) |
| P1 admin roadmap | [admin/P1_ROADMAP.md](./admin/P1_ROADMAP.md) |
| P2 admin roadmap | [admin/P2_ROADMAP.md](./admin/P2_ROADMAP.md) |
| Post-deploy admin smoke | [admin/P0_SMOKE_CHECKLIST.md](./admin/P0_SMOKE_CHECKLIST.md) |
| Admin hub | [admin/README.md](./admin/README.md) |
| Release legal gate | [compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md](../compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md) |
| RCP / RODO | [compliance/RCP.md](../compliance/RCP.md) |
| Konfiguracja env (lista) | [CONFIGURATION.md](./CONFIGURATION.md) + `.env.example` |
| RBAC | [RBAC.md](./RBAC.md) |
| Troubleshooting cross-cutting | [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) |
| Konstytucja projektu | [CONSTITUTION.md](./CONSTITUTION.md) (nie [archive/CHARTER.md](../archive/CHARTER.md)) |

Inne pliki **linkują**, nie duplikują pełnych tabel env.

---

## Snapshoty i archiwum

| Typ | Zasada |
|-----|--------|
| `docs/reports/*_YYYY-MM-DD.md` | 📦 Snapshot — nie edytować; nowy plik przy audycie |
| `docs/archive/*` | 📦 Deprecated / historyczne — banner redirect u góry |
| `docs/admin/UI_AUDIT_*.md` | 📦 Snapshot audytu UI |

---

## Nazewnictwo i daty

- Pliki: `UPPER_SNAKE` dla runbooków domenowych (`RAILWAY_*`, `P0_*`).
- Indeksy: `*_INDEX.md` w folderze sekcji.
- **Last reviewed** aktualizować przy merytorycznej zmianie treści.

---

## Runbooki — format kroków

```markdown
### 1. Przygotowanie (rola: Platform Operator)

1. Ustaw `RAILWAY_API_TOKEN` w Windows User env.
2. `railway link --project marvelous-gratitude --environment production`

### 2. Weryfikacja

1. `.\scripts\railway-verify-production.ps1`
2. Oczekiwany wynik: `PASS: all checks`

### Rollback (rola: Platform Operator)

1. Railway → Deployments → przywróć poprzedni deployment serwisu.
2. Przy OOM: obniż `SCALE_MAX_STARTS_PER_LIVE_TICK` — patrz RAILWAY_CELERY_MEMORY.
```

---

## Język (EN + PL — enterprise)

Każdy dokument **Active** (poza snapshotami) docelowo ma **parę** EN/PL ze zwierciadlaną ścieżką w `docs/en/` i `docs/pl/`. ADR i kontrakty API pozostają **kanonicznie po angielsku**.

| Element | Gdzie |
|---------|--------|
| Polityka i fazy migracji | [locales/STANDARD.pl.md](../locales/STANDARD.pl.md) · [STANDARD.en.md](../locales/STANDARD.en.md) |
| Status plik po pliku | [locales/MIGRATION_REGISTRY.md](../locales/MIGRATION_REGISTRY.md) |
| Indeks EN / PL | [en/README.md](../en/README.md) · [pl/README.md](./README.md) |
| CI par | `python scripts/check_docs_i18n.py` |

| Ścieżka | Kanoniczny PL | Para EN | Uwagi |
|---------|---------------|---------|--------|
| `docs/pl/operations/`, `docs/pl/runbooks/` | ✅ | `docs/en/…` | Faza 2 — edycja tutaj |
| `docs/operations/`, `docs/runbooks/` (legacy) | stub redirect | linki w stubie | Nie edytować treści |
| `docs/admin/` | EN (checklisty) + PL (roadmap) | `docs/pl/admin/` gdy potrzebne |
| `docs/compliance/` | PL (RCP) / EN (release, map licensing) | wg rejestru |
| `docs/product/`, `docs/onboarding/` | Polski | `docs/en/product/`, … |
| `docs/adr/`, `API.md`, spec architektury | Angielski (kanoniczny) | Opcjonalne streszczenie PL |

**Metadane pary (P0 runbooki):** `translation_status` = `reviewed` \| `machine-translated`; opcjonalnie `translation_reviewed` (ISO data). CI wymaga `reviewed` na P0 ops — patrz `scripts/check_docs_i18n.py`.

Skrót indeksu: [README.md § Polityka językowa](./README.md#polityka-językowa).

---

## Po zmianie

1. Zaktualizuj **Last reviewed** w zmienionym pliku.
2. Nowy runbook → wpis w [operations/OPERATIONS_INDEX.md](./operations/OPERATIONS_INDEX.md) i [operations/README.md](./operations/README.md).
3. Nowy dokument admin/compliance → odpowiedni `*_INDEX.md`.
4. [MAINTENANCE.md](./MAINTENANCE.md) + data w [README.md](./README.md).
5. Uruchom `python scripts/check_docs_links.py`.
