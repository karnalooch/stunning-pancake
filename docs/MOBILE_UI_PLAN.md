# PLAN IMPLEMENTACJI INTERFEJSU MOBILNEGO (MOBILE UI V3.0) — SPORT

Ten dokument definiuje szczegółową strategię wdrożenia manifestu wizualnego V3.0 (**Solar-Ready HD-2D**) dla aplikacji mobilnej SPORT.

## 1. Cele Projektowe (V3.0 Vision)
*   **HD-2D Aesthetic**: Estetyka retro-gamingowa inspirowana *Octopath Traveler* i *Metal Slug*.
*   **Solar Mode**: Tryb wysokiego kontrastu (12:1) zapewniający czytelność w pełnym słońcu.
*   **Hyper-Performance**: Stabilne 60-120 FPS przy użyciu Skia i React Native Bridgeless.
*   **Immersyjność**: Sprzężenie zwrotne (Haptics) i dynamiczne animacje typu "Sprite".

---

## 2. Etapy Wdrożenia

### Faza 1: Fundament Wizualny & System Tokenów (Research & Setup)
*   [x] **Migracja Tokenów**: Przeniesienie definicji z `assets/branding/design_tokens.json` do `tamagui.config.ts`.
*   [x] **Pixel-Perfect Scaling**: Konfiguracja bazowego modułu skalowania dla różnych gęstości ekranu (utrzymanie efektu "pixel art").
*   [x] **Typografia retro**: Implementacja fontów typu 'Press Start 2P' dla nagłówków i 'Inter' dla czytelności treści.

### Faza 2: Silnik Motywów & Solar Mode (Theming Engine)
*   [x] **Switch Kontrastu**: Implementacja dynamicznego przełącznika między trybem "Deep Sea" (Dark) a "Solar Mode" (High Contrast Light).
*   [x] **Adaptive Assets**: Mechanizm podmiany ikon SVG w zależności od aktywnego kontrastu (czarne obrysy vs. wysoki kontrast).
*   [x] **Sensors Integration**: (Opcjonalnie) Automatyczna aktywacja Solar Mode na podstawie czujnika natężenia światła.

### Faza 3: Komponenty "Sprite-UI" (Atomowe Elementy)
*   [x] **HD2D Button**: Przycisk z 1px czarnym obrysem, twardym cieniem (shadow: 4px) i brakiem zaokrągleń (Radius 0).
*   [x] **Retro Cards**: Kontenery z teksturą imitującą interfejsy z gier RPG.
*   [x] **Pixel-Stats**: Komponenty metryk wykorzystujące Skia do renderowania płynnych wykresów w stylu 8-bit.
*   [x] **Haptic Feedback**: Integracja `expo-haptics` z każdym elementem interaktywnym.

### Faza 4: Ekrany Funkcjonalne (Screen Overhaul)
*   [x] **HUD (TrackingScreen)**: Przebudowa ekranu śledzenia na wzór HUD-a z gry sportowej (duże, czytelne metryki, Live-Ghost na mapie).
*   [x] **Onboarding RPG Flow**: Animowane przejścia między krokami konfiguracji profilu.
*   [x] **Leaderboard Gamification**: Wizualizacja rankingów z użyciem avatarów w stylu sprite'ów.

### Faza 5: Optymalizacja & Walidacja (Performance & QA)
*   [x] **Frame-Rate Audit**: Testy na urządzeniach fizycznych (cel: brak spadków poniżej 60 FPS podczas śledzenia GPS).
*   [x] **Accessibility Check**: Weryfikacja czytelności Solar Mode w warunkach polowych.
*   [x] **Battery Impact**: Optymalizacja renderowania Skia w celu oszczędzania energii.

---

## 3. Stos Technologiczny (Mobile Stack)
*   **Styling**: Tamagui (Compiler-optimized UI).
*   **Graphics**: React Native Skia (2D High-performance graphics).
*   **State**: Legend-State (Zero-proxy performance).
*   **Icons**: Custom SVG Sprites + Lucide React Native (jako fallback).
*   **Navigation**: React Navigation (Native Stack).

---

## 4. Definicja Sukcesu (DoD)
1.  Aplikacja wspiera pełny cykl zmiany motywu (Dark -> Solar) bez przeładowania.
2.  Wszystkie kluczowe komponenty UI posiadają 1px czarny obrys (Sprite-style).
3.  HUD wyświetla dane w czasie rzeczywistym z opóźnieniem < 16ms (60 FPS).
4.  Interfejs jest w pełni czytelny przy natężeniu światła zewnętrznego > 10,000 lux (Solar Mode).
