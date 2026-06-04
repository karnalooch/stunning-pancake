# ADR 005: Telemetry & Background Tracking

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Zobacz dokument kanoniczny |
| **lang** | pl |
| **translation** | [English](../../adr/005-telemetry-tracking.md) |
| **canonical_path** | docs/pl/adr/005-telemetry-tracking.md |
---

## Stan
Zaakceptowano (13.05.2026)

## Kontekst
Podstawową wartością aplikacji SPORT jest dokładne śledzenie jazdy/biegu. Dane te muszą być gromadzone nawet wtedy, gdy ekran jest wyłączony lub aplikacja działa w tle. Wcześniej korzystaliśmy z narzędzia „react-native-background-geolocation” (TransistorSoft), ale uznaliśmy, że jest ono zbyt ciężkie dla naszych niestandardowych potrzeb telemetrycznych.

## Decyzja
Przeprowadziliśmy migrację do **Lokalizacja Expo + Menedżer zadań Expo** w celu śledzenia w tle.

### Architektura przepływu danych```mermaid
graph TD
    A[GPS Satellite] --> B[Expo Location]
    B --> C[Background Task Handler]
    C --> D[MMKV gps_buffer]
    D --> E[Batch Ingestor - 30s timer]
    E --> F[Telemetry API /batch]
    F --> G[PostgreSQL / TimescaleDB]
```### Kluczowe mechanizmy
1. **Zadanie w tle**: Nazwane zadanie („BACKGROUND_LOCATION_TASK”) jest rejestrowane poprzez „TaskManager.defineTask”. Pozostaje aktywny nawet jeśli główny wątek interfejsu użytkownika jest zawieszony.
2. **Strategia buforowania**: Współrzędne są dołączane do tablicy JSON w MMKV. Pozwala to uniknąć przechowywania dużych obiektów w pamięci.
3. **Rozdzielczość dynamiczna**: 
    - **HIPERSKALA**: interwał 2 m / 1 s (tryb wyścigu).
    - **ZRÓWNOWAŻONY**: interwał 10 m / 5 s (jazda standardowa).
    - **OSZCZĘDZANIE ENERGII**: interwał 30 m / 15 s (ultrawytrzymałość).
4. **Usługa pierwszego planu**: W systemie Android utrzymujemy ciągłe powiadomienie za pośrednictwem konfiguracji „foregroundService”, aby zapobiec przerywaniu przez system operacyjny zadania lokalizacji podczas długich działań.

## Konsekwencje
- **Pozytywne**: Pełna kontrola nad potokiem przyjmowania. Możemy na bieżąco dostosowywać precyzję do zużycia baterii.
- **Pozytywne**: Odporność. Logika przetwarzania wsadowego obsługuje sporadyczną utratę łączności 5G/LTE, utrzymując bufor do momentu odebrania pomyślnego protokołu HTTP 201.
- **Wymaganie**: Użytkownicy muszą zostać przeszkoleni w zakresie udzielania uprawnień do lokalizacji „Zawsze zezwalaj”, ponieważ opcja „Podczas korzystania z aplikacji” zakończy sesję wkrótce po zablokowaniu ekranu.

---

## Pełna wersja (kanoniczna)

Pełny tekst ADR (język źródłowy dokumentu): **[005-telemetry-tracking.md](../../adr/005-telemetry-tracking.md)**.

> Skrót PL — nie zastępuje pełnego ADR przy review architektury.
