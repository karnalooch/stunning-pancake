# Map basemap licensing (admin)


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../pl/compliance/MAP_BASEMAP_LICENSING.md) |
| **canonical_path** | docs/compliance/MAP_BASEMAP_LICENSING.md |

---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Product / Legal |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Product, Legal |
| **Index** | [COMPLIANCE_INDEX.md](./COMPLIANCE_INDEX.md) |

## Provider in use

| Surface | Default style | Style URL |
|--------|----------------|-----------|
| Live map (`LiveMap.tsx`) | Positron (light) | `https://tiles.openfreemap.org/styles/positron` |
| Global heatmap (`GlobalHeatmap.tsx`) | Dark | `https://tiles.openfreemap.org/styles/dark` |

**Host:** [OpenFreeMap](https://openfreemap.org/) public tile instance (`tiles.openfreemap.org`).

**Why not CARTO basemaps:** CARTO’s hosted basemaps at `basemaps.cartocdn.com` are not licensed for unrestricted commercial production use in third-party apps without a CARTO agreement. We removed them from the admin panel.

## Commercial use

- **OpenFreeMap project:** MIT license; the site explicitly states [commercial usage is allowed](https://openfreemap.org/).
- **Map data:** OpenStreetMap under the [Open Database License (ODbL)](https://www.openstreetmap.org/copyright). ODbL permits commercial use with required attribution.
- **Style forks:** Derived from OpenMapTiles community styles (BSD-3-Clause code, CC BY 4.0 design where applicable). See [openfreemap-styles LICENSE.md](https://github.com/hyperknot/openfreemap-styles/blob/main/LICENSE.md).

No API key or paid plan is required for typical admin dashboard traffic on the public instance. There are no hard per-view caps documented; treat the service as best-effort community infrastructure and consider [GitHub Sponsors](https://github.com/sponsors/hyperknot) or self-hosting for heavy production load.

## Attribution (required)

MapLibre `AttributionControl` is enabled on admin maps with:

- OpenFreeMap (recommended credit)
- © OpenStreetMap (link to https://www.openstreetmap.org/copyright)

Style JSON from OpenFreeMap may add further credits (OpenMapTiles, etc.) automatically.

## Configuration overrides

Set at **admin build time** (Vite):

| Variable | Purpose |
|----------|---------|
| `VITE_MAP_STYLE_URL` | Override all admin basemaps |
| `VITE_MAP_STYLE_URL_LIGHT` | Override live map only |
| `VITE_MAP_STYLE_URL_DARK` | Override heatmap only |

Example (self-hosted or alternate compliant style):

```bash
VITE_MAP_STYLE_URL=https://tiles.example.com/styles/positron
```

Implementation: `admin/src/core/map/mapBasemap.ts`.

## Alternatives considered

| Provider | Commercial | MapLibre style URL | Notes |
|----------|------------|-------------------|--------|
| **OpenFreeMap** (chosen) | Yes (MIT + OSM) | Yes | Free, no API key |
| OSM France tiles | Check [usage policy](https://tile.openstreetmap.fr/) | Raster, not full vector style JSON | Better for tile layers than full admin basemap |
| MapLibre demo tiles | Demo only | Yes | Not for production |
| Protomaps | PMTiles / paid hosting options | Yes (custom) | API key / hosting for scale; document in env if adopted |
| `tile.openstreetmap.org` | OSM data yes; **tile CDN not for heavy commercial** | Raster | Use a proper tile provider instead |

## Review checklist (release)

- [ ] Admin maps load with attribution visible
- [ ] No `cartocdn.com` URLs in `admin/src`
- [ ] `VITE_MAP_STYLE_*` documented in `.env.example` if overrides used in staging/prod
- [ ] DPA / subprocessors list mentions OpenFreeMap if personal data could appear on map UI (usually none beyond public basemap)

## References

- https://openfreemap.org/
- https://github.com/hyperknot/openfreemap
- https://www.openstreetmap.org/copyright
- https://wiki.openstreetmap.org/wiki/Tile_usage_policy
