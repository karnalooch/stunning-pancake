# SYSTEM ARCHITECTURE — MODEL C4 (v0.1.0-beta.2)


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../pl/diagrams/architecture_c4.md) |
| **canonical_path** | docs/diagrams/architecture_c4.md |

---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Tech Lead |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Architekci, nowi deweloperzy |

> Legenda: ✅ = deployed on production | ⚠️ = dev only | 📋 = planned  

**Powiązane:** [ARCHITECTURE.md](../ARCHITECTURE.md)

## 1. Context Diagram (Diagram Kontekstowy)
```mermaid
graph TD
    User((Sportowiec)) -->|Mobile App| MobileApp[Aplikacja SPORT Mobile ⚠️]
    Admin((Administrator)) -->|Admin Panel| AdminPanel[Panel Admina SPORT ✅]
    
    MobileApp -->|REST API| Backend[Rdzeń Systemu SPORT ✅]
    AdminPanel -->|REST API| Backend
    
    Backend -->|Map Data| OSM[OpenStreetMap]
    Backend -->|Route Validation| BRouter[Silnik BRouter ⚠️ dev]
    Backend -->|Payments| Stripe[Stripe API ⚠️ stub]
    Backend -->|Sync| Wearables[Garmin/Strava 📋 planned]
```

## 2. Container Diagram (Diagram Kontenerów)
```mermaid
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
```

## 3. Data Model (ERD) — Uproszczony
```mermaid
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
```

## 4. Deployment (Railway) — stan faktyczny

| Komponent | Port | Status |
|---|---|---|
| Django REST API | 8000 | ✅ `docker-backend-production-123c.up.railway.app` |
| FastAPI Telemetry | 8001 | ⚠️ Dev only, not on Railway |
| PostgreSQL | 5432 | ✅ Railway managed DB |
| Redis | 6379 | ✅ Railway managed |
| Celery Worker | — | ⚠️ Dev only |
| Celery Beat | — | ⚠️ Dev only |
| BRouter | 17777 | ✅ Osobny serwis Railway + Compose (`infrastructure/brouter`) |
| Celery simulation | — | ✅ `celery-worker-simulation`, kolejka `simulation` |
| Traccar | 8082 | ⚠️ Dev only (local docker) |
