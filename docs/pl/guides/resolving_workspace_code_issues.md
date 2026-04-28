# Rozwiązywanie Problemów z Kodem Workspace (Kwiecień 2026)

Ten dokument zawiera rejestr techniczny problemów zidentyfikowanych i rozwiązanych podczas fazy stabilizacji aplikacji mobilnej SPORT (v2.4).

## 1. Problemy z Kompilacją TypeScript (Mobile)

### Błąd: Brak deklaracji modułu `lucide-react-native`
**Problem:** Kompilator TypeScript zgłaszał błędy dotyczące braku typów dla biblioteki ikon.
**Rozwiązanie:** Utworzono plik `src/lucide-react-native.d.ts` z jawną deklaracją modułu typu ambient, co umożliwiło poprawne typowanie ikon w całym projekcie.

## 2. Migracja i Modernizacja Map

### Portowanie do MapLibre Native v11
**Problem:** Poprzednia implementacja opierała się na przestarzałych API Mapbox, co kolidowało z nową architekturą Expo.
**Rozwiązanie:** Całkowicie przeportowano `TrackingScreen.tsx` na `@maplibre/maplibre-react-native` w wersji 11. 
- Usunięto wymagania dotyczące tokenów (MapLibre jest Open Source).
- Zaktualizowano style mapy na `dark-matter-gl-style`.
- Dodano wtyczkę `@maplibre/maplibre-react-native` do `app.config.js`.

## 3. Stabilność Stanu i Interfejsu (Legend-State)

### Błąd: "Biały Ekran" po uruchomieniu (Proxy Traps)
**Problem:** Aplikacja czasami wyświetlała całkowicie białe tło. Analiza wykazała błędy `TypeError` wynikające z pułapek proxy (proxy traps) w bibliotece Legend-State, gdy metoda `.get()` była wywoływana bezpośrednio wewnątrz struktury JSX.
**Rozwiązanie:** Zrefaktoryzowano komponenty `App.tsx`, `TrackingScreen.tsx`, `LeaderboardScreen.tsx` i `ProfileScreen.tsx`. 
- Wartości stanu są teraz wyciągane do zmiennych lokalnych na początku funkcji `render` (np. `const user = state.user.get();`).
- Poprawiono strukturę `ErrorBoundary`, aby poprawnie renderowała błędy w kontekście Tamagui.

## 4. Uprawnienia i Prywatność

### Błąd: Odmowa uprawnień lokalizacji w tle (Background Location)
**Problem:** Na nowszych wersjach Androida (10+) uprawnienie "Zawsze zezwalaj" musi być nadane ręcznie w ustawieniach, co powodowało ciche błędy śledzenia.
**Rozwiązanie:** Zaktualizowano `toggleTracking` w `TrackingScreen.tsx`. Jeśli uprawnienie do lokalizacji w tle nie jest nadane, aplikacja wyświetla alert systemowy z bezpośrednim przyciskiem "Otwórz Ustawienia", korzystając z `Linking.openSettings()`.

## 5. Naprawa Błędów API i Danych

### Błąd: `zones.filter is not a function` na ekranie Profilu
**Problem:** Backend dla stref prywatności (Privacy Zones) zwraca dane w formacie GeoJSON (obiekt z polem `features`), podczas gdy aplikacja oczekiwała płaskiej tablicy. Powodowało to błąd przy próbie filtrowania danych.
**Rozwiązanie:** W `ProfileScreen.tsx` dodano bezpieczne rozpakowywanie danych:
```typescript
const zoneData = await PrivacyService.getZones();
state.zones.set(Array.isArray(zoneData) ? zoneData : (zoneData.features || []));
```
Poprawiono również dostęp do właściwości stref (`zone.properties.label` zamiast `zone.label`).

## 6. Obserwowalność i Telemetria

### Migracja: Firebase zamiast Sentry
**Problem:** Sentry powodowało konflikty z natywnym bootowaniem aplikacji w trybie deweloperskim.
**Rozwiązanie:** Zastąpiono Sentry pakietem `@react-native-firebase`. 
- Skonfigurowano `FirebaseService.ts` do obsługi zdarzeń i błędów.
- Dodano obsługę dynamicznego wyłączania Firebase w środowiskach, gdzie natywne moduły nie są dostępne (np. standardowe Expo Go).

## 7. Zarządzanie Wdrożeniami (EAS & OTA)

### Konfiguracja Updates
- **Branch:** `preview` (do testów) i `production`.
- **Runtime Version:** Ustawiono na `appVersion` w `app.config.js`, aby zapewnić kompatybilność paczek JS z wersją natywną.
- **Weryfikacja w UI:** Dodano wyświetlanie `updateId` na dole ekranu profilu, aby ułatwić diagnostykę wersji OTA.

## 8. Branding i Design (Grupetto Siedlce)
- **Kolorystyka:** Wdrożono paletę `Navy Blue (#1E3A8A)` i `Sky Blue (#3B82F6)`.
- **Komponenty:** Wprowadzono przyciski typu "Pill" (24px radius) oraz efekty glassmorphismu dla nakładek na mapę.
- **Motyw:** Spójna konfiguracja w `src/theme/Theme.ts`.

---
*Dokumentacja sporządzona przez Gemini CLI w ramach audytu stabilizacji projektu.*
