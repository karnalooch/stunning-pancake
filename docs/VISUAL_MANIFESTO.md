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

### 3.1. System "Character Cut-ins"
Kluczowe powiadomienia są przekazywane przez sprite'y postaci wyskakujące zza krawędzi ekranu.
- **Fizyka**: Animacje typu `Spring` dla efektu dynamicznego "wskoczenia".
- **Idle State**: Postacie wykonują zapętloną animację "pływania" (Floating Idle).
- **Dialogi**: Tekst z efektem "Typewriter" (maszyna do pisania).

### 3.2. Mikro-interakcje HD-2D
- **Button Press**: Przesunięcie o 2px w dół (efekt mechanicznego kliknięcia).
- **Shadows**: Twarde cienie (`shadowRadius: 0`), przesunięcie 4px 4px.

## 4. Rejestr Zasobów Wizualnych

### 4.1. Branding i Design Tokens
| Zasób | Opis | Lokalizacja |
| :--- | :--- | :--- |
| **Design Tokens** | Definicja kolorów, typografii (Solar Mode) | `assets/branding/design_tokens.json` |
| **Logo (Dark/Light)**| Pełne logo w wariantach jasnym i ciemnym | `assets/branding/logo_full_*.svg` |
| **Sygnet / Icon** | Uproszczona ikona logo | `assets/branding/logo_icon.svg` |

### 4.2. Zasoby Wygenerowane (HD-2D V3.0)
Zlokalizowane w: `mobile/assets/generated/`

| Nazwa Pliku | Kategoria | Przeznaczenie |
| :--- | :--- | :--- |
| `nav_home.png` | Navigation | Ekran Główny (Tawerna) |
| `nav_history.png` | Navigation | Historia Treningów (Stoper) |
| `nav_ranking.png` | Navigation | Rankingi (Podium) |
| `nav_rewards.png` | Navigation | Nagrody (Skrzynia) |
| `nav_profile.png` | Navigation | Profil Sportowca |
| `hud_heart.png` | HUD | Tętno (Pixel Heart) |
| `hud_gps.png` | HUD | Status sygnału GPS |
| `hud_battery.png` | HUD | Stan baterii |
| `runner_sprite.png`| Sprites | Zawodnik: Biegacz |
| `cyclist_sprite.png`| Sprites | Zawodnik: Rowerzysta |
| `ghost_sprite.png` | Sprites | Przeciwnik / Duch (Ghost Mode) |
| `elite_sprite.png` | Sprites | Zawodnik: Poziom Elitarny |
| `reward_trophy.png` | Rewards | Puchar / Trofeum |
| `icon_strava.png` | Systems | Integracja Strava |
| `icon_garmin.png` | Systems | Integracja Garmin |

---
*Dokument stanowi jedyne źródło prawdy (SSOT) dla warstwy wizualnej projektu.*
