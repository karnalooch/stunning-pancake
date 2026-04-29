# SPECYFIKACJA API & STANDARDY TECHNICZNE

## 1. Standardy Komunikacji
- **REST API**: Django Rest Framework (DRF) dla danych relacyjnych.
- **Streaming**: WebSocket (FastAPI) dla Live-Ghost i telemetrii.
- **Wersjonowanie**: URL-based (np. `/api/v1/`).
- **Format**: JSON (MF-JSON dla danych OGC).

## 2. Modelowanie Danych Sportowych
Kluczowe encje i ich rola:
- **Athlete**: Tożsamość użytkownika, profil biomechaniczny.
- **Competition**: Wydarzenie z Geofencem i regułami punktacji.
- **Participation**: Relacja łącząca sportowca z wyzwaniem (Logika B2B).
- **Activity**: Ślad GPS zweryfikowany przez silnik Anti-Cheat.

## 3. Algorytmy i Formuły
- **Predykcja (Riegel)**: `T2 = T1 * (D2/D1)^1.06` (Bieg).
- **Obciążenie (ACWR)**: Stosunek obciążenia ostrego (7 dni) do chronicznego (28 dni).
- **Anti-Cheat (Warstwa 3)**: Viterbi HMM map-matching z topologią OSM.

## 4. OGC API — Moving Features
Wspieramy standard OGC dla wymiany danych przestrzennych:
- `GET /api/ogc/collections/{id}/items/` -> MF-JSON trajektorie.
