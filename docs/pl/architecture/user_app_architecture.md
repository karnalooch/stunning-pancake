# ARCHITEKTURA MOBILNA: Platforma "SPORT"
> Ostatnia aktualizacja: 2026-04-24 | **Wydanie Hyper-Performance** (Po Milestone 5)

Aplikacja mobilna (Android/iOS) jest zbudowana na **React Native 0.78+** z wykorzystaniem **Bridgeless Mode** oraz **Nowej Architektury** (TurboModules + Fabric Renderer) dla bezprecedensowej wydajności uniwersalnej.

- **Framework UI**: **Tamagui (v4)** – wykorzystuje optymalizujący kompilator do statycznej ekstrakcji stylów, zapewniając zerowy narzut w czasie wykonywania (zero-runtime) i prędkość renderowania zbliżoną do natywnej.
- **Silnik Graficzny**: **React Native Skia** – akcelerowany sprzętowo silnik graficzny 2D/3D (120 FPS) dla płynnej grywalizacji, niestandardowych wizualizacji danych i wysokiej klasy gradientów.
- **Silnik Animacji**: **Reanimated 3** – wykonuje złożone animacje i logikę gestów wyłącznie w wątku UI za pomocą workletów.
- **Stan i Reaktywność**: **Legend-State** – ultra-precyzyjna obserwowalność (micro-observables) pozwalająca pominąć narzut standardowego cyklu renderowania React dla błyskawicznych aktualizacji UI.
- **Silnik Mapowy**: **Mapbox SDK** – akcelerowany sprzętowo teren 3D i niestandardowe warstwy (Mapa JEST produktem).
- **Synchronizacja Danych**: **PowerSync** – zapewnia automatyczne dwukierunkowe strumieniowanie między lokalną bazą SQLite a backendem FastAPI dla prawdziwego doświadczenia local-first.

| Komponent | Biblioteka | Przeznaczenie |
|:---|:---|:---|
| Framework | **Expo (Universal)** | Managed workflow, aktualizacje OTA, uniwersalny routing |
| Rdzeń UI | **Tamagui v4** | Wysokowydajny system projektowy zero-runtime |
| Grafika | **React Native Skia** | Grafika 120 FPS, płynne wykresy, grywalizacja |
| Animacja | **Reanimated 3** | Worklety i złożone animacje wektorowe |
| Synch. Danych | **PowerSync** / SQLite | Reaktywność local-first i strumieniowanie w tle |
| Mapa | **MapLibre SDK** | Wektorowe mapy open-source, kafelki zero-cost |
| Stan | **Legend-State** | Micro-observables dla ultra-szybkiego UI |
| Płatności | **RevenueCat** | Zarządzanie IAP i subskrypcjami |
| Obserwowalność | **SentryService.ts** | Śledzenie błędów (z usuwaniem współrzędnych GPS) |

---

## 2. Silnik Trackingu GPS: `GpsSyncManager.ts` (v4)

Świadomy stanu baterii, sprawdzony produkcyjnie tracking z automatyczną adaptacją dokładności, napędzany przez strumieniowanie local-first.

### Funkcje
- **Adaptacja baterii**: Automatyczne przełączanie dokładności `HIGH → MEDIUM` przy <20% baterii.
- **Potok metryk**: Obliczanie `elevationGainM` i `paceSecPerKm` w czasie rzeczywistym na urządzeniu.
- **Sync Offline-first**: Punkty są zapisywane natychmiast w lokalnej bazie SQLite **PowerSync**.
- **Strumieniowanie dwukierunkowe**: Automatyczna synchronizacja w tle z FastAPI przy użyciu wykładniczego czasu oczekiwania (exponential backoff).

### Przepływ Synchronizacji
```text
Sprzęt GPS → Geolokalizacja w tle → Lokalna baza PowerSync
                                           │ automatyczne strumieniowanie dwukierunkowe
                                           ▼
                              POST /api/telemetry/ingest/stream
                                           │
                                     FastAPI :8001
                                           │
                                     Redis → Celery
```

---

## 3. Architektura Prywatności: Strefy v2

Maskowanie prywatności jest nakładane **na urządzeniu, zanim jakiekolwiek dane opuszczą telefon**.

| Typ strefy | Promień bazowy | Wzmocnienie gęstości |
|:---|:---|:---|
| DOM | 250m | ×1.5 jeśli ≥3 strefy w pobliżu |
| PRACA | 150m | ×1.5 jeśli ≥3 strefy w pobliżu |
| WŁASNA | 75m | ×1.5 jeśli ≥3 strefy w pobliżu |

- **Segment Bridging**: Interpolacja liniowa wypełnia luki przy wejściu/wyjściu ze strefy.
- **Sentry**: Hook `beforeSend` usuwa wszelkie współrzędne GPS przed transmisją.

---

## 4. Obserwowalność: `SentryService.ts`

- No-op, jeśli `SENTRY_DSN` nie jest ustawiony (lokalny development).
- **Usuwanie GPS w `beforeSend`**: Breadcrumbs zawierające `lat=` lub `GPS` są filtrowane.

---

## 5. Wizualizacja: MapLibre GL & Skia

Wysokowydajny silnik map wektorowych zintegrowany z grafiką Skia.

- **Glowing Tracks**: Dynamiczne stylizowanie linii z aktualizacjami gradientów Skia w czasie rzeczywistym.
- **Warstwa Heatmap**: Konsumuje `/api/activities/heatmap/` → renderuje gęstość aktywności.
- **Nakładki Live**: Tempo i elewacja renderowane natywnie w 120 FPS poprzez Skia.

---

## 6. Analityka Premium: `/api/activities/analytics/`

Dostępna dla użytkowników premium, wizualizowana za pomocą interaktywnych wykresów **React Native Skia**:

| Funkcja | Logika |
|:---|:---|
| **Analiza trendu** | Regresja liniowa (slope + R²) z 12 tygodni objętości |
| **Predykcje wyścigów** | Formuła Riegela: T2 = T1 × (D2/D1)^1.06 |
| **Obciążenie treningowe**| ACWR (Acute/Chronic Workload Ratio) |

---

## 7. Struktura Katalogów (Zorientowana na Domenę)

```text
mobile/src/
├── app/              ← Strony oparte na plikach Expo Router (Universal)
├── features/
│   ├── tracking/     ← UI aktywnej sesji (Skia Canvas), widok mapy
│   ├── leaderboard/  ← Rankingi miast/wydarzeń
│   ├── social/       ← Czat klubowy Matrix
│   ├── rewards/      ← Rynek voucherów, saldo punktów
│   └── analytics/    ← Wykresy premium (Skia/Reanimated)
├── services/
│   ├── GpsSyncManager.ts  ← Silnik GPS świadomy baterii
│   ├── PowerSyncClient.ts ← Menedżer synchronizacji offline-first
│   ├── SentryService.ts   ← Obserwowalność (usuwanie GPS)
│   ├── DesignerService.ts ← Customizer HUD i trwałość (MMKV)
│   └── ApiClient.ts       ← Klient HTTP z autoryzacją JWT
├── components/       ← Tamagui Atomic UI (Atomy → Molekuły → Organizmy)
└── state/            ← Obserwowalne Legend-State
```

---

## 8. Hyper-Edit: Projektant HUD Mobile

Aplikacja posiada system projektowy „Przytrzymaj, aby edytować” dla widoku aktywnej sesji.

### 8.1 Silnik Customizacji HUD
- **DesignerService**: Wykorzystuje `react-native-mmkv` dla wysokiej prędkości lokalnego zapisywania konfiguracji UI.
- **Dynamiczny HUD**: Ekran `ActiveSessionScreen` renderuje zmienną siatkę metryk (Dystans, Czas, Tempo, Prędkość) w oparciu o preferencje użytkownika.
- **Customizacja w locie**: Nakładka modalna pozwala na przełączanie widoczności metryk bez przerywania aktywnej sesji.

---

## 9. Lista kontrolna Bezpieczeństwa i Prywatności

| Kontrola | Implementacja | Status |
|:---|:---|:---|
| Strefy Prywatności v2 | Dynamiczne maskowanie promienia, wzmocnienie gęstości, bridging segmentów | ✅ |
| Wykrywanie Mock GPS | Odrzucanie symulowanych dostawców GPS | ✅ |
| Passkeys (FIDO2) | Bezhasłowe logowanie biometryczne (FaceID/TouchID) | ✅ |
| OAuth 2.0 + PKCE | Bezpieczny przepływ autoryzacji bez sekretów klienta | ✅ |
| Czat E2EE | Protokół Matrix, prowizjonowanie pokoi po stronie serwera | ✅ |
| Sentry PII guard | Usuwanie GPS w `beforeSend`, `send_default_pii=False` | ✅ |
| JWT Auth | Krótkotrwałe tokeny (60min) + rotacja odświeżania (30 dni) | ✅ |
