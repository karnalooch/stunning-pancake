# ADR 0001: Choice of Backend Framework and Database

## Status
Accepted

## Context
The "SPORT" platform requires a robust, scalable backend capable of handling:
1.  Complex business logic and user roles (B2B/B2C).
2.  Advanced geospatial data (GPS tracks, geofencing).
3.  High-performance real-time telemetry integration.
4.  Rapid development with built-in administrative tools.

## Decision
We have chosen **Django (Python)** as the primary web framework and **PostgreSQL with PostGIS** as the primary database.

### Rationale
- **Django**: Provides an out-of-the-box administrative panel, robust ORM, and advanced user role management. Its maturity and "batteries-included" philosophy reduce time-to-market.
- **PostGIS**: The industry standard for geospatial data. It allows for complex spatial queries (e.g., "is point in privacy zone?") directly in SQL with high efficiency.
- **Django REST Framework (DRF)**: Enables rapid development of clean, documented RESTful APIs.
- **Python Ecosystem**: Excellent support for data processing, AI/ML (future-proofing), and integration with external telemetry tools like Traccar.

## Consequences
- **Pros**: Fast development of the Admin/Moderator panels. Robust handling of GPS data via PostGIS. Strong security defaults.
- **Cons**: Slightly higher memory footprint compared to minimal frameworks like FastAPI (mitigated by containerization). Synchronous nature by default (handled via Celery/Redis for heavy tasks).

## Alternatives Considered
- **FastAPI**: Considered for high-performance telemetry, but rejected for the main application due to lack of a built-in admin panel and less mature ecosystem for complex B2B role management. (May be used as a microservice later if needed).
- **Node.js (NestJS)**: Strong alternative, but Python was preferred for its superior geospatial and data science libraries (GeoPandas, Shapely).
