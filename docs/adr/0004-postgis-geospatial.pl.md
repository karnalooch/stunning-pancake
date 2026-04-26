# ADR-0004: PostGIS dla danych geoprzestrzennych zamiast płaskich kolumn współrzędnych

**Status**: Zaakceptowany  
**Data**: 2026-04-24  
**Autor**: akarn  

---

## Kontekst

Platforma SPORT obsługuje kilka typów danych geoprzestrzennych:
- **Ślady GPS** — LineString zawierający do 50 000 punktów na sesję aktywności.
- **Strefy prywatności** — Punkt + okręgi o promieniu (maskowanie domu/pracy, Artykuł 10 Konstytucji).
- **Granice wydarzeń** — Poligony geofencingowe dla wydarzeń z punktami kontrolnymi i bitew miejskich.
- **Pozycje na żywo** — Punkt aktualizowany co 5 metrów przez klientów mobilnych.

Naiwne podejście zakłada przechowywanie współrzędnych jako kolumn `FLOAT lat, FLOAT lon` i wykonywanie obliczeń odległości/przecięć w Pythonie. Przy dużej skali staje się to wąskim gardłem.

## Decyzja

Używamy rozszerzenia **PostGIS na PostgreSQL 15** dla wszystkich operacji przechowywania i zapytań geoprzestrzennych.

Kluczowe pola modeli:
```python
# activities/models.py
route_path = models.LineStringField(srid=4326, null=True)  # Ślad GPS
# activities/models.py — PrivacyZone
center = models.PointField(srid=4326)
# events/models.py
boundary = models.PolygonField(srid=4326, null=True)       # geofence
```

Indeksowanie przestrzenne:
```sql
-- Nakładane automatycznie przez django.contrib.gis
CREATE INDEX ON activities_activity USING GIST (route_path);
CREATE INDEX ON activities_privacyzone USING GIST (center);
CREATE INDEX ON events_event USING GIST (boundary);
```

Optymalizacja wydajności — uproszczenie Douglas-Peucker przed zapisem:
```python
route_path = route_path.simplify(tolerance=0.00001, preserve_topology=True)
```

## Konsekwencje

**Pozytywne:**
- `ST_DWithin`, `ST_Intersects`, `ST_Contains` działają wewnątrz bazy danych — o rzędy wielkości szybciej niż iteracja w Pythonie.
- Indeksy GIST sprawiają, że zapytania o geofencing mają złożoność O(log n) zamiast O(n).
- Maskowanie stref prywatności (`PrivacyService.mask_track`) wykorzystuje natywnie `ST_Distance` z odwzorowaniem metrycznym EPSG:3857.
- Douglas-Peucker redukuje zapotrzebowanie na miejsce o ~60% przy pomijalnej utracie wizualnej.

**Negatywne:**
- GDAL/GEOS muszą być zainstalowane w obrazie Dockera (dodaje ~80 MB do rozmiaru obrazu).
- Rozszerzenia PostGIS muszą być włączone przy tworzeniu bazy danych (`CREATE EXTENSION postgis`).
- Lokalny rozwój na Windows wymaga konfiguracji bibliotek DLL GDAL.

## Rozważane Alternatywy

| Opcja | Dlaczego odrzucona |
|-------|--------------------|
| Płaskie FLOATy lat/lon | Brak natywnych indeksów przestrzennych; pętle odległości w Pythonie nie skalują się |
| MongoDB GeoJSON | Słabsze gwarancje spójności; brak Django ORM dla złożonych zapytań |
| ClickHouse (analityka) | Dobry dla zagregowanych odczytów analitycznych; nie nadaje się dla ścieżki zapisu OLTP |
