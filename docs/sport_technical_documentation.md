# Dokumentacja Techniczna Platformy SPORT

## 1. Wstęp i Misja
SPORT to nowoczesna platforma B2B/B2C zaprojektowana do gamifikacji aktywności fizycznej, zarządzania społecznościami sportowymi oraz precyzyjnej analizy telemetrii GPS w czasie rzeczywistym.

## 2. Architektura Systemu
System oparty jest na architekturze mikro-usługowej i konteneryzacji (Podman/Docker).

```mermaid
graph TD
    A[Mobile App - Flutter] -->|GPS Data / OSMand Prot.| B(Traccar Telemetry Server)
    A -->|REST API / JWT| C(Django Backend)
    B -->|Database Persistence| D[(PostGIS / PostgreSQL)]
    C -->|GIS Logic / RBAC| D
    C -->|Real-time Routing| E(BRouter Engine)
    C -->|Caching / Leaderboards| F[(Redis)]
    G[Admin Dashboard - React] -->|Monitoring / Analytics| C
    C -->|Alerts / Chat| H(Matrix E2EE)
    C -->|Payments| I(Stripe)
```

## 3. Przepływ Danych Telemetrycznych (Live Tracking)
```mermaid
sequenceDiagram
    participant S as Simulator / Mobile
    participant T as Traccar
    participant B as Django Backend
    participant R as Redis (Leaderboard)
    participant F as React Frontend

    S->>T: HTTP GET (OSMand Protocol)
    T->>T: Store Position
    F->>B: GET /api/activities/telemetry/live/ (Poll 3s)
    B->>T: GET /api/positions
    T-->>B: Current Positions JSON
    B->>B: Enrich with Device Metadata
    B-->>F: Response: Positions + Athlete Info
    F->>F: Render Map (MapLibre + Comet Trail)
```

## 4. Co już działa (Status Projektu)

### Backend (Django + GeoDjango)
- **Infrastruktura**: Pełny stack kontenerowy (DB, Redis, Traccar, BRouter).
- **Telemetria**: Integracja z Traccar, pobieranie pozycji live, mapowanie ID urządzeń na użytkowników.
- **Geospatial**: PostGIS skonfigurowany pod indeksy przestrzenne (GIST).
- **Privacy**: Automatyczne maskowanie punktów GPS w "Strefach Prywatności" użytkownika (Article 10).
- **Anti-Cheat**: Walidacja topologiczna tras przez BRouter (wykrywanie niemożliwych skrótów).
- **Auth**: JWT z rotacją tokenów + Social Auth (Google).

### Admin Dashboard (React + Vite)
- **Live Map**: Silnik MapLibre z płynnym renderowaniem "ogonów komet" (Canvas/GPU).
- **RBAC**: Interfejs dostosowujący się do roli (Global Admin vs Moderator).
- **Analytics**: Statystyki KPI, prędkości, aktywnych zawodników.

## 5. Backlog i Rozwój (Co zostało do zrobienia)

| Moduł | Status | Zadania |
| :--- | :--- | :--- |
| **Mobile App** | 🟡 In Progress | Implementacja logiki Background Tracking, Sync Manager (offline-first). |
| **Events Engine** | 🔴 Backlog | Modele `Event`, `Achievement`, system punktacji (Normalization Engine). |
| **Matrix Sync** | 🟡 In Progress | Auto-provisioning pokoi dla klubów sportowych. |
| **Voucher System** | 🟡 In Progress | Pełny marketplace POI (wymiana punktów na vouchery u sponsorów). |
| **CI/CD Hardening**| 🟢 Done | Skalowanie kontenerów, skanowanie bezpieczeństwa (Trivy). |

## 6. Stack Techniczny
- **Backend**: Python 3.11, Django 4.2, DRF, Celery.
- **Database**: PostgreSQL 15 + PostGIS 3.3.
- **Cache/Queue**: Redis 7.
- **Frontend**: TypeScript, React 18, Vite, MapLibre GL.
- **Mobile**: Flutter 3.x, Riverpod.
- **Telemetry**: Traccar 6.
- **Routing**: BRouter 1.7.
