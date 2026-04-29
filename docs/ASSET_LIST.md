# Rejestr Zasobów Projektowych (Comprehensive Asset List) — SPORT

Ten dokument stanowi kompletne zestawienie zasobów wizualnych, technicznych, strategicznych i operacyjnych projektu SPORT.

## 1. Tożsamość Wizualna i Branding (`assets/branding/`)
Fundament graficzny systemu, definiujący wygląd wszystkich platform (Admin, Mobile, Web).

| Zasób | Opis | Lokalizacja / Plik | Format |
| :--- | :--- | :--- | :--- |
| **Design Tokens** | Definicja kolorów, typografii i odstępów (w tym Solar Mode). | `assets/branding/design_tokens.json` | JSON |
| **Logo (Dark)** | Pełne logo dla ciemnych motywów. | `assets/branding/logo_full_dark.svg` | SVG |
| **Logo (Light)** | Pełne logo dla jasnych motywów. | `assets/branding/logo_full_light.svg` | SVG |
| **Sygnet** | Ikona logo (bez logotypu). | `assets/branding/logo_icon.svg` | SVG |
| **Minimal Logo** | Uproszczona wersja logo do małych rozmiarów. | `assets/branding/logo_minimal.svg` | SVG |

## 2. Zasoby Interfejsu i Media (UI/UX)
Ikony, sprite'y i zasoby natywne wykorzystywane bezpośrednio w kodzie aplikacji.

### Aplikacja Mobilna (`mobile/assets/`, `assets/mobile/`)
| Zasób | Opis | Lokalizacja / Plik | Format |
| :--- | :--- | :--- | :--- |
| **App Icon** | Główna ikona aplikacji mobilnej. | `mobile/assets/icon.png` | PNG |
| **Adaptive Icon** | Ikona adaptacyjna dla systemu Android. | `mobile/assets/adaptive-icon.png` | PNG |
| **Splash Screen** | Ikona ekranu powitalnego (Animated Pulse Splash). | `mobile/assets/splash-icon.png` | PNG |
| **Disciplines** | Ikony dyscyplin sportowych. | `assets/mobile/icons_disciplines.svg` | SVG |
| **Navigation** | Ikony paska nawigacji. | `assets/mobile/icons_navigation.svg` | SVG |
| **Stats** | Ikony statystyk i metryk. | `assets/mobile/icons_stats.svg` | SVG |

### Panel Administracyjny (`admin/public/`, `assets/admin/`)
| Zasób | Opis | Lokalizacja / Plik | Format |
| :--- | :--- | :--- | :--- |
| **Favicon** | Ikona strony dla panelu admina. | `admin/public/favicon.svg` | SVG |
| **UI Icons** | Ikony interfejsu panelu zarządczego. | `admin/public/icons.svg` | SVG |
| **Admin Sprite** | Specyficzne ikony administracyjne. | `assets/admin/icons_admin.svg` | SVG |

## 3. Wizualizacje Dokumentacyjne i Makiety (`docs/assets/`, `assets/*/mockups/`)
Zasoby wspierające zrozumienie architektury oraz prezentujące finalny design (High-Fidelity).

### Makiety Projektowe (Mockups)
| Kategoria | Opis | Lokalizacja |
| :--- | :--- | :--- |
| **Mobile UX** | Ekrany główne, Onboarding, Mapy, Premium. | `assets/mobile/mockups/` |
| **Admin UX** | Dashboardy, tabele, wizualizacje GIS. | `assets/admin/mockups/` |

### Wizualizacje Systemowe (`docs/assets/`)
| Zasób | Opis | Lokalizacja |
| :--- | :--- | :--- |
| **Architecture** | Diagramy architektury systemu. | `docs/assets/system_architecture.png` |
| **Live View** | Ekrany podglądu na żywo (Global, Tenant, Moderator). | `docs/assets/live/` |
| **Anti-Cheat** | Detale wizualne silnika anty-cheat. | `docs/assets/anticheat_detail_mockup.png` |
| **Analytics** | Wizualizacje analityki miejskiej i Battle Mode. | `docs/assets/city_analytics_mockup.png` |

## 4. Zasoby Strategiczne i Wiedza (`docs/`)
Kluczowe dokumenty definiujące kierunek rozwoju i zasady działania projektu.

| Dokument | Rola w projekcie |
| :--- | :--- |
| `docs/TECH_SPEC.md` | Specyfikacja techniczna i standardy API. |
| `docs/IMPLEMENTATION_PLAN.md` | Plan wdrożenia i kamienie milowe. |
| `docs/CHARTER.md` | Karta projektu i cele biznesowe. |
| `docs/SWOT_ANALYSIS.md` | Analiza mocnych i słabych stron. |
| `docs/compliance/RCP.md` | Rejestr czynności przetwarzania (RODO). |
| `HANDOVER.md` | Przewodnik przekazania projektu. |

## 5. Blueprinty Inżynieryjne i Konfiguracyjne
Zasoby definiujące infrastrukturę i zachowanie usług zewnętrznych.

| Kategoria | Opis | Lokalizacja |
| :--- | :--- | :--- |
| **Kubernetes** | Pliki Kustomization i manifesty bazowe. | `infrastructure/kubernetes/base/` |
| **Observability** | Konfiguracja Prometheusa i Grafany. | `infrastructure/observability/` |
| **Traccar** | Konfiguracja silnika śledzenia GPS. | `infrastructure/traccar/conf/traccar.xml` |
| **Deployment** | Schematy Railway.app dla backendu i telemetrii. | `*/railway.json` |

## 6. Zasoby Symulacyjne i Testowe (`infrastructure/simulators/`)
Skrypty i dane pozwalające na walidację wydajności i logiki biznesowej.

| Skrypt | Cel |
| :--- | :--- |
| `extreme_load_test.py` | Testy obciążeniowe Ingestion Engine. |
| `multi_athlete_sim.py` | Symulacja wielu zawodników na żywo. |
| `traccar_sim_v2.py` | Zaawansowana symulacja protokołu Traccar. |
| `scripts/simulate_grupetto.py` | Symulacja scenariusza "Grupetto Siedlce". |

## 7. Dane Funkcjonalne i Metadane
Zasoby definiujące strukturę wymiany danych.

| Zasób | Opis | Lokalizacja |
| :--- | :--- | :--- |
| **Sync Rules** | Reguły synchronizacji danych między usługami. | `backend/sync_rules.yaml` |
| **GeoJSON/MF-JSON** | Standardy trajektorii i Geofencing (w kodzie). | `backend/activities/ogc_views.py` |
| **QR Logic** | System identyfikacji zawodników. | `docs/compliance/RCP.md` |
| **Rewards Icons** | Ikony XP, voucherów i sponsorów (HD-2D). | `assets/mobile/icons_rewards_hd2d.svg` | SVG |
| **HUD Icons** | Status GPS, tętno (Pixel Heart), bateria (HD-2D). | `assets/mobile/icons_hud_hd2d.svg` | SVG |
| **Integrations** | Zpixelizowane logotypy Strava i Garmin. | `assets/mobile/icons_integrations_hd2d.svg` | SVG |
| **Sprite Library** | Biblioteka postaci sportowców (Runner, Cyclist, Ghost, Elite). | `assets/mobile/sprites_athletes_hd2d.svg` | SVG |
| **Asset Manifest** | Maszynowa mapa wszystkich zasobów projektu (JSON). | `docs/ASSET_MANIFEST.json` | JSON |
| **HD-2D Guide** | Szablony i wytyczne dla stylu HD-2D (outlines, kolory). | `assets/mobile/icons_hd2d_placeholders.svg` | SVG |
