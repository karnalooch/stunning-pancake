# INWENTARZ TECHNICZNY (TECHNICAL INVENTORY) — SPORT

Ten dokument zawiera zestawienie zasobów inżynieryjnych, strategicznych i operacyjnych projektu, z wyłączeniem warstwy wizualnej (zdefiniowanej w [VISUAL_MANIFESTO.md](./VISUAL_MANIFESTO.md)).

## 1. Dokumentacja Strategiczna i Wiedza (`docs/`)
Kluczowe dokumenty definiujące cele biznesowe i zasady działania.

| Dokument | Rola w projekcie |
| :--- | :--- |
| `docs/TECH_SPEC.md` | Specyfikacja techniczna i standardy API. |
| `docs/IMPLEMENTATION_PLAN.md` | Plan wdrożenia i kamienie milowe. |
| `docs/CHARTER.md` | Karta projektu i cele biznesowe. |
| `docs/SWOT_ANALYSIS.md` | Analiza mocnych i słabych stron. |
| `docs/PLAN_TESTOWY_LLM_UPGRADE.md` | Plan testowy i dokumentacja wdrożenia LLM Coach + System Intelligence. |
| `docs/compliance/RCP.md` | Rejestr czynności przetwarzania (RODO). |
| `HANDOVER.md` | Przewodnik przekazania projektu. |

## 2. Inżynieria i Konfiguracja (Infrastructure)
Zasoby definiujące infrastrukturę i zachowanie usług.

| Kategoria | Opis | Lokalizacja |
| :--- | :--- | :--- |
| **Kubernetes** | Pliki Kustomization i manifesty bazowe. | `infrastructure/kubernetes/base/` |
| **Observability** | Konfiguracja Prometheusa i Grafany. | `infrastructure/observability/` |
| **Traccar** | Konfiguracja silnika śledzenia GPS. | `infrastructure/traccar/conf/traccar.xml` |
| **Deployment** | Schematy Railway.app dla backendu. | `*/railway.json` |

## 3. Silniki Symulacyjne i Testowe (`infrastructure/simulators/`)
Skrypty do walidacji wydajności i logiki biznesowej.

| Skrypt | Cel |
| :--- | :--- |
| `extreme_load_test.py` | Testy obciążeniowe Ingestion Engine. |
| `multi_athlete_sim.py` | Symulacja wielu zawodników na żywo. |
| `traccar_sim_v2.py` | Zaawansowana symulacja protokołu Traccar. |
| `scripts/simulate_grupetto.py` | Symulacja scenariusza "Grupetto Siedlce". |

## 4. Dane Funkcjonalne i Logika Biznesowa
| Zasób | Opis | Lokalizacja |
| :--- | :--- | :--- |
| **Sync Rules** | Reguły synchronizacji między usługami. | `backend/sync_rules.yaml` |
| **QR Engine** | System identyfikacji i check-pointów. | `mobile/src/screens/ProfileScreen.tsx` |

## 5. Serwisy LLM (v3.0 — 2026-04-30)
| Serwis | Opis | Lokalizacja |
| :--- | :--- | :--- |
| **LlmCoachService** | Generowanie wiadomości coachingowych przez LLM. Cache, circuit breaker, rate limiting, timeout 5s, fallback do szablonów statycznych. | `mobile/src/services/LlmCoachService.ts` |
| **AvatarTrainerService** | Mózg Inteligentnego Awatara-Trenera. Monitoruje dane sesji, wykrywa triggery, deleguje generowanie wiadomości do LLM z fallbackiem. | `mobile/src/services/AvatarTrainerService.ts` |
| **SystemIntelligence** | Panel AI Admina. Dynamiczne insighty analityczne generowane przez LLM (gpt-4o) z fallbackiem do danych demo. | `admin/src/modules/analytics/SystemIntelligence.tsx` |
| **TriggerEngine** | Scentralizowana kolejka priorytetowa wiadomości dialogowych. Cooldown 8s, dedup 60s. | `mobile/src/services/TriggerEngine.ts` |
| **Testy LLM** | Testy jednostkowe i integracyjne dla wszystkich serwisów LLM (6 plików, 40+ testów). | `mobile/__tests__/services/`, `admin/src/__tests__/` |

---
*Ostatnia aktualizacja: 2026-04-30. Zasoby wizualne przeniesiono do Visual Manifesto.*
