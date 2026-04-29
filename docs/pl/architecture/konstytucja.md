# KONSTYTUCJA PROJEKTU: "SPORT"

## 1. Misja i Tożsamość
Platforma sportowa klasy B2B/B2C zbudowana w 100% na fundamencie **Permisywnego Open Source** oraz rygorystycznej **Safety Constitution** (Standardów Jakości AI). Projekt ma na celu dostarczenie zaawansowanych narzędzi telemetrycznych, grywalizacyjnych i społecznościowych, zachowując pełną swobodę komercjalizacji (White-Label) bez ryzyka infekcji licencjami copyleft (GPL).

## 2. Kanon Technologiczny (Permissive Stack)
Rygorystycznie dobrane komponenty gwarantujące bezpieczeństwo biznesowe:
- **Rdzeń Telemetryczny**: Traccar (Apache 2.0).
- **Śledzenie Mobilne**: OpenTracks (ISC).
- **Walidacja i Map-Matching**: BRouter (MIT) z danymi routingu OSM w formacie `.rd5` (segmenty 5°×5°).
- **Wizualizacja Map**: MapLibre GL (BSD-2/MIT).
- **Komunikacja**: Matrix (Apache 2.0).
- **Grywalizacja**: Redis (BSD-3-Clause).
- **Interfejsy**: Flutter / React Native Bridgeless.

## 3. Wizja Wizualna (UX/UI Manifesto)

> [!IMPORTANT]
> Architektura wizualna platformy SPORT dzieli się na dwa odrębne fundamenty projektowe:
> 1. **Portal Ownera (Admin Panel)**: Styl Cyber-Monolith V3 (Dark mode, glassmorphism, dynamiczne gradienty).
> 2. **Aplikacja Mobilna (Dla Sportowca)**: Styl Hybrydowy HD-2D (Octopath-Diver Core).

### Aplikacja Użytkownika (Styl Hybrydowy HD-2D)
Aplikacja mobilna odrzuca korporacyjny minimalizm.
- **Estetyka**: Gęsty pixel-art (.webp) z 1-pikselowym czarnym outline'em i nowoczesnymi efektami shaderów/glow.
- **Kolorystyka**: Profil "High-Noon Invectus" gwarantujący kontrast 12:1 w pełnym słońcu (Solar Mode).
- **Animacje**: 120 FPS ("Squash and Stretch" rodem z Metal Slug, Juicy UI).

### Panel Zarządzania (Styl Cyber-Monolith)
- **Estetyka**: Dark mode, glassmorphism, dynamiczne gradienty.
- **Wizualizacja Danych**: Mapy wektorowe o wysokiej wydajności, interaktywne wykresy telemetryczne.

## 4. Architektura Systemowa
### Model Offline-First
Aplikacja mobilna traktuje lokalną bazę danych (SQLite) jako jedyne źródło prawdy podczas trwania aktywności. Synchronizacja z serwerem zachodzi asynchronicznie (batching), minimalizując zużycie baterii.

### System Anti-Cheat
Każdy ślad GPX jest walidowany topologicznie przez silnik BRouter. System wykrywa "pływanie" GPS oraz próby oszustw (np. jazda samochodem zamiast biegu) poprzez analizę parametrów fizycznych i topologii OpenStreetMap.

### Leaderboardy i Grywalizacja
Zastosowanie struktur **Sorted Sets** w Redis pozwala na natychmiastowe przeliczanie rankingów dla milionów użytkowników przy minimalnym obciążeniu.

## 5. Prywatność i Bezpieczeństwo
- **Privacy Zones**: Dynamiczne maskowanie tras w pobliżu wrażliwych punktów (dom, praca).
- **E2EE**: Szyfrowanie komunikacji w protokole Matrix.
- **Anonimizacja**: Triangulacja ucinania wektorów ze zmiennym promieniem.

## 6. Standardy Operacyjne (AI Toolkit)
Projekt stosuje rygorystyczne zasady **Safety Constitution**, obejmujące:
- Artykuł I: Safety First (brak utraty danych, brak ślepej egzekucji).
- Artykuł VI: Dyscyplina Naprawcza (brak martwego kodu, naprawa błędów "na miejscu").

## 7. Model Komercjalizacji
- **B2B (Corporate Wellness)**: Model SaaS z pełnym brandingiem klienta.
- **B2C (Freemium)**: Zaawansowane plany treningowe i mapy premium.
- **Sponsors POI**: Dynamiczne punkty partnerskie na mapie z systemem voucherów.

## 8. Dane Mapowe i Provisioning
### Strategia: Download-on-Install
Aplikacja nie zawiera danych mapowych w paczce instalacyjnej. Skrypt pobiera odpowiednie segmenty BRouter `.rd5` (5°×5°) dla regionu użytkownika w czasie wdrażania środowiska.
