# PLAN IMPLEMENTACJI (IMPLEMENTATION PLAN) — SPORT Gold Master v2.1

## 1. Strategia Etapowa (Phased Rollout)
Projekt realizowany jest w modelu przyrostowym, gdzie każda kolejna faza buduje na stabilnym fundamencie poprzedniej.

### Faza 1: Fundament i Inwestia (ZAKOŃCZONE)
- **Cel**: Stabilny potok danych i izolacja najemców.
- **Kluczowe**: TimescaleDB Hypertables, PostgreSQL RLS, FastAPI Ingestion.

### Faza 2: Portal Owner (Nowoczesny Light Mode) (STABILNE)
- **Cel**: Zarządzanie ekosystemem B2B2C.
- **Kluczowe**: Vite 6, React 19, Tremor Analytics, Shard Management.

### Faza 3: Silnik Mobilny (Hyper-Performance) (ZAKOŃCZONE)
- **Cel**: Doświadczenie 120FPS i Solar-Ready UI.
- **Kluczowe**: React Native Bridgeless, Skia, Tamagui, Legend-State.

### Faza 4: Ekosystem i Integracje (ZAKOŃCZONE / REWORK V3.0 W TOKU)
- **Cel**: Otwarcie na zewnętrzne API i sprzęt wearable oraz wdrożenie manifestu wizualnego V3.0 (zobacz [VISUAL_MANIFESTO.md](./VISUAL_MANIFESTO.md)).
- **Kluczowe**: 
  - [x] **Immersyjny Onboarding Experience**:
    - [x] Animated Pulse Splash.
    - [x] Permissions Step (GPS/Motion).
    - [x] Integrations Hub (One-Tap Strava/Garmin).
    - [x] Data Validation (Biometria).
    - [x] QR Identity Generation.
  - [x] **Solar-Ready HD-2D UI (Mobile Gaming Aesthetic)**:
    - [x] Stylistyka retro-gamingowa inspirowana *Metal Slug*, *Dave the Diver*, *Octopath Traveler*.
    - [x] 1px Black Outlines (Sprite-style) i Pixel Art.
    - [x] High-Noon Contrast (12:1 ratio) dla trybu Solar Mode.
  - [x] **Live-Ghost**: WebSocket Ingestion z Geofiltrowaniem (Real-time Privacy Zones).
  - [x] **Wearable Hub**: Integracja z Strava & Garmin (Sync Engine).
  - [x] **Stripe Connect**: Logika wypłat Express dla sportowców.

### Faza 5: AI i Autonomia (PLANOWANE)
- **Cel**: Proaktywna inteligencja.
- **Kluczowe**: AI Predictive Coach (ACWR), Autonomiczne Klastry Miejskie.

## 2. Metryki Sukcesu (Definition of Done)
- **Techniczne**: Pokrycie testami >80%, brak błędów krytycznych w Sentry, latencja API <50ms (P95).
- **Produktowe**: Onboarding < 3 minuty, stabilne 60 FPS w HUD.
- **Biznesowe**: Poprawna separacja danych najemców (RLS Audit).

## 3. Kamienie Milowe (Milestones)
- **M1**: Stabilne Ingestion (10k RPS).
- **M2**: Certyfikacja Anti-Cheat (Warstwy 1-4).
- **M3**: Launch "Grupetto Siedlce" (Pilot B2B).
- **M4**: Publiczne API / SDK.
