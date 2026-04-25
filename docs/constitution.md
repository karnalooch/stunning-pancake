# PROJECT CONSTITUTION: "SPORT"

## 0. Żelazne Zasady (Core Directives)
Te zasady są nadrzędne wobec wszystkich innych wytycznych technicznych i operacyjnych:
1.  **Silnik jest skończony**: Rdzeń systemu jest uznany za kompletny i stabilny. Ingerencje wymagające głębokich zmian architektonicznych są zabronione bez wyraźnej zgody Project Ownera. Priorytetem jest **optymalizacja** istniejących rozwiązań.
2.  **Zgodność z Prawem**: Cały projekt, od logiki backendu po interfejs użytkownika, musi być w 100% zgodny z obowiązującymi przepisami prawa (w szczególności RODO/GDPR oraz przepisami skarbowymi VAT OSS/JPK).
3.  **Prywatność i Bezpieczeństwo Ponad Wszystko**: Bezpieczeństwo transakcji finansowych (PCI DSS) oraz absolutna prywatność danych lokalizacyjnych użytkownika są priorytetem najwyższego rzędu. Każda funkcja musi być projektowana przez pryzmat *Privacy-by-Design*.

## 1. Mission and Identity
A B2B/B2C sports platform built 100% on **Permissive Open Source** foundations and a rigorous **Safety Constitution** (AI Quality Standards). The project aims to provide advanced telemetry, gamification, and social tools while maintaining full commercial freedom (White-Label) without the risk of copyleft (GPL) infection.

## 2. Tech Canon (Permissive Stack 2025/2026)
Strictly selected components to ensure business security and deliver an **Ultra-Modern 2025/2026** "WOW" factor:
- **Telemetry Core**: Traccar (Apache 2.0) — **pozycje przesyłane bezpośrednio do Redis (pub/sub), omijając HTTP**.
- **Mobile Framework**: **React Native 0.78+ (Expo)** + **Tamagui** (Zero-runtime UI compiler) for absolute top-tier performance.
- **Mobile Visuals**: **React Native Skia** for 120FPS hardware-accelerated UI, custom fluid gamification charts, and maps.
- **Mobile Sync**: **PowerSync** (Local-first SQLite syncing for ultimate offline-first reliability).
- **Admin Panel**: **Next.js 15 (React Server Components)** + **Tailwind v4** + **shadcn/ui** + **Tremor**.
- **Validation and Map-Matching**: BRouter (MIT).
- **Map Visualization (Mobile/Web)**: **Mapbox SDK** / **MapLibre** + **deck.gl** (for big-data WebGL rendering).
- **Mobile Monetization**: **RevenueCat** (IAP/Subscriptions).
- **Engagement & Analytics**: **OneSignal** (Push) + **UXCam** (User Journey).
- **Communication**: Matrix (Apache 2.0).
- **Gamification**: Redis (BSD-3-Clause) — Sorted Sets + Pipeline batch.
- **Feature Management**: **django-waffle** (feature flags for premium/experimentation).
- **Auth & Security**: **SimpleJWT** + **Djoser** (Backend), **NextAuth / Auth.js** (Admin).

## 3. Visual Vision (UX/UI Manifesto)
The interface must inspire trust, motivate activity, and drop jaws.
- **Aesthetic**: Dark mode, glassmorphism, dynamic Skia-rendered fluid gradients (Technical Blue), "Obsidian" aesthetics.
- **Data Visualization**: High-performance Mapbox 3D terrain, deck.gl data overlays, interactive telemetry charts via Skia (Mobile) and Tremor (Web).
- **Iconography**: Lucide-based geometric icons, custom assets via Recraft AI.
- **Onboarding**: Progressive disclosure, 3-minute Time-to-Value (TTV) flow, Passwordless (Passkeys).

- **Projects**: Management Panel (Admin Panel) as a command center with Live view.

### User Application (Android/iOS)
#### Active Session View
![User App Mockup](./assets/user_app_mockup.png)

#### Community and Clans (Matrix Chat)
![Community View](./assets/community_view_mockup.png)

#### Privacy Zones Configuration
![Privacy Zones](./assets/privacy_zones_mockup.png)

#### Rewards and Sponsors Marketplace
![Rewards Marketplace](./assets/rewards_marketplace_mockup.png)

### Management Panel (Web/Windows)
#### Main Dashboard
![Admin Panel Mockup](./assets/admin_panel_mockup.png)

#### Anti-Cheat Verification (Deep Dive)
![Anti-Cheat Detail](./assets/anticheat_detail_mockup.png)

#### City Analytics (Heatmaps)
![City Analytics](./assets/city_analytics_mockup.png)

## 4. System Architecture
### High-Level Architecture Overview
![System Architecture](./assets/system_architecture.png)

### Local-First Model (PowerSync/SQLite)
The mobile app treats the local SQLite database as the single source of truth. **PowerSync** provides an automatic background bidirectional stream with the server, ensuring immediate UI feedback, no loading spinners, and zero data loss regardless of connectivity.

### Anti-Cheat System (3-Layer Architecture)

Każda aktywność przechodzi przez trójwarstwowy filtr przed zapisem do bazy:

**Warstwa 1 — Fast Selection Gate** (`fast_rejection_gate`, O(N), zero I/O):
- **TELEPORT**: Skok GPS >500m między kolejnymi punktami → natychmiastowe odrzucenie.
- **ACCELERATION**: Przyspieszenie >6 m/s² → tramwaje, samochody, GPS spoof.
- **MOTOR FINGERPRINT**: Współczynnik zmienności prędkości CV<5% → nieludzka stałość (pojazd szynowy/drogowy).
- **STRAIGHT-LINE RATIO**: Przemieszczenie/dystans >92% → linia prosta = pojazd drogowy.

**Warstwa 2 — V-max Kinematic Check** (`analyze_anomalies`):
- Biomechaniczne progi prędkości per sport (RUN 12 m/s, BIKE 25 m/s, WALK 3.5 m/s).
- Odrzucenie przy >20% segmentów powyżej progu lub ≥3 kolejnych naruszeń.

**Warstwa 3 — BRouter Topological Validation** (wywoływana TYLKO jeśli warstwy 1+2 przeszły):
- Dopasowanie do siatki OSM, weryfikacja że trasa nie przecina barier fizycznych.
- Algorytm Viterbi HMM dla map matchingu.
