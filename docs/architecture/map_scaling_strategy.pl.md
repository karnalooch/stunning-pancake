# STRATEGIA SKALOWANIA MAPY: Suwerenność Zerowych Kosztów (Wdrożona)

Niniejszy dokument opisuje strategię infrastruktury mapowej. Platforma z powodzeniem przeszła na model **Suwerenności Zerowych Kosztów** (Zero-Cost Sovereign) na wczesnym etapie rozwoju, aby zapewnić pełną skalowalność komercyjną.

## 1. Obecna Infrastruktura (Zero-Cost)
*   **Silnik**: **MapLibre SDK** (Mobile i Web).
*   **Dostawca kafelków (Tiles)**: **OpenFreeMap** (via `tiles.openfreemap.org`).
*   **Koszt**: **$0** (Zero opłat licencyjnych, zero bilingu opartego na zużyciu).
*   **Skalowalność**: Obsługuje ponad 1 000 000 użytkowników bez tarć finansowych.

## 2. Implementacja Techniczna
- **Mobile**: Przejście z `@rnmapbox/maps` na `@maplibre/maplibre-react-native`.
- **Web**: Standaryzacja na `MapLibre GL JS`.
- **Architektura Zero-Key**: MapLibre jest skonfigurowane z `accessToken: null`, pobierając kafelki bezpośrednio od dostawców open-source poprzez standardowe protokoły wektorowe.

## 3. Zabezpieczenie na Przyszłość (Roadmapa PMTiles)
Jeśli platforma będzie wymagać jeszcze większej kontroli (np. niestandardowy teren 3D lub regiony offline przy ogromnej skali), następnym krokiem jest samodzielne hostowanie kafelków za pomocą **PMTiles**:
- **Hosting**: Amazon S3 / Cloudflare R2 + Cloudflare Workers.
- **Źródło danych**: OpenStreetMap (OSM) przetworzone przez Planetiler.
- **Szacowany koszt przy 1 mln użytkowników**: ok. $150 - $500 (tylko przechowywanie S3 i transfer wychodzący).

## 4. Infrastruktura 3D (Wersja Suwerenna)

Podczas gdy MapLibre zapewnia **silnik renderujący**, wysokiej jakości 3D wymaga specyficznych potoków danych.

### 4.1 Budynki 3D (Extrusion)
- **Źródło danych**: Tagi `building:levels` i `height` z OpenStreetMap (OSM).
- **Potok (Pipeline)**: Przetwarzanie danych OSM przez **Planetiler** do formatu MVT (Mapbox Vector Tile).
- **Złożoność**: Niska. Głównie konfiguracja schematu kafelków.

### 4.2 Teren 3D (Elewacja RGB)
- **Źródło danych**: SRTM (NASA) lub EU-DEM (Europejska Agencja Środowiska).
- **Potok (Pipeline)**: Użycie `rio-rgbify` do konwersji danych wysokościowych GeoTIFF na kafelki PNG **Terrain-RGB**.
- **Renderowanie**: MapLibre konsumuje te kafelki, aby generować siatki (meshes) wzgórz, gór i dolin w czasie rzeczywistym.
- **Złożoność**: Średnia. Wymaga przetwarzania dużych zbiorów danych rastrowych.

## 5. Tabela Porównawcza
| Cecha | Mapbox (Plan Legacy) | MapLibre (Obecnie) |
|:---|:---|:---|
| **Koszt bazowy** | Oparty na zużyciu (Darmowy do 25k MAU) | **Zero** |
| **Ryzyko skalowania** | Wysokie tarcie finansowe | **Brak** |
| **Licencja silnika** | Własnościowa (Proprietary) | **BSD-3-Clause (Open Source)** |
| **Gotowość na White-Label** | Wymaga tokenów klienta | **Samowystarczalny** |

---
*Status: ARCHITEKTURA ZERO-COST WDROŻONA | Data: 2026-04-25*
