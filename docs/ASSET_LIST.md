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

### Aplikacja Mobilna (`mobile/assets/`)
| Zasób | Opis | Lokalizacja / Plik | Format |
| :--- | :--- | :--- | :--- |
| **App Icon** | Główna ikona aplikacji (Gaming Style). | `mobile/assets/icon.png` | PNG |
| **Adaptive Icon** | Ikona adaptacyjna Android. | `mobile/assets/adaptive-icon.png` | PNG |
| **Splash Screen** | Ikona ekranu powitalnego. | `mobile/assets/splash-icon.png` | PNG |
| **HD-2D Navigation** | Ikony paska nawigacji (v3.0). | `mobile/assets/generated/nav_*.png` | PNG |
| **HD-2D Sprites** | Sprite'y zawodników (Runner, Cyclist, Ghost). | `mobile/assets/generated/*_sprite.png` | PNG |
| **HD-2D HUD** | Ikony statusu GPS, Heart Rate, Battery. | `mobile/assets/generated/hud_*.png` | PNG |

### Panel Administracyjny (`admin/public/`)
| Zasób | Opis | Lokalizacja / Plik | Format |
| :--- | :--- | :--- | :--- |
| **Favicon** | Ikona strony (Light Mode). | `admin/public/favicon.svg` | SVG |
| **UI Icons** | Ikony interfejsu panelu admina. | `admin/public/icons.svg` | SVG |

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

## 7. Rejestr Zasobów Wygenerowanych (HD-2D V3.0)
Zasoby wygenerowane za pomocą AI Toolkit, zoptymalizowane pod Solar Mode.

| Nazwa Pliku | Kategoria | Opis |
| :--- | :--- | :--- |
| `nav_home.png` | Navigation | Ekran Główny (Tawerna) |
| `nav_history.png` | Navigation | Historia Treningów (Stoper) |
| `nav_ranking.png` | Navigation | Rankingi (Podium) |
| `nav_rewards.png` | Navigation | Nagrody (Skrzynia) |
| `nav_profile.png` | Navigation | Profil Sportowca |
| `hud_heart.png` | HUD | Tętno (Pixel Heart) |
| `hud_gps.png` | HUD | Status sygnału GPS |
| `hud_battery.png` | HUD | Stan baterii |
| `runner_sprite.png`| Sprites | Zawodnik: Biegacz |
| `cyclist_sprite.png`| Sprites | Zawodnik: Rowerzysta |
| `ghost_sprite.png` | Sprites | Przeciwnik / Duch (Ghost Mode) |
| `elite_sprite.png` | Sprites | Zawodnik: Poziom Elitarny |
| `reward_trophy.png` | Rewards | Puchar / Trofeum |
| `icon_strava.png` | Systems | Integracja Strava |
| `icon_garmin.png` | Systems | Integracja Garmin |

---
*Rejestr zsynchronizowany z [VISUAL_MANIFESTO.md](./VISUAL_MANIFESTO.md) (Wersja 3.0).*
