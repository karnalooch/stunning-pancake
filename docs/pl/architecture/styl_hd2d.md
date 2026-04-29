# Konstytucja SPORT: Styl Hybrydowy HD-2D (Octopath-Diver Core)

**Zatwierdzono przez:** Właściciel Projektu SPORT
**Status:** OBOWIĄZUJĄCY

Niniejszy aneks do Konstytucji SPORT definiuje nowy fundament wizualny oraz zasady projektowania interfejsu użytkownika.

---

## 🏗️ 1. STYL: HYBRYDOWY HD-2D (Octopath-Diver Core)
Projekt odrzuca generyczny, korporacyjny minimalizm na rzecz gęstego, nasyconego detalami pixel-artu, wspieranego przez nowoczesne silniki oświetlenia i głębi.

### 1.1 Estetyka Spritów
- **Inspiracja:** Mieszanka precyzyjnych spritów z *Octopath Traveler* z organiczną lekkością *Dave the Diver*.
- **Technika:** Każdy element UI (ikony sportów, awatary, odznaki) musi posiadać wyraźny, 1-pikselowy czarny outline dla maksymalnej separacji od tła.
- **Głębia:** Wykorzystanie shaderów i efektów Bloom/Glow na krawędziach elementów interaktywnych, przy zachowaniu surowej siatki pikseli.

### 1.2 Kolorystyka "High-Noon Invectus"
- **Priorytet:** Widoczność w pełnym słońcu (Outdoor Focus).
- **Kontrast:** Stosunek kontrastu (Contrast Ratio) dla kluczowych metryk (Tempo, Dystans) MUSI wynosić minimum 12:1.
- **Paleta:**
  - **Action Cyan (`#00F0FF`)** – jaskrawy błękit dla aktywnych elementów.
  - **Solar Yellow (`#FFF200`)** – ostrzeżenia i strefy tętna, przebijające się przez refleksy słońca.
  - **Void Black (`#050505`)** – głęboka czerń tła dla trybu wysokiego kontrastu.

---

## 🏃 2. ANIMACJA: FRAME-PERFECT FLUIDITY (Metal Slug Standard)
Animacje w aplikacji SPORT nie są tylko ozdobą – są informacją zwrotną o wysiłku.

### 2.1 Dynamika Ruchu
- **Płynność:** Animacje przejść i stanów (np. pulsowanie ikony GPS, naliczanie punktów) muszą być renderowane w 120 FPS (na wspieranych urządzeniach).
- **Styl:** "Squash and Stretch" rodem z *Metal Slug*. Elementy UI reagują fizycznie na dotyk – uginają się, sprężynują, dając soczysty, niemal fizyczny feedback (*Juicy UI*).
- **VFX:** Przy osiąganiu celów (np. 10km) aplikacja generuje kaskadę cząsteczek pixel-artowych, symulującą wybuch radości w stylu arkadowym.

---

## ☀️ 3. INTERFEJS: SOL-READY HUD
Interfejs sesji sportowej musi być czytelny, gdy użytkownik jest w pełnym biegu, a słońce uderza bezpośrednio w ekran.

### 3.1 Typografia "Titan-Pixel"
- **Font:** Customowy, gruby font pixelowy o wysokiej gęstości (X-height).
- **Rozmiar:** Kluczowe cyfry (metryki sesji) zajmują minimum 40% powierzchni ekranu HUD.
- **Anti-Glare:** Rezygnacja z subtelnych gradientów wewnątrz tekstu na rzecz jednolitych, jaskrawych płaszczyzn.

### 3.2 Dynamiczna Adaptacja
- **Solar Mode:** Automatyczne przełączanie na profil "Ultra-Contrast" przy wykryciu wysokiego natężenia światła przez czujnik oświetlenia (Ambient Light Sensor).
- **Haptic feedback:** Każda zmiana stanu animacji (np. pauza/start) wspierana jest przez precyzyjne wibracje (Taptic Engine), eliminując potrzebę ciągłego patrzenia na ekran.

---

## 🛠️ 4. TECHNICZNY STOS IMPLEMENTACYJNY
Aby osiągnąć ten look przy zachowaniu wydajności:
- **Silnik:** *React Native Skia* dla renderowania spritów i shaderów w wątku UI.
- **Zasoby:** Wszystkie assety w formacie `.webp` (bezstratny pixel-art) lub SVG z rasteryzacją do Canvas.
- **Obliczenia:** Logika animacji przeniesiona do *Reanimated Worklets* (60/120 FPS).
