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

---
*Ostatnia aktualizacja: 2026-04-30. Zasoby wizualne przeniesiono do Visual Manifesto.*
