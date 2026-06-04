# Document

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Zobacz dokument kanoniczny |
| **lang** | pl |
| **translation** | [English](../../compliance/MAP_BASEMAP_LICENSING.md) |
| **canonical_path** | docs/pl/compliance/MAP_BASEMAP_LICENSING.md |
---

| | |
|--|--|
| **Stan** | ✅Aktywny |
| **Rola właściciela** | Produkt / Informacje prawne |
| **Ostatnia recenzja** | 2026-06-03 |
| **Publiczność** | Produkt, Legalny |
| **Indeks** | [COMPLIANCE_INDEX.md](../../compliance/COMPLIANCE_INDEX.md) |

## Dostawca w użyciu

| Powierzchnia | Domyślny styl | Adres URL stylu |
|------------|----------------|---------------|
| Mapa na żywo (`LiveMap.tsx`) | Pozyton (światło) | `https://tiles.openfreemap.org/styles/positron` |
| Globalna mapa cieplna (`GlobalHeatmap.tsx`) | Ciemny | `https://tiles.openfreemap.org/styles/dark` |

**Host:** [OpenFreeMap](https://openfreemap.org/) publiczna instancja kafelka (`tiles.openfreemap.org`).

**Dlaczego nie mapy bazowe CARTO:** Mapy bazowe CARTO hostowane pod adresem `basemaps.cartocdn.com` nie są objęte licencją na nieograniczone komercyjne wykorzystanie w aplikacjach innych firm bez umowy CARTO. Usunęliśmy je z panelu administracyjnego.

## Użytek komercyjny

- **Projekt OpenFreeMap:** licencja MIT; witryna wyraźnie stwierdza, że ​​[dozwolone jest wykorzystanie komercyjne] (https://openfreemap.org/).
- **Dane mapy:** OpenStreetMap na podstawie [Licencji Open Database (ODbL)](https://www.openstreetmap.org/copyright). ODbL zezwala na wykorzystanie komercyjne pod warunkiem podania źródła.
- **Rozwidlenia stylów:** Pochodzą ze stylów społeczności OpenMapTiles (kod klauzuli BSD-3, projekt CC BY 4.0 tam, gdzie ma to zastosowanie). Zobacz [openfreemap-styles LICENSE.md](https://github.com/hyperknot/openfreemap-styles/blob/main/LICENSE.md).

Do typowego ruchu na panelu administracyjnym w instancji publicznej nie jest wymagany żaden klucz API ani płatny plan. Nie ma udokumentowanych żadnych stałych ograniczeń liczby obejrzeń; traktuj usługę jako infrastrukturę społecznościową najwyższej jakości i rozważ [Sponsorów GitHub](https://github.com/sponsors/hyperknot) lub własny hosting w przypadku dużego obciążenia produkcyjnego.

## Uznanie autorstwa (wymagane)

MapLibre `AttributionControl` jest włączone na mapach administracyjnych z:

- OpenFreeMap (zalecany kredyt)
- © OpenStreetMap (link do https://www.openstreetmap.org/copyright)

Styl JSON z OpenFreeMap może automatycznie dodawać kolejne napisy (OpenMapTiles itp.).

## Zastąpienie konfiguracji

Ustaw na **czas kompilacji administratora** (Vite):

| Zmienna | Cel |
|---------|---------|
| `VITE_MAP_STYLE_URL` | Zastąp wszystkie mapy bazowe administratora |
| `VITE_MAP_STYLE_URL_LIGHT` | Zastąp tylko mapę na żywo |
| `VITE_MAP_STYLE_URL_DARK` | Zastąp tylko mapę termiczną |

Przykład (styl hostowany samodzielnie lub zgodny z alternatywnym):```bash
VITE_MAP_STYLE_URL=https://tiles.example.com/styles/positron
```Implementacja: `admin/src/core/map/mapBasemap.ts`.

## Rozważane są alternatywy

| Dostawca | Komercyjne | Adres URL w stylu MapLibre | Notatki |
|---------|------------|--------------------------------|-------|
| **OpenFreeMap** (wybrane) | Tak (MIT + OSM) | Tak | Bezpłatnie, bez klucza API |
| Płytki OSM France | Sprawdź [politykę użytkowania](https://tile.openstreetmap.fr/) | Raster, a nie pełny styl wektorowy JSON | Lepsze dla warstw kafelków niż pełna mapa bazowa administratora |
| Kafelki demonstracyjne MapLibre | Tylko wersja demonstracyjna | Tak | Nie do produkcji |
| Protomapy | PMTiles / opcje płatnego hostingu | Tak (niestandardowe) | Klucz API/hosting dla skali; dokument w env jeśli został przyjęty |
| `tile.openstreetmap.org` | Dane OSM tak; **płytka CDN nie dla ciężkich reklam** | Rastrowe | Zamiast tego użyj odpowiedniego dostawcy kafelków |

## Lista kontrolna przeglądu (wydanie)

- [ ] Mapy administracyjne ładują się z widocznym przypisaniem
- [ ] Brak adresów URL `cartocdn.com` w `admin/src`
- [ ] `VITE_MAP_STYLE_*` udokumentowane w `.env.example`, jeśli zastąpienia są używane w stagingu/prod
- [ ] Lista DPA / podprocesorów wspomina o OpenFreeMap, jeśli dane osobowe mogą pojawić się w interfejsie mapy (zwykle żadne poza publiczną mapą bazową)

## Referencje

- https://openfreemap.org/
- https://github.com/hyperknot/openfreemap
- https://www.openstreetmap.org/copyright
- https://wiki.openstreetmap.org/wiki/Tile_usage_policy
