# Document

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Zobacz dokument kanoniczny |
| **lang** | pl |
| **translation** | [English](../../diagrams/architecture_c4.md) |
| **canonical_path** | docs/pl/diagrams/architecture_c4.md |
---

| | |
|--|--|
| **Stan** | ✅Aktywny |
| **Rola właściciela** | Kierownik techniczny |
| **Ostatnia recenzja** | 2026-06-03 |
| **Publiczność** | Architekci, nowi deweloperzy |

> Legenda: ✅ = wdrożony na produkcji | ⚠️ = tylko deweloper | 📋 = zaplanowane  

**Powiązane:** [ARCHITECTURE.md](../ARCHITECTURE.md)

## 1. Diagram kontekstowy (Diagram Kontekstowy)```mermaid
graph TD
    User((Sportowiec)) -->|Mobile App| MobileApp[Aplikacja SPORT Mobile ⚠️]
    Admin((Administrator)) -->|Admin Panel| AdminPanel[Panel Admina SPORT ✅]
    
    MobileApp -->|REST API| Backend[Rdzeń Systemu SPORT ✅]
    AdminPanel -->|REST API| Backend
    
    Backend -->|Map Data| OSM[OpenStreetMap]
    Backend -->|Route Validation| BRouter[Silnik BRouter ⚠️ dev]
    Backend -->|Payments| Stripe[Stripe API ⚠️ stub]
    Backend -->|Sync| Wearables[Garmin/Strava 📋 planned]
```## 2. Container Diagram (Diagram Kontenerów)```mermaid
graph TB
    subgraph "Urządzenie Mobilne ⚠️ dev"
        App[React Native + Expo]
        DB_Local[(MMKV Storage)]
    end

    subgraph "Cloud Infrastructure"
        subgraph "Business Layer ✅"
            Django[Django REST API]
        end
        
        subgraph "Telemetry ⚠️ dev only"
            FastAPI[FastAPI Ingestion]
        end
        
        subgraph "Data Store ✅"
            Postgres[(PostgreSQL + PostGIS)]
            Redis[(Redis)]
        end
    end

    App -->|REST| Django
    Django --> Postgres
    Django --> Redis
    FastAPI --> Postgres
```## 3. Data Model (ERD) — Uproszczony```mermaid
erDiagram
    USER ||--o{ ACTIVITY : records
    USER {
        int id
        string username
        string role
        uuid tenant_id
    }
    TENANT ||--o{ USER : belongs_to
    TENANT {
        uuid id
        string name
        string primary_color
    }
    ACTIVITY {
        int id
        int user_id
        uuid tenant_id
        float distance
        float verification_score
    }
    POI ||--o{ VOUCHER : offers
    POI {
        int id
        uuid tenant_id
        string name
        point location
    }
    VOUCHER {
        int id
        int poi_id
        string code
        string discount_value
    }
```## 4. Rozmieszczenie (kolejowe) — stan faktyczny

| Komponent | Port | Stan |
|---|---|---|
| API REST Django | 8000 | ✅ `docker-backend-production-123c.up.railway.app` |
| Telemetria FastAPI | 8001 | ⚠️ Tylko Dev, nie na kolei |
| PostgreSQL | 5432 | ✅ Zarządzany koleją DB |
| Redis | 6379 | ✅ Zarządzana koleją |
| Pracownik Selera | — | ⚠️ Tylko deweloper |
| Selerowy Beat | — | ⚠️ Tylko deweloper |
| BRuter | 17777 | ✅ Osobny serwis Railway + Compose (`infrastruktura/brouter`) |
| Symulacja selera | — | ✅ `symulacja-selera`, kolejka `symulacja` |
| Tracar | 8082 | ⚠️ Tylko deweloperzy (lokalne okno dokowane) |
