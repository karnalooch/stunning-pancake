# PLAN IMPLEMENTACJI: Platforma SPORT Gold Master v2.1

## Faza 1: Infrastruktura i Fundament Danych (ZAKOŃCZONE)
*Cel: Przygotowanie potoku o wysokiej przepustowości i zabezpieczenie izolacji danych B2B2C.*

- [x] **Modernizacja Bazy Danych**: Konfiguracja TimescaleDB Hypertables dla tabeli `activities_telemetry`.
- [x] **Multi-Tenancy**: Implementacja PostgreSQL Row Level Security (RLS) w Django (`core/rls.py`).
- [x] **Bezpieczeństwo Enterprise**: Konfiguracja manifestów Kubernetes do uruchamiania kontenerów non-root (UID 1001 dla Backend, UID 101 dla Owner).
- [x] **Automatyzacja DevOps**: Zastąpienie Skaffold własnym silnikiem `dev.ps1` dla płynnego HMR i synchronizacji klastra.

## Faza 2: Portal Właściciela (Owner) "Cyber-Monolith V3.1" (STABILNE i ZWERYFIKOWANE)
*Cel: Rebranding z Admin na Owner i implementacja interfejsu UI przypominającego system operacyjny.*

- [x] **Aktualizacja Architektury**: Migracja do Vite 6, React 19, Tailwind 3 (Zatwierdzone) i Mantine 7.
- [x] **Rebranding Tożsamości**: Zmiana wszystkich odniesień z "Admin" na "Owner".
- [x] **Integracja Desktopowa**: Konfiguracja kontenera Electron z `HashRouter` i pakowaniem `asar`.
- [x] **Integracja Modułów**:
    - [x] Globalny Dashboard (Analityka Tremor).
    - [x] Zarządzanie Najemcami (Tenants).
    - [x] Kontrola Tożsamości Użytkowników.
    - [x] Centrum Dowodzenia Anti-Cheat (Poprawka React-Query).

## Faza 3: Logika Biznesowa Backend (STABILNE)
*Cel: Finalizacja modeli danych Multi-Tenant i algorytmów synchronizacji.*

- [x] **Zasilanie Modeli Multi-Tenant**: Zasiedlenie bazy danych pierwszymi najemcami B2B.
- [x] **Bezpieczeństwo API**: Walidacja filtrowania RLS na najemcę.
- [x] **Integracja PowerSync**: Definicja reguł synchronizacji dla mobilnego SQLite.
- [x] **Ingestia FastAPI**: Stabilizacja asynchronicznego strumienia z Redis.

## Faza 4: Upgrade Silnika Mobilnego (ZAKOŃCZONE / W TOKU)
*Cel: Osiągnięcie płynności 60-120FPS i reaktywności local-first dla aplikacji sportowca.*

- [x] **Framework i Rdzeń**: Upgrade do React Native 0.81 (Tryb Bridgeless).
- [x] **Stylizacja**: Konfiguracja Tamagui v4 i Typografii Inter.
- [x] **Stan i Synchronizacja**: Refaktoryzacja zarządzania stanem na **Legend-State** (60FPS HUD).
- [ ] **Wizualizacje i UI**: Integracja React Native Skia dla wykresów i Mapbox SDK z Terenem 3D.
- [ ] **Integracja PowerSync**: Pełne połączenie klienta mobilnego z PowerSync.

## Faza 5: Zaawansowana Kontrola Operacyjna (NADCHODZĄCE)
*Cel: Umożliwienie granularnego zarządzania wydajnością i brandingiem w czasie rzeczywistym.*

- [ ] **Dynamiczne Strojenie Wydajności**: Implementacja dławienia ingestii danych (regulacja częstotliwości próbkowania GPS w locie).
- [ ] **Silnik White-Label**: Implementacja zdalnego wstrzykiwania zasobów (Logotypy, Nakładki Sponsorskie, Ekrany Powitalne).
- [ ] **Adaptive Integrity**: Budowa UI do regulacji czułości Anti-Cheat w czasie rzeczywistym (Kinematyka i progi ML).
