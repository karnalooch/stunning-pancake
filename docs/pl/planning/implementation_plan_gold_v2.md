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

## Faza 4: Aktualizacja Silnika Mobilnego (OBECNIE W TOKU)
*Cel: Osiągnięcie 120FPS i reaktywności local-first dla aplikacji sportowca.*

- [x] **Framework i Rdzeń**: Aktualizacja do React Native 0.81 (Tryb Bridgeless).
- [/] **Stylizacja**: Konfiguracja Tamagui v4 i Typografii Inter.
- [ ] **Wizualizacje i UI**: Integracja React Native Skia dla wykresów oraz Mapbox SDK z Terenem 3D.
- [ ] **Stan i Synchronizacja**: Refaktoryzacja zarządzania stanem do Legend-State i integracja PowerSync Client.

## Faza 5: Zaawansowana Kontrola Operacyjna (NADCHODZĄCE)
*Cel: Umożliwienie granularnego zarządzania wydajnością i brandingu w czasie rzeczywistym.*

- [ ] **Dynamiczne Dostrajanie Wydajności**: Implementacja dławienia przyjmowania danych (dostosowywanie rozdzielczości odpytywania GPS w locie).
- [ ] **Silnik White-Label**: Implementacja Zdalnego Wstrzykiwania Zasobów dla Logotypów, Nakładek Sponsorskich i Ekranów Powitalnych (Splash Screens).
- [ ] **Adaptacyjna Integralność**: Zbudowanie UI do regulacji czułości Anti-Cheat w czasie rzeczywistym (progi Kinematyki i ML).
