# MANIFEST WIZUALNY (VISUAL MANIFESTO) — SPORT V3.0

## 1. Filozofia Estetyki: HD-2D Gaming Fusion
Projekt SPORT to wysokowydajna platforma grywalizacji przeznaczona dla **rowerzystów i biegaczy**. Odchodzi ona od klasycznego stylu "Neon Black" na rzecz immersyjnej estetyki retro-gamingowej w standardzie HD-2D.

### Kluczowe Inspiracje:
- **Octopath Traveler**: Miękki bloom, kinowe oświetlenie, efekt tilt-shift oraz dynamiczne cieniowanie.
- **Metal Slug**: Ekstremalny detal przemysłowy, "mięsiste" (chunky) kształty i ręcznie dopracowane sprite'y.
- **Dave the Diver**: Żywa, morska paleta kolorów (Vibrant Maritime), błękity głębinowe i soczyste akcenty.

## 2. Standard Techniczny Assetów
Wszystkie zasoby graficzne muszą spełniać następujące kryteria:
- **Styl**: Masterpiece high-fidelity HD-2D sprite.
- **Obrysy**: Pixel-perfect, 1px ostre czarne krawędzie (crisp black outlines).
- **Kolorystyka**: 32-bit color, wysoki kontrast (Solar Mode optimized).
- **Kompozycja**: Izolacja na czystym białym tle.

## 3. Dynamika i Animacje (Interaction Patterns)
Interfejs ożywa dzięki systemowi dynamicznych interakcji inspirowanych grami.

### 3.1. System "Character Cut-ins" (PopUpDialog)
Kluczowe powiadomienia, questy i komunikaty systemowe są przekazywane przez dynamiczny komponent `PopUpDialog.tsx`.
- **Mechanika Wejścia**: Animacja `Spring` (damping: 14, stiffness: 100) — postać "wskakuje" z dołu ekranu.
- **Efekt Ożywienia**: Zapętlone "pływanie" (`Floating Idle`) o amplitudzie 8px, nadające postaciom organiczny charakter.
- **Narracja**: System `Typewriter` (40ms per char) z migającym kursorem `_` w kolorze akcentowym (`#D4A373`).
- **Design**: Ramki z twardymi cieniami (4px offset) i pikselowymi narożnikami (`#FF6B35`).

### 3.2. Mikro-interakcje HD-2D
- **Przycisk (HD2DButton)**: Symulacja mechanicznego przełącznika — przesunięcie o 2px w dół przy dotyku.
- **Karty (RetroCard)**: Kontenery z obramowaniem 1px i brakiem zaokrągleń (Radius: 0).

## 4. Rejestr Zasobów Wizualnych (STATUS: CLEAN SLATE)
*Uwaga: Folder `assets/generated/` został wyczyszczony. Poniższa lista stanowi kolejkę do generowania.*

| Nazwa Pliku | Kategoria | Status | Przeznaczenie |
| :--- | :--- | :--- | :--- |
| `nav_home.png` | Navigation | 🛑 MISSING | Ekran Główny |
| `nav_history.png` | Navigation | 🛑 MISSING | Historia Treningów |
| `nav_ranking.png` | Navigation | 🛑 MISSING | Rankingi |
| `nav_rewards.png` | Navigation | 🛑 MISSING | Nagrody |
| `nav_profile.png` | Navigation | 🛑 MISSING | Profil Sportowca |
| `hud_heart.png` | HUD | 🛑 MISSING | Tętno |
| `hud_gps.png` | HUD | 🛑 MISSING | Status GPS |
| `hud_battery.png` | HUD | 🛑 MISSING | Stan baterii |
| `runner_sprite.png`| Sprites | 🛑 MISSING | Postać: Biegacz |
| `cyclist_sprite.png`| Sprites | 🛑 MISSING | Postać: Kolarz |
| `ghost_sprite.png` | Sprites | 🛑 MISSING | Postać: Duch |
| `elite_sprite.png` | Sprites | 🛑 MISSING | Postać: Elite |
| `reward_trophy.png` | Rewards | 🛑 MISSING | Trofea |
| `icon_strava.png` | Systems | 🛑 MISSING | Strava |
| `icon_garmin.png` | Systems | 🛑 MISSING | Garmin |

---
*Dokument stanowi jedyne źródło prawdy (SSOT) dla warstwy wizualnej projektu.*
