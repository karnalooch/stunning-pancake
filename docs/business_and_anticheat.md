# MODEL BIZNESOWY I LOGIKA ANTI-CHEAT

## 1. Strategie Monetyzacji (Commercialization Paths)
Dzięki architekturze White-Label, platforma może być oferowana w wielu modelach:

### B2B: Corporate Wellness
- **Produkt**: Zamknięta platforma dla pracowników firmy.
- **Wartość**: Integracja zespołu, poprawa zdrowia, branding firmowy.
- **Technologia**: Izolacja danych przez Traccar Groups, customowe mapy POI z lokalizacjami biur.

### B2G: Aktywne Miasta / Samorządy
- **Produkt**: Oficjalna aplikacja miejska do rywalizacji sportowej.
- **Wartość**: Promocja regionu, dane dla planowania infrastruktury rowerowej.
- **Technologia**: Globalne leaderboardy w Redis, analityka popularnych tras (heatmaps).

### B2C: Freemium
- **Produkt**: Aplikacja dla pasjonatów sportu.
- **Wartość**: Precyzyjna telemetria, unikalne mapy wektorowe, plany treningowe.

## 2. System Anti-Cheat i Weryfikacja
Rywalizacja o nagrody wymaga rygorystycznej walki z oszustwami.

### Warstwa Urządzenia (On-Device)
- **Mock Location Detection**: Wykrywanie fałszywych dostawców lokalizacji (API systemowe Android/iOS).
- **Accelerometer Analysis**: Klasyfikacja ruchu (bieg vs samochód) na podstawie wzorców drgań.

### Warstwa Szybkiej Selekcji (Fast Selection Gate — NOWE)
Uruchamiana **przed** Kalmanem i BRouterem. Zero I/O. O(N) czysta matematyka.

| Test | Próg | Co blokuje |
|:---|:---:|:---|
| TELEPORT | >500 m/skok | GPS spoof, pojazd |
| ACCELERATION | >6 m/s² | Tramwaj, auto, motocykl |
| MOTOR FINGERPRINT | CV prędkości <5% | Autobus, kolej, statek |
| STRAIGHT-LINE RATIO | >92% | Pojazd drogowy/szynowy |

### Warstwa Kinematyczna (V-max Check)
- Biomechaniczne progi prędkości per sport z 10% marginesem.
- Odrzucenie przy >20% segmentów powyżej progu lub ≥3 kolejnych naruszeń.

### Warstwa Serwera (Cloud Validation — BRouter)
- **BRouter Map-Matching**: Sprawdzenie czy trasa nie przecina fizycznych barier (ściany, rzeki) bez infrastruktury.
- Wywoływana **wyłącznie** gdy warstwy Fast Gate i V-max przeszły pomyślnie.
- **Heart Rate Correlation**: Wymaganie danych z pulsometru dla rankingów "Pro".

## 3. Grywalizacja: Mechanizm Punktacji
- **Normalizacja**: Punkty = (Dystans * Przewyższenie) / Liczba uczestników grupy. Pozwala to na uczciwą rywalizację małych firm z gigantami.
- **Wyzwania**: Czasowe wyzwania (Sprints) oparte na geograficznych strefach Traccar (Geofencing).
