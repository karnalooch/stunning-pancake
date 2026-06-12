# Dowód skali — jednostronicowy raport

| | |
|--|--|
| **Status** | Active |
| **Wersja** | 1.0 |
| **Data** | 2026-06-12 |
| **Owner** | Platform Operator |
| **Audience** | Decydent JST / HR / inwestor |
| **lang** | pl |
| **translation** | [English](../../en/operations/SCALE_PROOF_ONE_PAGER.md) |
| **canonical_path** | docs/gtm/pl/operations/SCALE_PROOF_ONE_PAGER.md |

---

## Werdykt (TL;DR)

| | |
|--|--|
| **Platforma** | 4VELO SPORT |
| **Zakres testów** | Symulacje 1k → 300k użytkowników, burst protection, global load guard |
| **Kontekst rynkowy** | Aktywne Miasta — awaria przy ~150k sesjach (2024) |
| **Wniosek** | Architektura gotowa na szczyt sezonu kampanii miejskiej/korporacyjnej przy warunkach operacyjnych poniżej |

---

## Tabela skali (tiers)

| Cel użytkowników | Miasta × users | Batch PG chunk | Live pool | Dysk (~) |
|------------------|----------------|----------------|-----------|----------|
| **1k** | ~3–10 × ~100–350 | 200–500 | Redis pełny | ~0,03 GB |
| **10k** | 10 × ~1k | 500–600 | Redis cap 50k | ~0,3 GB |
| **50k** | — | burst auto | Event burst + global guard | operacyjny target |
| **100k** | 10 × ~10k | 350–400 | DB sampling | ~3,3 GB |
| **300k** | 10 × ~30k | 100–250 | DB sampling | ~10 GB |

Źródło: [SCALE_TEST_300K.md](../../../pl/SCALE_TEST_300K.md). Preflight API: `GET /api/activities/admin/scale-preflight/?target_users=N`.

---

## Co testowaliśmy

| Obszar | Metoda | Wynik |
|--------|--------|-------|
| Batch seed użytkowników | `simulate_active_cities.py` do 300k | Sub-chunked bulk_create; adaptive PG batch |
| Live sim + routing | Celery + Redis backpressure | Stabilny drain ~1,3–1,8 s/trasa przy cap |
| Burst joins/sessions | `EVENT_BURST_MODE=auto` | 429 + Retry-After zamiast thundering herd |
| Global protection | `load_guard.py` always-on | Fail-open; caps 8k join/min, 20k ingest/s |
| Map pod obciążeniem | LOD H3/meso + micro markers | Bez random subsampling przy `LIVE_MAP_FULL_SCALE=1` |

---

## SLO (progi referencyjne)

Z `scripts/load/thresholds.json`:

| Tier | Ingest pos/s min | Map p95 max | Error rate max |
|------|------------------|-------------|----------------|
| smoke | 500 | 3000 ms | 5% |
| baseline | 5000 | 1000 ms | 1% |
| stress-50k | 45000 | 300 ms | 0,1% |
| soak 30 min | 10000 | 500 ms | 0,1% |

**[DO UZUPEŁNIENIA PO RUN]** — kontrolowany test 10k na staging: data runu ______, werdykt PASS/FAIL.

---

## Root cause fixes (lekcje z 300k na Railway)

| Problem | Fix |
|---------|-----|
| Postgres `No space left on device` przy bulk_create | PG batch 100–250; volume ≥10 GB |
| Celery tick OOM przy 300k SMEMBERS | DB sampling zamiast pełnej puli Redis |
| Redis live pool przy 90k rides | Cap + DB sampling ≥100k |

---

## Porównanie z rynkiem

| Platforma | Szczyt | Wynik |
|-----------|--------|-------|
| Aktywne Miasta | ~150k sesji | Awarie, utrata zaufania |
| 4VELO (architektura) | Test do 300k (batch) + 50k concurrent target | Burst + guard + symulator |

---

## Warunki operacyjne (checklist decydenta)

- [ ] Postgres ≥10 GB dla kampanii >50k uczestników
- [ ] Burst mode `auto` (domyślne — bez ręcznej konfiguracji w dniu eventu)
- [ ] Pushy rozłożone w czasie (nie jeden blast o 8:00)
- [ ] Platform Operator on-call w pierwszy weekend kampanii
- [ ] Runbook: [RSP_WEEKEND_RUNBOOK.md](./RSP_WEEKEND_RUNBOOK.md)

---

## Kontakt

Demo symulatora + preflight: `[KONTAKT_SALES]`  
Pełny runbook operacyjny: [gtm/README.md](../../README.md)

**Wersja dokumentu:** 1.0 · **2026-06-12**
