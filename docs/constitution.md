# PROJECT CONSTITUTION: "SPORT"

## 1. Mission and Identity
A B2B/B2C sports platform built 100% on **Permissive Open Source** foundations and a rigorous **Safety Constitution** (AI Quality Standards). The project aims to provide advanced telemetry, gamification, and social tools while maintaining full commercial freedom (White-Label) without the risk of copyleft (GPL) infection.

## 2. Tech Canon (Permissive Stack)
Strictly selected components to ensure business security:
- **Telemetry Core**: Traccar (Apache 2.0).
- **Mobile Tracking**: OpenTracks (ISC).
- **Validation and Map-Matching**: BRouter (MIT).
- **Map Visualization**: MapLibre GL (BSD-2/MIT).
- **Communication**: Matrix (Apache 2.0).
- **Gamification**: Redis (BSD-3-Clause).
- **Interfaces**: Flutter (BSD-3).

## 3. Visual Vision (UX/UI Manifesto)
The interface must inspire trust and motivate activity.
- **Aesthetic**: Dark mode, glassmorphism, dynamic gradients.
- **Data Visualization**: High-performance vector maps, interactive telemetry charts.
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
### Offline-First Model
The mobile app treats the local database (SQLite) as the single source of truth during an activity. Synchronization with the server occurs asynchronously (batching), minimizing battery consumption.

### Anti-Cheat System
Every GPX track is topologically validated by the BRouter engine. The system detects GPS "drifting" and cheating attempts (e.g., driving a car instead of running) through physical parameter analysis and OpenStreetMap topology.

### Leaderboards and Gamification
The use of **Sorted Sets** in Redis allows for instantaneous recalculation of rankings for millions of users with minimal overhead.

## 5. Privacy and Security
- **Privacy Zones**: Dynamic track masking near sensitive locations (home, work).
- **E2EE**: End-to-end encryption via the Matrix protocol.
- **Anonymization**: Variable-radius vector clipping triangulation.

## 6. Operational Standards (AI Toolkit)
The project applies strict **[Safety Constitution](./ai_toolkit_constitution.md)** rules, including:
- Article I: Safety First (no data loss, no blind execution).
- Article VI: Repair Discipline (no dead code, immediate bug fixes).
- Planning before implementation and evidence-based verification before task completion.

## 7. Commercial Model
- **B2B (Corporate Wellness)**: SaaS model with full client branding.
- **B2C (Freemium)**: Advanced training plans and premium maps.
- **Sponsors POI**: Dynamic partner points on the map with a voucher system.

## 8. Internationalization (i18n)
- **Primary Language**: English (Code, Commits, Documentation).
- **User Interface**: Multi-language support (i18n) with **Polish** as the default locale.
