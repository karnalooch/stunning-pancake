# ARCHITEKTURA PANELU ADMINA (REFREESH)

Dokument ten opisuje strukturę i strategię refaktoryzacji panelu administracyjnego "SPORT" z obecnego monolitu w stronę skalowalnego systemu modułowego obsługującego wydarzenia, telemetrię i analitykę.

## 1. Struktura Komponentów (Component Hierarchy)

Panel zostaje podzielony na atomowe komponenty w katalogu `src/components/`:

- `Layout/`: Główne kontenery.
  - `Sidebar.tsx`: Nawigacja (Live, Events, Anti-Cheat, Settings).
  - `TopBar.tsx`: Profil użytkownika, wyszukiwarka globalna.
- `Map/`: Sercem panelu jest silnik mapowy.
  - `MapProvider.tsx`: Kontekst (React Context) przechowujący instancję MapLibre.
  - `BaseMap.tsx`: Bazowa warstwa mapy.
  - `TelemetryLayer.tsx`: Warstwa rysująca sportowców i ślady (Canvas).
  - `GeofenceLayer.tsx`: Warstwa rysująca obszary wydarzeń (Poligony).
- `Events/`: Moduły specyficzne dla wydarzeń.
  - `EventList.tsx`: Tabela/Grid z aktywnymi konkursami.
  - `EventCreator.tsx`: Formularz z narzędziami do rysowania na mapie.
  - `LeaderboardWidget.tsx`: Widget rankingu w czasie rzeczywistym.
- `Common/`: Współdzielone UI.
  - `GlassPanel.tsx`: Stylowy kontener z efektem szkła.
  - `StatCard.tsx`: Karty statystyk z trendami.

## 2. Zarządzanie Stanem (State Management)

Zamiast jednego dużego `useState`, przechodzimy na:

- **TanStack Query (React Query)**: Do zarządzania danymi asynchronicznymi (Lista eventów, historia sesji).
- **Zustand / React Context**: Do zarządzania stanem UI (które warstwy są widoczne, wybrany sportowiec, aktywny event).
- **WebSockets**: Subskrypcja konkretnych kanałów (np. `events:update` lub `telemetry:live`).

## 3. Strategia Warstw Mapy (Map Layering)

Mapa będzie działać w modelu "Stackable Layers":

1. **Warstwa Bazowa**: Kafle OSM (CartoDB Dark).
2. **Warstwa Geofencing (GeoJSON)**: Pobierana z API Wydarzeń.
3. **Warstwa Analityczna (Heatmaps)**: Generowana dla zakończonych sesji.
4. **Warstwa Telemetrii (Live)**: Rysowana na górnym Canvasie dla maksymalnej wydajności (60 FPS).

## 4. Integracja z Systemem Wydarzeń (Events Flow)

1. Admin wybiera zakładkę **Events**.
2. Mapa automatycznie filtruje widok do obszaru aktywnego wydarzenia.
3. `GeofenceLayer` dociąga granice konkursu (np. granice Siedlec).
4. `LeaderboardWidget` otwiera połączenie WebSocket do Redisa, aby pokazywać zmiany pozycji w bitwie miast na żywo.

## 5. Roadmapa Refaktoryzacji

1. **Krok 1**: Wydzielenie `index.css` (Design System) – DONE.
2. **Krok 2**: Stworzenie `Sidebar` i `Layout` w `App.tsx`.
3. **Krok 3**: Ekstrakcja logiki MapLibre do `MapProvider`.
4. **Krok 4**: Implementacja widoku `Events` (Dashboard z makiety).

## 6. Proces Tworzenia Wydarzenia (Event Creation Flow)

Tworzenie wydarzenia w panelu admina odbywa się w trybie interaktywnym:

1.  **Definicja Metadanych**:
    *   Wybór nazwy, opisu i grafiki promocyjnej.
    *   Ustalenie ram czasowych (Start/End).
    *   Wybór typu: `Accumulative` (km/m), `Checkpoint` (POI), `Route Match`.
2.  **Konfiguracja Terytorialna (Map-Based)**:
    *   Admin używa narzędzi rysowniczych (Draw Tools) na mapie, aby zdefiniować granice (Polygon) lub punkty kontrolne (Points).
    *   System automatycznie przelicza te dane na format GeoJSON i wysyła do Backend/Traccar.
3.  **Ustawienie Reguł (Rules Engine)**:
    *   Wybór dozwolonych sportów (Bieg, Rower).
    *   Ustalenie progu Anti-Cheat (np. "Wymagana weryfikacja BRouter").
    *   Parametry normalizacji (jeśli to bitwa między miastami).
4.  **Konfiguracja Nagród**:
    *   Przypisanie voucherów z puli sponsorów do konkretnych osiągnięć.
5.  **Publikacja**:
    *   Event trafia do Redisa i staje się widoczny dla uczestników w aplikacji mobilnej.

## 7. Przykład Flagowy: Bitwa Miast (Wyzwanie Kilometrowe)

To najczęstszy scenariusz wykorzystania platformy przez samorządy (B2G).

- **Cel**: "Które miasto wykręci/wybiega więcej kilometrów w czerwcu?"
- **Konfiguracja**:
    *   **Typ**: Accumulative (Distance).
    *   **Filtry**: `ActivityType IN ['RUN', 'BIKE']`.
    *   **Uczestnicy**: Automatyczne przypisanie na podstawie pola `city` w profilu użytkownika lub lokalizacji startu aktywności wewnątrz Geofence'u miasta.
- **Dashboard Bitwy**:
    *   Dwa paski postępu (Siedlce vs Lublin).
    *   Licznik oszczędności CO2 (przelicznik: km rowerowe * 0.2kg CO2).
    *   Ranking "Top 10 Wojowników" dla każdego miasta.
- **Logika Backendowa**:
    *   Każdy "zrzut" danych z Traccara aktualizuje globalny licznik miasta w Redis (Sorted Set).
    *   System wysyła powiadomienie Push: "Twoje miasto właśnie wyprzedziło Lublin! Wyjdź na rower i utrzymaj prowadzenie!".

## 8. Tożsamość Wizualna Panelu (Visual Identity)

Poniższe makiety przedstawiają docelowy wygląd interfejsu administracyjnego:

### Dashboard Główny (Telemetria Live)
![Admin Panel Mockup](./assets/admin_panel_mockup.png)

### Zarządzanie Wydarzeniami i Geofencingiem
![Admin Events Management](./assets/admin_events_management.png)

## 9. Skalowalność i Rozszerzalność (Future-Proofing)

Panel admina został zaprojektowany w modelu "Plugin-ready", co pozwala na łatwe dodawanie nowych funkcjonalności bez refaktoryzacji rdzenia.

### 9.1 System Widoków Modułowych
Każdy nowy moduł (np. HR Analytics, Store Manager) jest osobnym komponentem w `src/views/`. Rejestracja nowego widoku odbywa się w centralnym routerze:
- Automatyczne dodanie do Sidebaru na podstawie uprawnień.
- Izolacja stanu (każdy widok ma swój własny `store` w Zustandzie).

### 9.2 Dynamiczne Warstwy Mapy
Silnik mapy w `BaseMap.tsx` obsługuje dynamiczny rejestr warstw:
- Możliwość dodawania nowych źródeł danych (GeoJSON, Vector Tiles) poprzez proste wywołanie `map.addLayer()` wewnątrz hooka `useMapLayers`.
- Pozwala to na szybkie wdrożenie np. warstwy "Sponsors POI" lub "Regional Heatmaps".

### 9.3 System Uprawnień (RBAC)
Interfejs dostosowuje się do roli użytkownika:
- **Global Admin**: Widzi wszystko.
- **Tenant Admin**: Widzi tylko dane swojej firmy/miasta.
- **Moderator**: Ma dostęp tylko do narzędzi weryfikacji Anti-Cheat.

### 9.4 Przygotowanie pod "Nowe Rzeczy"
Architektura wspiera łatwe dopięcie:
- **AI Monitoring View**: Nowa zakładka z zaawansowaną analityką ML.
- **Voucher Marketplace Manager**: Moduł do zarządzania pulą nagród.
- **Matrix Admin Console**: Konsola do moderacji czatów klubowych.




