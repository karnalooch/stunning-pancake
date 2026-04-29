# PLAN WDROŻENIA: Platforma SPORT Gold Master v2.1

## Faza 1: Infrastruktura i Fundament Danych (ZAKOŃCZONE)
*Cel: Przygotowanie potoku o dużej przepustowości i zabezpieczenie izolacji danych B2B2C.*

- [x] **Modernizacja Bazy Danych**: Konfiguracja Hypertables w TimescaleDB dla tabeli `activities_telemetry`.
- [x] **Wielodostęp (Multi-Tenancy)**: Implementacja Zabezpieczeń na Poziomie Wiersza (RLS) PostgreSQL w Django (`core/rls.py`).
- [x] **Bezpieczeństwo Enterprise**: Konfiguracja manifestów Kubernetes do uruchamiania kontenerów jako non-root (UID 1001 dla Backend, UID 101 dla Owner).
- [x] **Automatyzacja DevOps**: Zastąpienie Skaffold niestandardowym silnikiem `dev.ps1` w celu płynnego HMR i synchronizacji klastra.

## Faza 2: Portal Owner (Admin) "Cyber-Monolith V3.1" (STABILNE I ZWERYFIKOWANE)
*Cel: Rebranding Admina na Ownera i wdrożenie wysokowydajnego interfejsu w stylu OS.*

- [x] **Aktualizacja Architektury**: Migracja do Vite 6, React 19, Tailwind 3 (Stabilizowane) i Mantine 7.
- [x] **Rebranding Tożsamości**: Zastąpienie wszystkich odniesień do "Admin" słowem "Owner".
- [x] **Integracja Desktopowa**: Konfiguracja wrappera Electron z `HashRouter` i pakowaniem `asar`.
- [x] **Integracja Modułów**:
    - [x] Globalny Dashboard (Tremor Analytics).
    - [x] Zarządzanie Najemcami (Tenant Management).
    - [x] Kontrola Tożsamości Użytkowników.
    - [x] Centrum Dowodzenia Anti-Cheat (Naprawiono React-Query).

## Faza 3: Logika Biznesowa Backend (STABILNE)
*Cel: Finalizacja modeli danych Multi-Tenant i algorytmów synchronizacji.*

- [x] **Populacja Modelu Multi-Tenant**: Zasilenie bazy danych pierwszymi Najemcami B2B.
- [x] **Bezpieczeństwo API**: Walidacja filtrowania RLS dla każdego Najemcy.
- [x] **Integracja PowerSync**: Zdefiniowanie reguł synchronizacji dla mobilnego SQLite.
- [x] **Ingestion FastAPI**: Stabilizacja strumienia asynchronicznego z Redis.

## Faza 4: Aktualizacja Silnika Mobilnego (ZAKOŃCZONE I USTABILIZOWANE)
*Cel: Osiągnięcie 120FPS i reaktywności local-first dla aplikacji sportowca.*

- [x] **Framework i Rdzeń**: Aktualizacja do React Native 0.81 (Tryb Bridgeless).
- [x] **Stylizacja**: Konfiguracja Tamagui v4 i Typografii Inter.
- [x] **Wizualizacje i UI**: Migracja do MapLibre Native v11 z pełną płynnością kafelków wektorowych.
- [x] **Stan i Synchronizacja**: Stabilizacja Legend-State oraz eliminacja wyjątków unmount w React DOM.

## Faza 5: Zaawansowana Kontrola Operacyjna (ZAKOŃCZONE)
*Cel: Umożliwienie granularnego zarządzania wydajnością i brandingu w czasie rzeczywistym.*

- [x] **Dynamiczne Dostrajanie Wydajności**: Implementacja dławienia przyjmowania danych (dostosowywanie rozdzielczości odpytywania GPS w locie).
- [x] **Aktualizacje Over-The-Air (OTA)**:
    - [x] Konfiguracja `eas update` i przypisanie kanałów (`production`, `preview`).
    - [x] Wdrożenie `expo-updates` do obsługi automatycznego sprawdzania nowej wersji przy starcie oraz wyświetlanie wersji EAS w interfejsie.
- [x] **Zaawansowany System Motywów**:
    - [x] Implementacja założeń brandingu „Grupetto Siedlce” w `src/theme/Theme.ts`.
- [x] **Dynamiczne Zarządzanie Wyglądem (B2B)**:
    - [x] Integracja z endpointem `/api/users/branding/` dla każdego Najemcy.
    - [x] Mapowanie kolorów API na tokeny Tamagui w czasie rzeczywistym.
- [x] **Silnik White-Label**: Implementacja Zdalnego Wstrzykiwania Zasobów dla Logotypów, Nakładek Sponsorskich i Ekranów Powitalnych (Splash Screens).
- [x] **Adaptacyjna Integralność**: Zbudowanie UI do regulacji czułości Anti-Cheat w czasie rzeczywistym (progi Kinematyki i ML).

## Faza 6: Ekosystem Enterprise i Integracje
*Cel: Otwarcie platformy na zewnętrznych deweloperów i sprzęt wearable.*

- [ ] **Immersyjny Onboarding (Onboarding Flow)**:
    - [ ] Animowany ekran Splash (60 FPS) oraz systemowe zgody na GPS.
    - [ ] Ekran integracji (Garmin, Strava, Intervals.icu, Google, FB) i walidacji danych.
    - [ ] Generowanie Athlete QR Identity do weryfikacji offline.
- [ ] **System Pozycji Czasu Rzeczywistego (Live-Ghost Architecture)**:
    - [ ] Implementacja WebSocket w FastAPI z geofiltrowaniem opartym na Geohash i Redis.
    - [ ] Egzekwowanie stref prywatności (Privacy v2) z celowym jitterem po stronie serwera.
    - [ ] Priorytetyzacja "Top 10 Duchów" (Kluby, Znajomi, Zasięg 5km) i dynamiczne renderowanie MapLibre.
- [ ] **Ekosystem UI/UX (Cyber-Monolith V3)**:
    - [ ] **Dashboard (The Hub):** Układ Bento 2.0 Architecture z wykresem trendu Skia i dynamicznym powitaniem.
    - [ ] **Tracking (The Engine):** Hyper-Edit HUD (Tamagui), Glowing Track (MapLibre) i Legend-State.
    - [ ] **Społeczność i Historia:** Sticky Leaderboards (FlashList) oraz Archiwum z weryfikacją Anti-Cheat.
    - [ ] **Marketplace i Fortress:** Portfel z kodami QR (SELECT FOR UPDATE) i Strażnik Prywatności v2.
- [ ] **Publiczne API / SDK dla Deweloperów**: Umożliwienie klientom korporacyjnym budowania niestandardowych rozwiązań na bazie silnika ingestii SPORT.
- [ ] **Hub Integracji Wearable**: Natywne wsparcie dla dwukierunkowej synchronizacji z Garmin, Strava, Apple Watch (HealthKit) oraz WearOS (Google Fit).
- [ ] **Stripe Connect Multi-Sponsor**: Zaawansowana logika wypłat dla złożonych dystrybucji nagród B2B2C.

## Faza 7: Przewidująca Sztuczna Inteligencja i Globalna Autonomia
*Cel: Przejście od pasywnego monitorowania do proaktywnej inteligencji i decentralizacji.*

- [ ] **AI-Driven Predictive Coach**: Implementacja analizy ryzyka kontuzji w czasie rzeczywistym (wskaźnik ACWR) i adaptacyjnych sugestii treningowych.
- [ ] **Autonomiczne Klastry Miejskie**: Generowanie wydarzeń oparte na AI w oparciu o mapy ciepła gęstości i popularności miast w czasie rzeczywistym.
- [ ] **Zdecentralizowane Nagrody (Web3)**: Transparentna, niezmienna księga punktów i zarządzanie przy użyciu tokenów lojalnościowych opartych na blockchain.

## Faza 8: Totalna Suwerenność i Ekosystem Autonomiczny
*Cel: Przekształcenie SPORT z platformy w globalną, samowystarczalną gospodarkę sportową.*

- [ ] **Automatyczna Franczyza (Automated Franchising)**: Wdrażanie nowych miast/korporacji jednym kliknięciem z automatycznym rozliczaniem i generowaniem zasobów.
- [ ] **B2B Wellbeing ROI Engine**: Głęboka warstwa analityczna dla działów HR do obliczania zwrotu z inwestycji (ROI) w zdrowie na podstawie twardych danych telemetrycznych.
- [ ] **SPORT Meta-Leagues (AR/VR)**: Aktywność w świecie rzeczywistym zasilająca wirtualne awatary w globalnych zawodach rozszerzonej rzeczywistości.
