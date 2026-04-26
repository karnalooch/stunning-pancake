# ADR-0004: PostGIS for Geospatial Data over Flat Coordinate Columns

**Status**: Accepted  
**Date**: 2026-04-24  
**Author**: akarn  

---

## Context

The SPORT platform handles several geospatial data types:
- **GPS tracks** — LineString of up to 50,000 points per activity session
- **Privacy zones** — Point + radius circles (home/work masking, Constitution Article 10)
- **Event boundaries** — Polygon geofences for checkpoint events and city battles
- **Live positions** — Point updated every 5 metres from mobile clients

A naive approach stores coordinates as `FLOAT lat, FLOAT lon` columns and performs distance/intersection calculations in Python. This becomes a bottleneck at scale.

## Decision

We use **PostGIS extension on PostgreSQL 15** for all geospatial storage and queries.

Key model fields:
```python
# activities/models.py
route_path = models.LineStringField(srid=4326, null=True)  # GPS track
# activities/models.py — PrivacyZone
center = models.PointField(srid=4326)
# events/models.py
boundary = models.PolygonField(srid=4326, null=True)       # geofence
```

Spatial indexing:
```sql
-- Applied automatically by django.contrib.gis
CREATE INDEX ON activities_activity USING GIST (route_path);
CREATE INDEX ON activities_privacyzone USING GIST (center);
CREATE INDEX ON events_event USING GIST (boundary);
```

Performance optimisation — Douglas-Peucker simplification before storage:
```python
route_path = route_path.simplify(tolerance=0.00001, preserve_topology=True)
```

## Consequences

**Positive:**
- `ST_DWithin`, `ST_Intersects`, `ST_Contains` run in-DB — orders of magnitude faster than Python iteration.
- GIST indexes make geofence queries O(log n) instead of O(n).
- Privacy zone masking (`PrivacyService.mask_track`) leverages `ST_Distance` with EPSG:3857 metric projection natively.
- Douglas-Peucker reduces storage by ~60% with negligible visual loss.

**Negative:**
- GDAL/GEOS must be installed in the Docker image (adds ~80 MB to image size).
- PostGIS extensions must be enabled on DB creation (`CREATE EXTENSION postgis`).
- Local development on Windows requires GDAL DLL configuration.

## Alternatives Considered

| Option | Why Rejected |
|--------|-------------|
| Flat lat/lon FLOATs | No native spatial indexes; Python distance loops don't scale |
| MongoDB GeoJSON | Weaker consistency guarantees; no Django ORM for complex queries |
| ClickHouse (analytics) | Good for analytics aggregate reads; not viable for OLTP write path |
