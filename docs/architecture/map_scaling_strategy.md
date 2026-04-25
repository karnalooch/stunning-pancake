# MAP SCALING STRATEGY: Zero-Cost Sovereignty (Implemented)

This document outlines the map infrastructure strategy. The platform has successfully transitioned to a **Zero-Cost Sovereign** model early in development to ensure absolute commercial scalability.

## 1. Current Infrastructure (Zero-Cost)
*   **Engine**: **MapLibre SDK** (Mobile & Web).
*   **Tile Provider**: **OpenFreeMap** (via `tiles.openfreemap.org`).
*   **Cost**: **$0** (Zero licensing fees, zero usage-based billing).
*   **Scalability**: Supports 1,000,000+ users without financial friction.

## 2. Technical Implementation
- **Mobile**: Switched from `@rnmapbox/maps` to `@maplibre/maplibre-react-native`.
- **Web**: Standardized on `MapLibre GL JS`.
- **Zero-Key Architecture**: MapLibre is configured with `accessToken: null`, fetching tiles directly from open-source providers via standard vector protocols.

## 3. Future Proofing (The PMTiles Roadmap)
Should the platform require even more control (e.g. customized 3D terrain or offline regions at massive scale), the next step is self-hosting tiles via **PMTiles**:
- **Hosting**: Amazon S3 / Cloudflare R2 + Cloudflare Workers.
- **Data Source**: OpenStreetMap (OSM) processed via Planetiler.
- **Estimated Cost at 1M Users**: ~$150 - $500 (S3 storage & egress only).

## 4. 3D Infrastructure (Sovereignty Edition)

While MapLibre provides the **rendering engine**, high-fidelity 3D requires specific data pipelines.

### 4.1 3D Buildings (Extrusion)
- **Data Source**: OpenStreetMap (OSM) `building:levels` and `height` tags.
- **Pipeline**: Process OSM data via **Planetiler** into MVT (Mapbox Vector Tile) format.
- **Complexity**: Low. Mostly configuration of the tile schema.

### 4.2 3D Terrain (RGB Elevation)
- **Data Source**: SRTM (NASA) or EU-DEM (European Environment Agency).
- **Pipeline**: Use `rio-rgbify` to convert GeoTIFF elevation data into **Terrain-RGB** PNG tiles.
- **Rendering**: MapLibre consumes these tiles to generate real-time meshes for hills, mountains, and valleys.
- **Complexity**: Medium. Requires processing large raster datasets.

## 5. Comparison Table
| Feature | Mapbox (Legacy Plan) | MapLibre (Current) |
|:---|:---|:---|
| **Base Cost** | Usage-based (Free up to 25k MAU) | **Zero** |
| **Scaling Risk** | High financial friction | **None** |
| **Engine License** | Proprietary | **BSD-3-Clause (Open Source)** |
| **White-Label Readiness** | Requires client tokens | **Self-contained** |

---
*Status: ZERO-COST ARCHITECTURE IMPLEMENTED | Date: 2026-04-25*
