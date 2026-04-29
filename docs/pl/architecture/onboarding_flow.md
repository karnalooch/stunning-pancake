# Projekt Ekranu Uruchomienia i Kreatora Onboardingu (Mobile/Web)

Niniejszy dokument opisuje wizję i architekturę techniczną modułu Onboardingu platformy SPORT. Implementacja integruje wytyczne estetyki Cyber-Monolith z płynnością animacji na poziomie 60 FPS.

## 1. Proces Uruchomienia Aplikacji (Onboarding Wizard)

Gdy użytkownik uruchamia aplikację po raz pierwszy, system przechodzi przez immersyjną sekwencję wstępną.

### Krok 1: Animated Splash (Ekran Powitalny)
- **Wizualia:** Ciemne tło (Cyber-Monolith), pulsujące centralnie umieszczone logo SPORT.
- **Technologia:** Wykorzystanie `react-native-reanimated` (Mobile) lub `Framer Motion` (Web) dla uzyskania płynnych przejść.

### Krok 2: Ekran Zgód Systemowych (Permissions Hub)
- **Wymagane uprawnienia:**
  - **Lokalizacja (GPS):** Niezbędna do zapisu tras i wyścigów.
  - **Aktywność fizyczna:** Wykrywanie ruchu i optymalizacja zużycia baterii.
  - **Powiadomienia:** Komunikacja w czasie rzeczywistym o wyzwaniach i znajomych.
  - **Bluetooth:** Łączność z zewnętrznymi czujnikami tętna (BLE).
- **Flow:** Aplikacja wykorzystuje mechanizm symulacji "wykrywania" stanów uprawnień, co daje użytkownikowi poczucie głębokiej integracji z urządzeniem i podnosi zaufanie. Brak zgody blokuje dalsze kroki.

### Krok 3: Integrations Hub (Integracje zewnętrzne)
Aplikacja umożliwia automatyczne pobieranie danych za pomocą usług trzecich:
- Garmin Connect
- Strava
- Intervals.icu
- Google Account
- Facebook Login

### Krok 4: Zbieranie Danych Sportowych
- **Scenariusz A (Automatyczny):** Pobranie zintegrowanych danych biometrycznych (wzrost, waga, płeć, tętno spoczynkowe) ze Stravy/Garmina.
- **Scenariusz B (Ręczny):** W przypadku braku integracji, kreator przekierowuje do interaktywnego formularza recznego wprowadzania danych.

### Krok 5: Walidacja Danych & Anti-Cheat
- Formularz weryfikacyjny z możliwością edycji pobranych metadanych (Imię, Nazwisko, Wiek).
- Ekran zawiera obowiązkowe przypomnienie o kalibracji urządzeń – kluczowy element psychologiczny mechanizmu Anti-Cheat.

### Krok 6: Zgody Licencyjne
- Akceptacja warunków użytkowania platformy oraz licencji bibliotek firm trzecich.

### Krok 7: Generowanie QR Identity
- System generuje unikalny kod QR tożsamości sportowca.
- Kod posłuży w przyszłości do szybkiej weryfikacji zawodnika na zawodach stacjonarnych.

---

## 2. Implementacja Wizualna — Standardy

- **UI framework:** Tamagui (Mobile) / Tailwind CSS (Web).
- **Stylistyka:** Ciemne motywy, poświaty w kolorze Cyan (`#00D1FF`), Glassmorphism (efekt rozmytego szkła dla kart z danymi).
- **Ikony:** Lucide / Lucide-react.

> **Zastrzeżenie Informacyjne**
> Moduł onboardingowy służy wyłącznie celom statystycznym i informacyjnym. Aby uzyskać poradę medyczną lub diagnozę, skonsultuj się ze specjalistą.
