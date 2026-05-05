# DESIGN.MD — STITCH: KOMPLETNY REDESIGN APLIKACJI MOBILNEJ SPORT

> **Kryptonim**: STITCH  
> **Pozycjonowanie**: Platforma rywalizacji między miastami — bezpośredni rywal *Aktywnych Miast*  
> **Estetyka**: HD-2D Pixel-Art Gaming Fusion (współczesne gry pixelartowe: *Octopath traveller 2*)  
> **Nazewnictwo**: Standard branżowy Garmin/Strava + unikalne elementy rywalizacji miejskiej  
> **Docelowy UX**: Aplikacja dla kolarzy i biegaczy w ekosystemie rywalizacji miejskiej B2B/B2C  

---

## 1. POZYCJONOWANIE KONKURENCYJNE (vs. Aktywne Miasta)

SPORT nie jest kolejną apką fitness. To **platforma rywalizacji między miastami** z pełnym ekosystemem:

| Cech różnicujący | SPORT (STITCH) | Aktywne Miasta |
|:---|:---|:---|
| **Model biznesowy** | B2B (White-Label dla miast/korporacji) + B2C | Głównie B2C |
| **Anti-Cheat** | 4-warstwowy (Kinematic Gate → V-max → BRouter → Viterbi HMM) | Podstawowy |
| **Weryfikacja tras** | BRouter/OSM + uczenie maszynowe | Brak zaawansowanej |
| **Estetyka** | HD-2D retro-gaming, pixel-art, imersja | Standardowe UI mobilne |
| **Tryb terenowy** | Solar Mode (kontrast 12:1) — czytelność w pełnym słońcu | Brak |
| **Integracje wearable** | Strava + Garmin (dwukierunkowy sync) | Ograniczone |
| **Kluby miejskie** | Tak — rywalizacja międzyklubowa w obrębie miasta | Ograniczone |
| **POI/Checkpointy** | Fizyczne punkty w mieście z voucher'ami | Brak |
| **Sponsoring lokalny** | Marketplace z nagrodami od lokalnych firm | Brak |

Kluczowe ekrany, które **muszą** istnieć by konkurować z Aktywnymi Miastami:
- **City Hub** — panel pokazujący wyniki miasta vs inne miasta
- **Wydarzenia / Eventy** — organizowane przez miasto zawody
- **Anty-Cheat Transparency** — widoczny status weryfikacji każdej aktywności
- **White-Label Branding** — każdy tenant (miasto) ma własną skórkę

---

## 2. SYSTEM KOLORYSTYCZNY (COLOR SYSTEM) — WINDOWS 11

Kolorystyka STITCH opiera się na języku projektowym **Windows 11 (WinUI 3)** — czystym, nowoczesnym, dostępnym. System tokenów w [`shared/tokens/colors.json`](shared/tokens/colors.json) i [`mobile/src/theme/`](mobile/src/theme/) stanowi **jedyne źródło prawdy (SSOT)**.

### 2.1 Filozofia Kolorystyczna

STITCH adaptuje zasady **Windows 11 Fluent Design** do kontekstu aplikacji mobilnej dla kolarzy:

| Zasada WinUI | Adaptacja w STITCH |
|:-------------|:-------------------|
| **Czystość i przejrzystość** | Płaskie, matowe powierzchnie bez gradientów. Wyraźny kontrast między warstwami. |
| **Akryl/Mica** | Subtelne tła kart — ciemniejszy/jaśniejszy odcień tła bazowego, symulujący efekt Mica na mobile. |
| **Akcent Windows Blue** | `#0078D4` w obu motywach jako primary CTA i akcenty interaktywne. |
| **Wysoki kontrast** | Minimum 7:1 dla tekstu głównego w obu motywach, zgodnie z WCAG AA. |
| **Spójność semantyczna** | Kolory success/warning/error są adaptowane do jasnego/ciemnego tła, zachowując to samo znaczenie. |

**Żelazne zasady pixel-art (zachowane z HD-2D):**
- Każdy element UI ma **czarny obrys 1px** (`#000000`) — zero wyjątków
- Cienie są **twarde** (offset 4px, blur 0, `#000000`)
- Radius: **0** — wszystkie elementy są prostokątne
- Font: **Press Start 2P** dla nagłówków, **Segoe UI Variable** (systemowy Win11) dla body text

### 2.2 Prymitywy (Primitive Tokens) — 20 bazowych wartości

Tokeny prymitywne to niezmienne, bazowe wartości kolorów. Nie są używane bezpośrednio w komponentach — zawsze przez aliasy semantyczne lub tematyczne. **Kolory są identyczne w obu motywach** (true primitives).

| Token | Wartość HEX | Opis | Źródło WinUI |
|:------|:------------|:-----|:-------------|
| `winBlue` | `#0078D4` | Windows accent blue — główny kolor interakcji | AccentBlue |
| `winBlueLight` | `#60CDFF` | Jasny niebieski — akcent na ciemnym tle | AccentLight |
| `winBlueDark` | `#004C87` | Ciemny niebieski — akcent na jasnym tle | AccentDark |
| `winGreen` | `#107C10` | Zieleń sukcesu | SystemGreen |
| `winGreenLight` | `#6CCB5F` | Jasna zieleń — sukces na ciemnym | SystemGreenLight |
| `winRed` | `#E81123` | Czerwień błędu | SystemRed |
| `winRedLight` | `#FF99A4` | Jasna czerwień — błąd na ciemnym | SystemRedLight |
| `winOrange` | `#FF8C00` | Pomarańczowy — ostrzeżenie | SystemOrange |
| `winYellow` | `#FCE100` | Żółty — ostrzeżenie na ciemnym | SystemYellow |
| `pixelBlack` | `#000000` | Czerń absolutna — kontury/cienie | (HD-2D) |
| `winWhite` | `#FFFFFF` | Biel — tekst inverse, ikony na ciemnych przyciskach | White |
| `winGray05` | `#F9F9F9` | Jasnoszary — tło Light Mode | BgLight |
| `winGray10` | `#F3F3F3` | Szary — podniesione tło Light | BgElevatedLight |
| `winGray20` | `#E0E0E0` | Szary — obramowania Light | BorderLight |
| `winGray60` | `#616161` | Średnioszary — tekst drugorzędny | TextSecondary |
| `winGray90` | `#1A1A1A` | Ciemnoszary — tekst główny Light | TextPrimary |
| `winGray100` | `#1F1F1F` | Prawie czarny — tło Dark Mode | BgDark |
| `winGray110` | `#2B2B2B` | Ciemnoszary — karty Dark Mode | BgElevatedDark |
| `winGray120` | `#383838` | Szary — podniesione karty Dark | BgElevatedDark2 |
| `winGray130` | `#404040` | Szary — obramowania Dark | BorderDark |

### 2.3 Kolory Semantyczne (Semantic Tokens) — 6 aliasów funkcjonalnych

Używane w każdym komponencie do komunikacji stanu/akcji. **Zawsze** przez `tokens.semantic.*`.

| Token | Mapowanie | Wartość (Dark Mode) | Wartość (Light Mode) | Przeznaczenie |
|:------|:----------|:--------------------|:---------------------|:--------------|
| `primary` | `winBlue` | `#60CDFF` | `#0078D4` | Główny kolor brandu, CTA, akcenty, linki |
| `secondary` | `winGray60` | `#ABABAB` | `#616161` | Drugorzędny kolor, ikony, separatory |
| `success` | `winGreen` | `#6CCB5F` | `#107C10` | Sukces, potwierdzenie, wzrost, XP, GPS OK |
| `warning` | `winOrange` | `#FCE100` | `#FF8C00` | Ostrzeżenie, uwaga, pending, GPS weak |
| `error` | `winRed` | `#FF99A4` | `#E81123` | Błąd, destrukcja, reject, low battery, GPS lost |
| `info` | `winBlueLight` | `#60CDFF` | `#0078D4` | Informacja, neutralny, tooltipy |

**Zastosowanie w ekranach STITCH:**

| Ekran | primary | success | warning | error | info |
|:------|:--------|:--------|:--------|:------|:-----|
| **Dashboard** | CTA "START RIDE", city accent | Daily goal progress | — | — | Weather widget |
| **Tracking HUD** | Distance glow, PB badge | GPS good (●) | GPS weak (●) | Low battery flash | — |
| **Activity Detail** | Verification Grade S/A accent | Grade A/B, HR Zone 2 | Grade C | Grade D | Splits table |
| **City Hub** | City position highlight | Overtake progress bar | — | — | City stats |
| **Leaderboard** | Podium #1, your rank | Top 10 highlight | — | — | Rank numbers |
| **Marketplace** | XP balance, item border | Buy button, in-stock | Low stock | Out of stock | Sponsor name |
| **Clubs** | Club accent, captain badge | Join button | Pending approval | Leave button | Member count |

### 2.4 Paleta Tematyczna — Windows 11 Dark Mode

**Tryb domyślny**. Ciemne, matowe tła z niebieskimi akcentami. Inspirowany ciemnym motywem Windows 11 (Settings, File Explorer, Terminal).

```
┌─────────────────────────────────────────────────────────┐
│  WARSTWY TŁA (od najgłębszej do najpłytszej)            │
├─────────────────────────────────────────────────────────┤
│  1. #1F1F1F (winGray100)         ← Główne tło ekranów   │
│  2. #2B2B2B (winGray110)         ← Tło kart/podniesione  │
│  3. #383838 (winGray120)         ← Karty podniesione     │
│  4. #404040 (winGray130)         ← Hover/active state    │
├─────────────────────────────────────────────────────────┤
│  TEKST (od najważniejszego)                              │
│  1. #FFFFFF (winWhite)           ← Tekst główny          │
│  2. #ABABAB (winGray60 lighter)  ← Tekst drugorzędny     │
│  3. #000000 (pixelBlack)         ← Tekst na niebieskim   │
├─────────────────────────────────────────────────────────┤
│  OBRAMOWANIA                                             │
│  1. #000000 (pixelBlack)         ← Kontury pixel-art 1px │
│  2. #404040 (winGray130)         ← Subtelne obramowania  │
│  3. #60CDFF (winBlueLight)       ← Akcentowe obramowania │
├─────────────────────────────────────────────────────────┤
│  PRZYCISKI                                               │
│  PRIMARY: bg=#0078D4 text=#FFFFFF  ← CTA, akcje          │
│  SUCCESS: bg=#107C10 text=#FFFFFF  ← Confirm/Zapisz      │
│  DANGER:  bg=#E81123 text=#FFFFFF  ← Abort/Delete        │
│  INFO:    bg=#404040 text=#60CDFF  ← Neutral/Secondary   │
│  GHOST:   text=#60CDFF             ← Link/Subtle         │
└─────────────────────────────────────────────────────────┘
```

**Pełna tabela tokenów Win11 Dark (27 tokenów):**

| Token | Wartość | Zastosowanie w ekranach STITCH |
|:------|:--------|:-------------------------------|
| `background` | `#1F1F1F` | Tło wszystkich ekranów |
| `backgroundStrong` | `#2B2B2B` | Tło kart, podniesione sekcje |
| `surface` | `#383838` | GameCard, panele, HUD Cards |
| `text` | `#FFFFFF` | Wszystkie nagłówki, body text |
| `textMuted` | `#ABABAB` | Drugorzędne etykiety, daty, timestampy |
| `textInverse` | `#000000` | Tekst na jasnym/niebieskim tle |
| `border` | `#404040` | Obramowania kart i paneli |
| `borderMuted` | `#2B2B2B` | Subtelne separatory |
| `outline` | `#000000` | Kontur każdego elementu (1px — zasada HD-2D) |
| `buttonPrimaryBg` | `#0078D4` | Przycisk Primary CTA |
| `buttonPrimaryText` | `#FFFFFF` | Tekst na primary przycisku |
| `buttonSuccessBg` | `#107C10` | Przycisk Success/Confirm |
| `buttonSuccessText` | `#FFFFFF` | Tekst na success przycisku |
| `buttonDangerBg` | `#E81123` | Przycisk Danger/Abort/Delete |
| `buttonDangerText` | `#FFFFFF` | Tekst na danger przycisku |
| `buttonInfoBg` | `#404040` | Przycisk Info/Neutral |
| `buttonInfoText` | `#60CDFF` | Tekst na info przycisku |
| `buttonGhostText` | `#60CDFF` | Przycisk ghost (bez tła) |
| `cardDefaultBg` | `#2B2B2B` | Karta domyślna (dashboard, city hub) |
| `cardElevatedBg` | `#383838` | Karta podniesiona (ranking, statystyki) |
| `cardSubtleBg` | `#1F1F1F` | Karta subtelna (osadzona w tle) |
| `cardAccentBg` | `#2B2B2B` | Karta akcentowa (premium, rekordy) |
| `cardAccentBorder` | `#60CDFF` | Obramowanie karty akcentowej |
| `tabBarBg` | `#1F1F1F` | Tło dolnego paska nawigacji |
| `tabBarBorder` | `#404040` | Górna krawędź tab bara |
| `tabActiveText` | `#60CDFF` | Tekst aktywnej zakładki |
| `tabInactiveText` | `#ABABAB` | Tekst nieaktywnej zakładki |

### 2.5 Paleta Tematyczna — Windows 11 Light Mode

**Tryb dzienny**. Jasne, czyste tła z niebieskimi akcentami. Inspirowany jasnym motywem Windows 11.

```
┌─────────────────────────────────────────────────────────┐
│  WARSTWY TŁA                                            │
├─────────────────────────────────────────────────────────┤
│  1. #F9F9F9 (winGray05)          ← Główne tło ekranów   │
│  2. #FFFFFF (winWhite)           ← Tło kart             │
│  3. #F3F3F3 (winGray10)          ← Karty podniesione     │
│  4. #E0E0E0 (winGray20)          ← Hover/active state   │
├─────────────────────────────────────────────────────────┤
│  TEKST                                                  │
│  1. #1A1A1A (winGray90)          ← Tekst główny          │
│  2. #616161 (winGray60)          ← Tekst drugorzędny     │
│  3. #FFFFFF (winWhite)           ← Tekst na ciemnym tle  │
├─────────────────────────────────────────────────────────┤
│  OBRAMOWANIA                                             │
│  1. #000000 (pixelBlack)         ← Kontury pixel-art 1px │
│  2. #E0E0E0 (winGray20)          ← Subtelne obramowania  │
│  3. #0078D4 (winBlue)            ← Akcentowe obramowania │
├─────────────────────────────────────────────────────────┤
│  PRZYCISKI                                               │
│  PRIMARY: bg=#0078D4 text=#FFFFFF  ← CTA, akcje          │
│  SUCCESS: bg=#107C10 text=#FFFFFF  ← Confirm/Zapisz      │
│  DANGER:  bg=#E81123 text=#FFFFFF  ← Abort/Delete        │
│  INFO:    bg=#F3F3F3 text=#0078D4  ← Neutral/Secondary   │
│  GHOST:   text=#0078D4             ← Link/Subtle         │
└─────────────────────────────────────────────────────────┘
```

**Pełna tabela tokenów Win11 Light (27 tokenów):**

| Token | Wartość | Zastosowanie |
|:------|:--------|:-------------|
| `background` | `#F9F9F9` | Tło wszystkich ekranów |
| `backgroundStrong` | `#FFFFFF` | Tło kart, podniesione sekcje |
| `surface` | `#F3F3F3` | GameCard, panele |
| `text` | `#1A1A1A` | Wszystkie nagłówki, body text (kontrast 16:1) |
| `textMuted` | `#616161` | Drugorzędne etykiety, daty (kontrast 6:1) |
| `textInverse` | `#FFFFFF` | Tekst na ciemnym/niebieskim tle |
| `border` | `#E0E0E0` | Obramowania kart i paneli |
| `borderMuted` | `#F3F3F3` | Subtelne separatory |
| `outline` | `#000000` | Kontur każdego elementu (1px — zasada HD-2D) |
| `buttonPrimaryBg` | `#0078D4` | Przycisk Primary CTA |
| `buttonPrimaryText` | `#FFFFFF` | Tekst na primary przycisku |
| `buttonSuccessBg` | `#107C10` | Przycisk Success/Confirm |
| `buttonSuccessText` | `#FFFFFF` | Tekst na success przycisku |
| `buttonDangerBg` | `#E81123` | Przycisk Danger/Abort/Delete |
| `buttonDangerText` | `#FFFFFF` | Tekst na danger przycisku |
| `buttonInfoBg` | `#F3F3F3` | Przycisk Info/Neutral |
| `buttonInfoText` | `#0078D4` | Tekst na info przycisku |
| `buttonGhostText` | `#0078D4` | Przycisk ghost (bez tła) |
| `cardDefaultBg` | `#FFFFFF` | Karta domyślna (dashboard, city hub) |
| `cardElevatedBg` | `#F3F3F3` | Karta podniesiona (ranking, statystyki) |
| `cardSubtleBg` | `#F9F9F9` | Karta subtelna (osadzona w tle) |
| `cardAccentBg` | `#FFFFFF` | Karta akcentowa (premium, rekordy) |
| `cardAccentBorder` | `#0078D4` | Obramowanie karty akcentowej |
| `tabBarBg` | `#F9F9F9` | Tło dolnego paska nawigacji |
| `tabBarBorder` | `#E0E0E0` | Górna krawędź tab bara |
| `tabActiveText` | `#0078D4` | Tekst aktywnej zakładki |
| `tabInactiveText` | `#616161` | Tekst nieaktywnej zakładki |

### 2.6 Warianty Kart (Card Variants)

STITCH używa 5 wariantów kart `GameCard`, każdy z dedykowaną kolorystyką:

| Wariant | Dark Mode BG | Dark Mode Border | Light Mode BG | Light Mode Border | Przeznaczenie |
|:--------|:-------------|:-----------------|:--------------|:------------------|:--------------|
| **default** | `#2B2B2B` | `#404040` | `#FFFFFF` | `#E0E0E0` | Dashboard, City Hub, główne karty |
| **elevated** | `#383838` | `#404040` | `#F3F3F3` | `#E0E0E0` | Listy aktywności, ranking, kluby |
| **subtle** | `#1F1F1F` | `#2B2B2B` | `#F9F9F9` | `#F3F3F3` | Onboarding, Marketplace, POI Detail |
| **accent** | `#2B2B2B` | `#60CDFF` | `#FFFFFF` | `#0078D4` | Karty premium, rekordy, achievementy |
| **surface** | `#1F1F1F` | `#404040` | `#F9F9F9` | `#E0E0E0` | Podsekcje wewnątrz innych kart (HUD) |

**Zastosowanie na nowych ekranach:**

| Ekran | Dominujący wariant karty |
|:------|:-------------------------|
| Dashboard (Pre-Ride) | `default` — karta pogody, `elevated` — ostatnia aktywność |
| Ride Summary | `accent` — rekordy, `default` — stats grid |
| Training Log | `elevated` — każda aktywność |
| Activity Detail | `default` — stats grid, `elevated` — splity, `subtle` — segmenty |
| Performance | `default` — wykresy, `accent` — rekordy osobiste |
| City Hub | `default` — city banner, `elevated` — aktywności feed |
| Leaderboard | `elevated` — lista rankingu, `accent` — podium #1 |
| Clubs Directory | `elevated` — karty klubów |
| Club Detail | `default` — header, `elevated` — członkowie |
| Club Challenges | `default` — aktywne wyzwania, `subtle` — przeszłe |
| Events | `default` — aktywne eventy, `elevated` — przeszłe |
| Segments | `elevated` — lista, `accent` — KOM/QOM |
| Personal Heatmap | `surface` — stats overlay |
| POI Map | `subtle` — POI Detail |
| Marketplace | `subtle` — nagrody, `elevated` — historia transakcji |
| Profile | `default` — stats, `elevated` — menu items |
| Settings | `elevated` — każda sekcja ustawień |

### 2.7 Kolory Funkcjonalne w Efektach Pixel-Art

Kolorystyka efektów wizualnych STITCH (cząsteczki, animacje, post-process) — Windows 11 palette:

| Efekt | Kolor(y) | Zastosowanie |
|:------|:---------|:-------------|
| **XP Sparks** | `#0078D4` (winBlue) + `#60CDFF` (winBlueLight) | Milestone, achievement |
| **Speed Lines** | `#FFFFFF` (white, opacity 0.6) / `#1A1A1A` (light mode) | Prędkość > 35 km/h |
| **Dust Trail** | `#ABABAB` (textMuted) + `#616161` (winGray60) | Jazda terenowa |
| **Heart Particles** | `#E81123` (error) / `#FF99A4` (dark mode) | Wejście w HR Zone 4-5 |
| **Confetti Burst** | `#0078D4`, `#107C10`, `#FF8C00`, `#60CDFF` | Rekord osobisty |
| **Low Battery Flash** | `#E81123` (error, opacity pulse 0→0.3) | Bateria < 10% |
| **GPS Good** | `#107C10` (success) | Dokładność < 10m |
| **GPS Weak** | `#FF8C00` (warning) | Dokładność 10-50m |
| **GPS Lost** | `#E81123` (error) | Dokładność > 50m |
| **PB Shimmer** | `#60CDFF` → `#FFFFFF` → `#60CDFF` (palette cycle) | Rekord, Grade S |
| **Vignette** | `#000000` (pixelBlack, opacity 0→0.4 na rogach) | Tryb ciemny, focus na centrum |
| **Bloom** | `#60CDFF` (winBlueLight, blur radius) | Ważne elementy UI |
| **Accent Border Glow** | `#0078D4` (winBlue) | Karty premium |
| **CRT Scanlines** | `#000000` (pixelBlack, opacity 0.05 co 2px) | Opcjonalny overlay |
| **Time-of-Day Tint** | Morning: `#FF8C00`, Day: brak, Dusk: `#0078D4`, Night: `#1F1F1F` | Dashboard, mapa |

### 2.8 White-Label & Tenant Branding

Każdy tenant (miasto/korporacja) może nadpisać kolory brandu. System obsługuje to przez [`BrandingService`](mobile/src/services/BrandingService.ts) i dynamiczne nadpisywanie theme:

```typescript
// mobile/src/theme/unistyles.ts — interface AppTheme
branding?: {
    primary: string;      // Nadpisuje accent blue → tenant brand color
    secondary: string;    // Nadpisuje secondary gray → tenant secondary
    background?: string;  // Opcjonalne nadpisanie tła
    surface?: string;     // Opcjonalne nadpisanie kart
    text?: string;        // Opcjonalne nadpisanie tekstu
    border?: string;      // Opcjonalne nadpisanie obramowań
}
```

**Przykłady tenant branding:**

| Tenant | primary | secondary | Efekt |
|:-------|:--------|:----------|:------|
| **Siedlce (domyślny)** | `#0078D4` (winBlue) | `#616161` (gray) | Domyślna paleta Windows 11 |
| **Warszawa** | `#E83A14` (czerwień warszawska) | `#005A9C` (niebieski) | Barwy miasta |
| **Kraków** | `#005A9C` (niebieski) | `#FFFFFF` (biały) | Barwy miasta |
| **Korporacja X** | `#FF6600` (brand orange) | `#333333` (brand dark) | Brand korporacyjny |

Nadpisania tenant'a wpływają na:
- Kolor CTA i akcentów (tam gdzie używany `primary`)
- Kolor podświetlenia aktywnej zakładki
- Kolor obramowań akcentowych
- Logo w City Hub i na ekranach z brandingiem miasta

### 2.9 Mapa Kolorów na Ekranach (Visual Color Map)

```
DARK MODE (win11dark)

DASHBOARD (Pre-Ride)           TRACKING HUD                RIDE SUMMARY
┌────────────────────┐         ┌────────────────────┐      ┌────────────────────┐
│ #1F1F1F BG         │         │ Transparent overlay │      │ #1F1F1F BG         │
│ ┌────────────────┐ │         │ ██ #000 outline     │      │ ┌────────────────┐ │
│ │ #2B2B2B card  │ │         │ #FFF text (HUD)     │      │ │ accent card    │ │
│ │ #0078D4 CTA   │ │         │ #60CDFF distance    │      │ │ #60CDFF border │ │
│ │ #FFF text     │ │         │ #6CCB5F GPS ●       │      │ │ #60CDFF PB!    │ │
│ └────────────────┘ │         │ #FF99A4 lowBatt ██  │      │ └────────────────┘ │
│ ┌────────────────┐ │         │ #ABABAB labels      │      │ ┌────────────────┐ │
│ │ #383838 card  │ │         └────────────────────┘      │ │ #2B2B2B cards │ │
│ │ #ABABAB text  │ │                                      │ │ #FFF stats    │ │
│ └────────────────┘ │                                      │ └────────────────┘ │
└────────────────────┘                                      └────────────────────┘

CITY HUB                      LEADERBOARD                 MARKETPLACE
┌────────────────────┐         ┌────────────────────┐      ┌────────────────────┐
│ #1F1F1F BG         │         │ #1F1F1F BG         │      │ #1F1F1F BG         │
│ ┌────────────────┐ │         │ ┌────────────────┐ │      │ ┌────────────────┐ │
│ │ #2B2B2B city  │ │         │ │ accent #1      │ │      │ │ #2B2B2B wallet│ │
│ │ #60CDFF #1    │ │         │ │ #60CDFF #1     │ │      │ │ #60CDFF XP    │ │
│ │ #FFF "SIEDLCE"│ │         │ │ #FFF name      │ │      │ │ #FFF balance  │ │
│ └────────────────┘ │         │ └────────────────┘ │      │ └────────────────┘ │
│ ┌────────────────┐ │         │ ┌────────────────┐ │      │ ┌────────────────┐ │
│ │ #383838 feed  │ │         │ │ #383838 #2     │ │      │ │ subtle item   │ │
│ │ #ABABAB riders│ │         │ │ #ABABAB avatar │ │      │ │ #6CCB5F ✅    │ │
│ └────────────────┘ │         │ └────────────────┘ │      │ │ #FF99A4 OUT   │ │
└────────────────────┘         └────────────────────┘      │ └────────────────┘ │
                                                           └────────────────────┘

LIGHT MODE (win11light)

DASHBOARD (Pre-Ride)           TRACKING HUD                RIDE SUMMARY
┌────────────────────┐         ┌────────────────────┐      ┌────────────────────┐
│ #F9F9F9 BG         │         │ Transparent overlay │      │ #F9F9F9 BG         │
│ ┌────────────────┐ │         │ ██ #000 outline     │      │ ┌────────────────┐ │
│ │ #FFF card      │ │         │ #1A1A1A text (HUD) │      │ │ accent card    │ │
│ │ #0078D4 CTA   │ │         │ #0078D4 distance    │      │ │ #0078D4 border │ │
│ │ #1A1A1A text  │ │         │ #107C10 GPS ●       │      │ │ #0078D4 PB!    │ │
│ └────────────────┘ │         │ #E81123 lowBatt ██  │      │ └────────────────┘ │
│ ┌────────────────┐ │         │ #616161 labels      │      │ ┌────────────────┐ │
│ │ #F3F3F3 card  │ │         └────────────────────┘      │ │ #FFF cards     │ │
│ │ #616161 text  │ │                                      │ │ #1A1A1A stats │ │
│ └────────────────┘ │                                      │ └────────────────┘ │
└────────────────────┘                                      └────────────────────┘
```

### 2.10 Importowanie Kolorów w Kodzie

Wszystkie komponenty STITCH importują kolory z wygenerowanych tokenów. Nazwy theme slugów zmieniają się na `win11dark` / `win11light`:

```typescript
// Jedyny prawidłowy import kolorów:
import { colors as tokens } from '@tokens/generated/restyle-colors';

// Przykłady użycia — PRIMITIVES (tylko w generatorach/efektach):
tokens.primitive.winBlue        // '#0078D4'
tokens.primitive.winGreen       // '#107C10'
tokens.primitive.pixelBlack     // '#000000'

// Przykłady użycia — SEMANTIC (główny interfejs):
tokens.semantic.primary         // '#60CDFF' (dark) / '#0078D4' (light)
tokens.semantic.success         // '#6CCB5F' (dark) / '#107C10' (light)
tokens.semantic.warning         // '#FCE100' (dark) / '#FF8C00' (light)
tokens.semantic.error           // '#FF99A4' (dark) / '#E81123' (light)

// Przykłady użycia — THEMATIC (kontekst motywu):
tokens.win11dark.background     // '#1F1F1F' — tło dark mode
tokens.win11dark.surface        // '#383838' — karty dark mode
tokens.win11dark.text           // '#FFFFFF' — tekst dark mode
tokens.win11light.background    // '#F9F9F9' — tło light mode
tokens.win11light.surface       // '#F3F3F3' — karty light mode
tokens.win11light.text          // '#1A1A1A' — tekst light mode
```

**Migracja z `octopath`/`solar` → `win11dark`/`win11light`:**
- `tokens.octopath.*` → `tokens.win11dark.*`
- `tokens.solar.*` → `tokens.win11light.*`
- Tokeny semantyczne (`tokens.semantic.*`) pozostają bez zmian w API, zmieniają się tylko wartości HEX

---

## 3. ARCHITEKTURA INFORMACJI — KOMPLETNA MAPA EKRANÓW

```
📱 SPORT — STITCH Redesign
═══════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────┐
│                    5 ZAKŁADEK GŁÓWNYCH                       │
├───────────┬───────────┬───────────┬───────────┬─────────────┤
│  🏠 RIDE  │ 📊 TRAIN  │ 🏆 COMPETE│ 🗺️ EXPLORE│ 👤 PROFILE  │
│  (Home)   │ (Training)│(Compete)  │ (Explore) │  (Profile)  │
└───────────┴───────────┴───────────┴───────────┴─────────────┘

── 🏠 RIDE (Jazda / Główny)
   ├── Dashboard            → Widok przed jazdą: pogoda, cel dnia, sugerowana trasa
   ├── Active Tracking      → HUD podczas aktywności (GPS, metryki, mapa)
   └── Ride Summary         → Podsumowanie po zakończeniu (statystyki, mapa, osiągnięcia)

── 📊 TRAIN (Trening / Historia)
   ├── Training Log         → Lista wszystkich aktywności z filtrami (tydzień/miesiąc/rok)
   ├── Activity Detail      → Pełny widok aktywności: mapa, splity, przewyższenia, HR, segmenty
   ├── Performance          → Trendy: FTP/VO2 Max, training load, fitness/fatigue
   └── Calendar             → Kalendarz treningowy (heatmapa miesięczna)

── 🏆 COMPETE (Rywalizacja)
   ├── City Hub             → **NOWE**: Panel miasta — ranking vs inne miasta, statystyki
   ├── City Leaderboard     → Ranking kolarzy w mieście (istniejący, rozbudowany)
   ├── Global Leaderboard   → **NOWE**: Ranking między miastami
   ├── Clubs Directory      → **NOWE**: Lista klubów, filtrowanie, tworzenie klubu
   ├── Club Detail          → **NOWE**: Profil klubu, członkowie, leaderboard wewnętrzny
   ├── Club Challenges      → **NOWE**: Wyzwania head-to-head między klubami
   ├── Events               → **NOWE**: Wydarzenia organizowane przez miasto/korporację
   └── Segments             → **NOWE**: Segmenty tras, rekordy, porównania

── 🗺️ EXPLORE (Odkrywaj)
   ├── Personal Heatmap     → **NOWE**: Mapa cieplna własnych przejazdów
   ├── POI Map              → **NOWE**: Checkpointy, vouchery, punkty na mapie
   ├── Marketplace          → Sklep z nagrodami (istniejący, rozbudowany)
   └── Route Planner        → **NOWE (aspiracyjny)**: Planowanie tras

── 👤 PROFILE (Profil Zawodnika)
   ├── Athlete Profile      → Profil (istniejący, uproszczony do tożsamości + statystyki)
   ├── My Stats             → **NOWE**: Rekordy osobiste, podsumowania sezonowe
   ├── My Clubs              → **NOWE**: Lista klubów do których należę
   ├── My Challenges         → **NOWE**: Aktywne i przeszłe wyzwania
   └── Settings              → **NOWE**: Ustawienia (wearables, prywatność, personalizacja)
```

---

## 4. EKRAN PO EKRANIE — SPECYFIKACJA

---

### 4.1 🏠 RIDE (Jazda / Strona Główna)

#### 4.1.1 Dashboard (Pre-Ride)
**Plik**: [`mobile/src/screens/RideDashboardScreen.tsx`](mobile/src/screens/RideDashboardScreen.tsx)

**Cel**: Ekran startowy przed rozpoczęciem jazdy. Szybki rzut oka na warunki i gotowość.

**Zawartość:**
- **City Greeting**: "SIEDLCE, POLAND" — nazwa miasta z flagą tenant'a (White-Label)
- **Weather Widget**: Temperatura, wiatr (kierunek + prędkość), szansa opadów, wilgotność
- **Daily Goal**: Pasek postępu do dziennego celu km (np. "18.2 / 30 KM TODAY")
- **City Status**: Mini-ranking "SIEDLCE IS #3 THIS WEEK — 2,841 KM BEHIND LUBLIN" z paskiem postępu
- **Quick Start Button**: "START RIDE" — główny przycisk, natychmiastowe rozpoczęcie śledzenia
- **Last Ride Summary**: Karta z ostatnią aktywnością (mini-podsumowanie: dystans, czas, AVG)
- **Season Stats**: Sezonowe statystyki (total km, rides, elevation gain)

**Efekty pixel-art:**
- Tło z paralaksą — panoramiczny pixel-art miasta o różnych porach dnia (dynamiczny time-of-day)
- Postać kolarza w idle animation (±8px floating) obok przycisku START
- Pasek city-vs-city z ditheringiem (Bayer dissolve) przy aktualizacji

---

#### 4.1.2 Active Tracking (HUD podczas jazdy)
**Plik**: [`mobile/src/screens/RideTrackingScreen.tsx`](mobile/src/screens/RideTrackingScreen.tsx) (refaktor z `TrackingScreen.tsx`)

**Cel**: Główny ekran podczas aktywności — czytelny HUD z kluczowymi metrykami.

**Zawartość (istniejąca + rozszerzenia):**
- **Mapa**: MapLibre z ciemnym/jasnym motywem (zależnie od Solar Mode)
- **HUD Overlay** (auto-hide po 3s, tap to show):
  - **Distance** (duża czcionka, piksele): `18.42 KM`
  - **Speed** (aktualna): `32.4 KM/H`
  - **Pace**: `1:51 /KM`
  - **Heart Rate** + strefa (ikona serca z pulsacją): `142 ♥ Z3`
  - **Elevation Gain**: `▲ 234M`
  - **Elapsed Time**: `01:23:45`
  - **Battery**: ikona z procentem, czerwona <20%
  - **GPS Accuracy**: `GPS: 5M ●` (zielona/żółta/czerwona kropka)
- **Ghost Rider**: Nakładka z własnym rekordem na tej trasie (duch na mapie)
- **Trigger Dialogs**: System `PopUpDialog` — postać wyskakuje z dołu z komunikatem (istniejący)
- **Start/Stop Button**: "START RIDE" / "END RIDE & SAVE" (dół ekranu)

**Efekty pixel-art (nowe):**
- **Screen shake** przy utracie GPS lub osiągnięciu rekordu (amplituda 2-4px, duration 300ms)
- **Particle effects** — cząsteczki kurzu za postacią przy dużej prędkości; iskry XP przy milestone'ach
- **Color cycling** na ikonie tętna (pulsowanie w rytm HR)
- **Speed lines** przy >35 km/h — poziome linie na krawędziach HUD
- **CRT scanlines** (subtelne, toggle) na całym HUD overlay
- **Chromatic aberration** przy zmianie strefy HR (RGB split 1-2px)

---

#### 4.1.3 Ride Summary (Post-Ride)
**Plik**: [`mobile/src/screens/RideSummaryScreen.tsx`](mobile/src/screens/RideSummaryScreen.tsx)

**Cel**: Pełne podsumowanie zakończonej aktywności. Ekran celebration z danymi.

**Zawartość:**
- **Celebration Header**: Animowana postać (victory pose) + "RIDE COMPLETE!"
- **Stats Grid** (kafelki 2×3):
  - Distance (km) | Elapsed Time
  - Avg Speed (km/h) | Elevation Gain (m)
  - Avg Heart Rate | Calories / Power
- **Performance Badge**: Jeśli rekord — "NEW PERSONAL BEST!" z animacją złotego shimmer
- **Verification Grade**: S/A/B/C/D z wyjaśnieniem (Anti-Cheat score) — buduje zaufanie
- **Map Replay Preview**: Miniatura mapy z trasą
- **Achievements Unlocked**: Lista odblokowanych osiągnięć podczas tej jazdy
- **City Contribution**: "+18.42 KM FOR SIEDLCE" — wkład w wynik miasta
- **XP Earned**: "+420 XP" z animacją nabijania
- **Share Button**: Udostępnij do social media / klubów
- **Upload Status**: Pasek postępu sync z backendem

**Efekty pixel-art:**
- **Gold shimmer** na rekordzie osobistym (palette cycling na złotych pikselach)
- **Particle burst** na achievementach (confetti pixel-art)
- **Dithering dissolve** przy przejściu z ekranu śledzenia
- **Typewriter** na tekście gratulacyjnym (istniejący mechanizm, 40ms/char)
- **Screen shake** przy pokazaniu się rekordu

---

### 4.2 📊 TRAIN (Trening)

#### 4.2.1 Training Log (Lista Aktywności)
**Plik**: [`mobile/src/screens/TrainingLogScreen.tsx`](mobile/src/screens/TrainingLogScreen.tsx) (refaktor z `ActivitiesScreen.tsx`)

**Cel**: Lista przeszłych aktywności z filtrami i szybkim podsumowaniem.

**Zawartość (istniejąca + rozszerzenia):**
- **Header**: "TRAINING LOG" + filtry (tydzień / miesiąc / rok / ALL)
- **Summary Bar**: "THIS WEEK: 142 KM · 6 RIDES · 2,340M ↑"
- **Lista aktywności** (istniejąca) rozszerzona o:
  - **Ikona sportu**: 🚴 RIDE / 🏃 RUN / 🚶 WALK
  - **Verification Badge**: Kolorowa plakietka S/A/B/C/D (istniejąca)
  - **Mini mapa**: 48×48 px miniatura trasy (nowe, jeśli backend dostarcza)
  - **Swipe actions**: swipe left → share, swipe right → detail
- **Empty State**: Postać ducha + "NO ACTIVITIES YET. START YOUR FIRST RIDE."

**Nawigacja**: Tap na aktywność → [`ActivityDetailScreen`](mobile/src/screens/ActivityDetailScreen.tsx)

---

#### 4.2.2 Activity Detail
**Plik**: [`mobile/src/screens/ActivityDetailScreen.tsx`](mobile/src/screens/ActivityDetailScreen.tsx) — **NOWY**

**Cel**: Pełna analiza pojedynczej aktywności. Kluczowy ekran, który obecnie NIE ISTNIEJE.

**Zawartość:**
- **Header**: Typ aktywności + data + dystans (np. "RIDE · 12 MAJ 2026 · 42.3 KM")
- **Verification Banner**: "VERIFIED — GRADE A (94%)" z kolorem — buduje zaufanie do platformy
- **Mapa z trasą**: Interaktywna mapa MapLibre z narysowaną trasą (kolor zależny od prędkości/speed gradient)
- **Replay Button**: Animowane odtwarzanie przejazdu na mapie (duch porusza się po trasie)
- **Stats Grid** (kafelki 2×3 lub 3×2):
  - Distance | Duration | Avg Speed
  - Max Speed | Elevation Gain | Avg HR
  - Calories | Power (avg) | Cadence (avg)
- **Splits / Laps**: Lista międzyczasów (co 1 km lub okrążenia)
- **Elevation Profile**: Wykres słupkowy przewyższeń na trasie
- **HR Zones Chart**: Wykres kołowy czasu spędzonego w strefach tętna (Z1-Z5)
- **Speed Graph**: Wykres prędkości w czasie (linia)
- **Matched Segments**: Lista segmentów dopasowanych do trasy + porównanie z rekordem
- **Achievements**: Lista achievementów zdobytych podczas tej jazdy
- **Share / Edit / Delete**: Akcje u dołu

**Efekty pixel-art:**
- **Map replay** z duchem poruszającym się skokowo (2px grid snap)
- **Wykresy w stylu 8-bit** (istniejący `PixelStats` + `SkiaMetrics`)
- **Dithering dissolve** na mapie przy ładowaniu

---

#### 4.2.3 Performance (Wydajność)
**Plik**: [`mobile/src/screens/PerformanceScreen.tsx`](mobile/src/screens/PerformanceScreen.tsx) — **NOWY**

**Cel**: Analiza trendów wydajnościowych. Odpowiednik Garmin Performance / Strava Fitness.

**Zawartość:**
- **Fitness Score**: Wyliczany wskaźnik (0-100) z trendem tygodniowym
- **Training Load**: Wykres obciążenia treningowego (7-dniowa średnia ruchoma)
- **Fitness & Freshness**: Wykres Fitness vs Fatigue vs Form (jak w TrainingPeaks/Intervals.icu)
- **VO2 Max Estimate**: Szacowane VO2 Max z trendem (jeśli dane HR dostępne)
- **Power Curve**: Wykres mocy w funkcji czasu (best efforts: 5s, 30s, 1min, 5min, 20min, 60min)
- **Weekly Summary**: Słupki km na tydzień + trend
- **Personal Records**: Lista rekordów (najdłuższy dystans, najwyższa prędkość, najwięcej przewyższeń, etc.)

**Efekty pixel-art:**
- **Wykresy Skia** z efektem 8-bit (istniejący `SkiaMetrics`)
- **Animowane słupki** przy pierwszym renderowaniu (rosną od dołu)
- **Number tweening** — cyfry przewijają się do aktualnej wartości

---

#### 4.2.4 Calendar (Kalendarz Treningowy)
**Plik**: [`mobile/src/screens/TrainingCalendarScreen.tsx`](mobile/src/screens/TrainingCalendarScreen.tsx) — **NOWY**

**Cel**: Widok kalendarza z heatmapą aktywności (jak GitHub contribution graph).

**Zawartość:**
- **Monthly Grid**: 4-5 tygodni, każdy dzień to kafelek
- **Day Tiles**: Intensywność koloru = dystans / czas aktywności
- **Tap Day**: Mini-podsumowanie dnia (dystans, aktywności)
- **Week Totals**: Sumy tygodniowe na marginesie
- **Month Totals**: Suma miesięczna + porównanie z poprzednim miesiącem

---

### 4.3 🏆 COMPETE (Rywalizacja)

#### 4.3.1 City Hub (Panel Miasta)
**Plik**: [`mobile/src/screens/CityHubScreen.tsx`](mobile/src/screens/CityHubScreen.tsx) — **NOWY, KRYTYCZNY**

**Cel**: Centralny ekran rywalizacji między miastami. **To jest kluczowy ekran różnicujący od Aktywnych Miast.**

**Zawartość:**
- **City Banner**: Nazwa miasta + logo tenant'a (White-Label) + liczba aktywnych zawodników
- **City vs City Leaderboard**: Pozycja miasta w rankingu globalnym miast
  - Pozycja, punkty, dystans całkowity, liczba aktywności, liczba kolarzy
  - "SIEDLCE IS #3 THIS MONTH — 12,841 KM TOTAL"
  - Pasek postępu do następnego miasta: "▲ 2,841 KM TO OVERTAKE LUBLIN (#2)"
- **Top Riders This Week**: Podium top 3 kolarzy reprezentujących miasto
- **Active Events**: Karty z aktywnymi wydarzeniami w mieście
- **Recent Activity Feed**: Ostatnie przejazdy kolarzy z miasta (scrollowana lista)
- **City Stats**: Wykresy tygodniowe — km vs inne miasta

**Efekty pixel-art:**
- **City flag/banner** z animacją powiewania (sprite sheet, 4 klatki)
- **Pasek "overtake"** z efektem ładowania (dithering fill)
- **Parallax scroll** na liście aktywności (góry w tle)
- **Screen shake** gdy miasto awansuje w rankingu

---

#### 4.3.2 City Leaderboard (Ranking Miejski)
**Plik**: [`mobile/src/screens/CityLeaderboardScreen.tsx`](mobile/src/screens/CityLeaderboardScreen.tsx) (refaktor z `LeaderboardScreen.tsx`)

**Cel**: Ranking kolarzy w obrębie miasta. Istniejący ekran do rozbudowy.

**Rozszerzenia (istniejący + nowe):**
- **Tabs**: CITY / GLOBAL / CLUBS / SEGMENTS
- **Time Filters**: WEEK / MONTH / YEAR / ALL TIME
- **Podium Top 3**: Istniejący układ (GOLD center, SILVER left, BRONZE right) — zostaje
- **Rest of Ranking**: Lista #4-#20
- **My Rank Footer**: Istniejący — zostaje
- **"VS" Button**: Wyzwanie na pojedynek 1v1 (nowe — otwiera wyzwanie indywidualne)

---

#### 4.3.3 Global Leaderboard (Rywalizacja Miast)
**Plik**: [`mobile/src/screens/GlobalLeaderboardScreen.tsx`](mobile/src/screens/GlobalLeaderboardScreen.tsx) — **NOWY**

**Cel**: Ranking miast między sobą. Główny ekran rywalizacji B2B.

**Zawartość:**
- **Header**: "CITY WARS" / "GLOBAL RANKING"
- **Lista miast**: Pozycja, nazwa miasta, flaga/logo, total km, liczba kolarzy, trend (▲▼)
- **Highlight**: Rząd z miastem użytkownika podświetlony na złoto
- **Categories**: KM / RIDES / RIDERS / AVG SPEED
- **Monthly Winner Banner**: "LAST MONTH WINNER: WARSZAWA — 142,000 KM"

---

#### 4.3.4 Clubs Directory
**Plik**: [`mobile/src/screens/ClubsDirectoryScreen.tsx`](mobile/src/screens/ClubsDirectoryScreen.tsx) — **NOWY**

**Cel**: Przeglądanie, wyszukiwanie i tworzenie klubów.

**Zawartość:**
- **Search Bar**: Wyszukiwanie klubu po nazwie
- **Filters**: MIXED / RUN / BIKE / WALK
- **Club Cards**: Nazwa klubu, logo (lub placeholder sprite), typ sportu, liczba członków, ostatnia aktywność
- **My Clubs**: Sekcja na górze z klubami do których należę
- **Create Club Button**: "CREATE SQUAD" → formularz tworzenia klubu

---

#### 4.3.5 Club Detail
**Plik**: [`mobile/src/screens/ClubDetailScreen.tsx`](mobile/src/screens/ClubDetailScreen.tsx) — **NOWY**

**Cel**: Profil klubu z członkami i statystykami.

**Zawartość:**
- **Club Header**: Nazwa, logo, opis, typ sportu, data utworzenia
- **Join/Leave Button**: Dynamiczny przycisk
- **Club Stats**: Total km, członkowie, aktywne wyzwania
- **Member Leaderboard**: Top 10 członków wg km
- **Active Challenges**: Lista aktywnych wyzwań klubu
- **Recent Activities**: Ostatnie przejazdy członków

---

#### 4.3.6 Club Challenges
**Plik**: [`mobile/src/screens/ClubChallengesScreen.tsx`](mobile/src/screens/ClubChallengesScreen.tsx) — **NOWY**

**Cel**: Wyzwania head-to-head między klubami.

**Zawartość:**
- **Active Challenges**: Lista trwających wyzwań z paskami postępu obu klubów
- **Challenge Detail**: Klub A vs Klub B, sport, okres, score (znormalizowany), lider
- **Create Challenge**: Formularz — wybierz przeciwnika, tytuł, sport, daty
- **Completed Challenges**: Historia zakończonych wyzwań
- **Challenge Leaderboard**: Wewnętrzny ranking wyzwań klubu

---

#### 4.3.7 Events (Wydarzenia)
**Plik**: [`mobile/src/screens/EventsScreen.tsx`](mobile/src/screens/EventsScreen.tsx) — **NOWY**

**Cel**: Wydarzenia organizowane przez miasto/korporację. Kluczowe dla B2B.

**Zawartość:**
- **Active Events**: Karty wydarzeń z datą, opisem, nagrodami
- **Upcoming Events**: Zapowiedzi przyszłych wydarzeń
- **Past Events**: Archiwum z wynikami
- **Event Detail**: Opis, trasa, uczestnicy, leaderboard wydarzenia, nagrody
- **Join Event**: Przycisk zapisu
- **Event Leaderboard**: Ranking uczestników wydarzenia

---

#### 4.3.8 Segments (Segmenty)
**Plik**: [`mobile/src/screens/SegmentsScreen.tsx`](mobile/src/screens/SegmentsScreen.tsx) — **NOWY**

**Cel**: Przeglądanie segmentów tras, rekordów, porównań. Odpowiednik Strava Segments.

**Zawartość:**
- **Nearby Segments**: Segmenty w okolicy (na podstawie GPS)
- **Segment Detail**: Nazwa, długość, przewyższenie, średnie nachylenie
- **Leaderboard**: Kto jest KOM/QOM na segmencie
- **My Efforts**: Moje czasy na segmencie + porównanie z rekordem
- **Starred Segments**: Ulubione segmenty

---

### 4.4 🗺️ EXPLORE (Odkrywaj)

#### 4.4.1 Personal Heatmap
**Plik**: [`mobile/src/screens/PersonalHeatmapScreen.tsx`](mobile/src/screens/PersonalHeatmapScreen.tsx) — **NOWY**

**Cel**: Mapa cieplna wszystkich przejazdów użytkownika. Backend ma endpoint `heatmap/`.

**Zawartość:**
- **Mapa**: MapLibre z nakładką heatmap (GeoJSON)
- **Time Filter**: ALL / YEAR / MONTH
- **Opacity Slider**: Regulacja przezroczystości heatmapy
- **Sport Filter**: RIDE / RUN / WALK / ALL
- **Stats Overlay**: "YOU'VE COVERED 68% OF SIEDLCE STREETS"

---

#### 4.4.2 POI Map (Checkpointy)
**Plik**: [`mobile/src/screens/POIMapScreen.tsx`](mobile/src/screens/POIMapScreen.tsx) — **NOWY**

**Cel**: Mapa punktów kontrolnych, voucher'ów, checkpointów. Backend ma `POIViewSet`.

**Zawartość:**
- **Mapa**: MapLibre z pinezkami POI
- **POI Markers**: Kolorowe ikony wg kategorii (sklep, checkpoint, voucher, widok)
- **POI Detail**: Tap w pinezkę → nazwa, opis, kategoria, odległość
- **Route to POI**: "NAVIGATE HERE" — otwiera nawigację
- **Nearby Vouchers**: Lista voucher'ów do zdobycia w okolicy
- **Check-in**: "CHECK IN" — odznacz punkt (jeśli fizycznie w zasięgu)

---

#### 4.4.3 Marketplace (Sklep)
**Plik**: [`mobile/src/screens/MarketplaceScreen.tsx`](mobile/src/screens/MarketplaceScreen.tsx) (refaktor z `RewardsScreen.tsx`)

**Cel**: Sklep z nagrodami za XP. Istniejący ekran do rozbudowy.

**Rozszerzenia:**
- **Wallet**: XP + lokalna waluta (coins, energy)
- **Categories**: Vouchery, sprzęt, odznaki, power-ups
- **Transaction History**: Historia zakupów i zdobytych nagród
- **Sponsor Detail**: Tap w sponsora → profil firmy, wszystkie nagrody

---

#### 4.4.4 Route Planner (Planer Tras)
**Plik**: [`mobile/src/screens/RoutePlannerScreen.tsx`](mobile/src/screens/RoutePlannerScreen.tsx) — **NOWY (aspiracyjny)**

**Cel**: Tworzenie tras przez przeciąganie punktów na mapie. Faza 2+.

**Zawartość:**
- **Mapa**: Interaktywna — tap aby dodać punkt, drag aby przesunąć
- **Route Stats**: Dystans, przewyższenie, szacowany czas
- **Surface Type**: Informacja o nawierzchni (asfalt/szuter/ścieżka)
- **Save Route**: Zapis do biblioteki tras
- **Export**: Eksport do GPS (GPX/TCX)

---

### 4.5 👤 PROFILE (Profil Zawodnika)

#### 4.5.1 Athlete Profile (Profil)
**Plik**: [`mobile/src/screens/AthleteProfileScreen.tsx`](mobile/src/screens/AthleteProfileScreen.tsx) (refaktor z `ProfileScreen.tsx`)

**Cel**: Tożsamość użytkownika + szybkie statystyki. Istniejący ekran uproszczony.

**Zawartość (zmiany):**
- **Avatar**: Pixel-art sprite (wybierany z zestawu) zamiast inicjału
- **Identity**: Username, email, ID, miasto (przeniesione z istniejącego)
- **Stats Summary**: Total KM, Rides, Elevation, XP (mini kafelki 2×2)
- **Current Streak**: "7 DAY STREAK 🔥" — dni z rzędu z aktywnością
- **Season Progress**: Pasek postępu sezonu
- **QR Identity**: Istniejący QR code — zostaje
- **Menu Items** → nawigacja do podstron:
  - My Stats (rekordy)
  - My Clubs (kluby)
  - My Challenges (wyzwania)
  - Settings (ustawienia)

**Co znika z Profile i idzie do Settings:**
- ❌ Wearable Connections → Settings
- ❌ Privacy Zones → Settings
- ❌ Logout → Settings

---

#### 4.5.2 My Stats (Moje Statystyki)
**Plik**: [`mobile/src/screens/MyStatsScreen.tsx`](mobile/src/screens/MyStatsScreen.tsx) — **NOWY**

**Cel**: Rekordy osobiste i podsumowania.

**Zawartość:**
- **Personal Records**: Najlepsze wyniki (1km, 5km, 10km, HM, MARATHON, longest ride, most elevation)
- **Season Summaries**: Podsumowania sezonowe (2026, 2025...)
- **Achievement Gallery**: Wszystkie odblokowane achievementy
- **Comparison**: Porównanie z innymi kolarzami w mieście (percentyle)

---

#### 4.5.3 My Clubs
**Plik**: [`mobile/src/screens/MyClubsScreen.tsx`](mobile/src/screens/MyClubsScreen.tsx) — **NOWY**

**Cel**: Szybki podgląd klubów do których należę.

**Zawartość:**
- **Club Cards**: Mini-karty klubów (nazwa, moja ranga, mój wkład km)
- **Tap → ClubDetail**

---

#### 4.5.4 My Challenges
**Plik**: [`mobile/src/screens/MyChallengesScreen.tsx`](mobile/src/screens/MyChallengesScreen.tsx) — **NOWY**

**Cel**: Aktywne i przeszłe wyzwania użytkownika.

**Zawartość:**
- **Active Challenges**: Wyzwania w toku z paskami postępu
- **Pending Invites**: Zaproszenia do wyzwań
- **Past Challenges**: Historia z wynikami

---

#### 4.5.5 Settings
**Plik**: [`mobile/src/screens/SettingsScreen.tsx`](mobile/src/screens/SettingsScreen.tsx) — **NOWY**

**Cel**: Wszystkie ustawienia w jednym miejscu.

**Zawartość:**
- **Connected Devices** (przeniesione z Profile):
  - Strava: Connect/Disconnect + status + last sync
  - Garmin: Connect/Disconnect + status + last sync
  - Sync All Button
- **Privacy Zones** (przeniesione z Profile):
  - Lista stref prywatności + Add/Delete
- **Avatar Personality** (nowe):
  - DRILL SERGEANT / MOTIVATOR / ANALYST — wybór osobowości trenera AI
- **Theme**:
  - Dark Mode (Deep Sea) / Solar Mode (High Contrast)
- **Display**:
  - CRT Scanlines ON/OFF
  - Screen Shake ON/OFF
  - Units: METRIC / IMPERIAL
- **Data**:
  - Export Data (GDPR)
  - Delete Account
- **About**:
  - App version, build info
- **Logout**: "END SESSION"

---

## 5. STRUKTURA NAWIGACJI

### 5.1 Bottom Tab Bar (5 zakładek)

```typescript
// mobile/src/navigation/GameTabBar.tsx — Refaktor

<Tab.Navigator>
  <Tab.Screen name="Ride"    icon="hud_home"      />   // 🏠
  <Tab.Screen name="Train"   icon="hud_history"    />   // 📊
  <Tab.Screen name="Compete" icon="hud_ranking"    />   // 🏆
  <Tab.Screen name="Explore" icon="hud_explore"    />   // 🗺️
  <Tab.Screen name="Profile" icon="hud_profile"    />   // 👤
</Tab.Navigator>
```

### 5.2 Stack Navigators per Tab

```
RideStack:
  RideDashboard → RideTracking → RideSummary

TrainStack:
  TrainingLog → ActivityDetail
  TrainingLog → Performance
  TrainingLog → Calendar

CompeteStack:
  CityHub → CityLeaderboard
  CityHub → GlobalLeaderboard
  CityHub → ClubsDirectory → ClubDetail → ClubChallenges
  CityHub → Events → EventDetail
  CityHub → Segments → SegmentDetail

ExploreStack:
  PersonalHeatmap
  POIMap → POIDetail
  Marketplace → VoucherDetail
  RoutePlanner

ProfileStack:
  AthleteProfile → MyStats
  AthleteProfile → MyClubs → ClubDetail
  AthleteProfile → MyChallenges → ChallengeDetail
  AthleteProfile → Settings
```

---

## 6. SYSTEM EFEKTÓW PIXEL-ART (NOWE GRY PIXELARTOWE)

Współczesne gry pixelartowe (*Celeste*, *Dead Cells*, *Eastward*, *Hyper Light Drifter*, *Katana Zero*, *The Last Night*) używają pikselowej grafiki z nowoczesnymi efektami oświetlenia, cząsteczkami i post-processem. Poniższy system definiuje wszystkie efekty dla STITCH.

### 6.1 Warstwy Efektów

```
┌──────────────────────────────────────────────┐
│ LAYER 5: Post-Process (CRT, Vignette, Bloom) │
├──────────────────────────────────────────────┤
│ LAYER 4: Particles (dust, sparks, confetti)  │
├──────────────────────────────────────────────┤
│ LAYER 3: UI Overlay (HUD, dialogs, toasts)   │
├──────────────────────────────────────────────┤
│ LAYER 2: Content (lists, maps, charts)       │
├──────────────────────────────────────────────┤
│ LAYER 1: Background (parallax, sky, terrain) │
└──────────────────────────────────────────────┘
```

### 6.2 Katalog Efektów

#### A. Efekty Mikro-Interakcji (istniejące + nowe)

| Efekt | Parametry | Wyzwalacz | Status |
|:------|:----------|:----------|:-------|
| **Spring Physics** | damping: 14, stiffness: 100 | Wszystkie animacje wejścia/wyjścia | ✅ Istniejący |
| **Mechanical Button** | 2px offset w dół przy dotyku | Wszystkie przyciski `ArcadeButton` | ✅ Istniejący |
| **Typewriter** | 40ms/char + migający kursor `_` | Dialogi, komunikaty | ✅ Istniejący |
| **Floating Idle** | ±8px, loop, ease-in-out | Postacie w idle | ✅ Istniejący |
| **Hard Shadow** | 4px offset, blur 0, #000000 | Wszystkie komponenty UI | ✅ Istniejący |
| **1px Outline** | 1px solid black | Wszystkie komponenty UI | ✅ Istniejący |
| **Screen Shake** | amplitude 2-6px, duration 200-500ms | GPS lost, PB, city overtake, challenge won | 🔲 NOWY |
| **Pixel Grid Snap** | Ruch co 2px (snap-to-grid) | Ruch postaci, animacje HUD | 🔲 NOWY |

#### B. Efekty Cząsteczkowe (Particles)

| Efekt | Opis | Wyzwalacz |
|:------|:-----|:----------|
| **Dust Trail** | Brązowe piksele (2×2) za postacią | Prędkość > 20 km/h |
| **XP Sparks** | Złote iskry (1×1, 2×2) rozlatujące się | Milestone, achievement |
| **Water Splash** | Niebieskie piksele | Przejazd przez checkpoint (deszcz) |
| **Confetti Burst** | Wielokolorowe kwadraty 4×4 | Rekord osobisty, wygranie wyzwania |
| **Speed Lines** | Białe linie poziome (1px × 8px) na krawędziach | Prędkość > 35 km/h |
| **Heart Particles** | Czerwone piksele (❤ shape, 3×3) | Wejście w strefę HR 4-5 |

#### C. Efekty Post-Process

| Efekt | Opis | Parametry |
|:------|:-----|:----------|
| **CRT Scanlines** | Poziome linie co 2px, opacity 0.05 | Toggle w Settings |
| **Chromatic Aberration** | RGB split 1-2px | Przejścia między ekranami, zmiana strefy HR |
| **Dithering Dissolve** | Bayer 4×4 dissolve zamiast fade | Przejścia między ekranami |
| **Vignette** | Ciemne rogi, intensywność 0.3 | Nocny tryb, ekran summary |
| **Bloom** | Subtelny glow na ważnych elementach | Rekordy, achievementy, złote elementy |
| **Palette Cycling** | Animowana zmiana kolorów w palecie | HUD tętna (pulsacja), gold shimmer |
| **Dynamic Time-of-Day** | Tint UI na podstawie godziny | Tło Dashboard, mapa |

#### D. Efekty Paralaksy i Tła

| Efekt | Opis | Ekrany |
|:------|:-----|:--------|
| **Parallax Mountains** | 3 warstwy gór (bliskie/dalekie) przesuwające się z różną prędkością | Dashboard, City Hub, tła list |
| **Animated Sky** | Pixel-art nieba z chmurami (sprite sheet, 4-8 klatek) | Dashboard, mapa |
| **Weather Overlay** | Krople deszczu (2×3 piksele) spadające, płatki śniegu, słońce | Dashboard (warunki live) |
| **Depth of Field** | Rozmycie tła gdy PopUpDialog jest widoczny | TrackingScreen, wszystkie ekrany z dialogami |

#### E. Efekty na Ekranie Śledzenia (Tracking HUD)

| Efekt | Opis |
|:------|:-----|
| **HR Pulse** | Ikona serca pulsuje (scale 1.0 → 1.15) w rytm HR (60-180 BPM = 1-3 Hz) |
| **GPS Dot Blink** | Kropka GPS miga (zielona = dobra, żółta = słaba, czerwona = brak) |
| **Speed Shake** | HUD delikatnie drży przy wysokiej prędkości (>40 km/h) |
| **Low Battery Flash** | Czerwony overlay pulsuje przy <10% baterii |
| **Ghost Rider Trail** | Za duchem na mapie ciągnie się pixel-art ślad |

### 6.3 Implementacja Techniczna Efektów

```
mobile/src/effects/
├── ScreenShake.ts           # Ekran wstrząsami
├── ParticleSystem.ts        # Silnik cząsteczkowy
├── PostProcess.ts           # CRT, aberration, dithering
├── ParallaxBackground.tsx   # Tła z paralaksą
├── PaletteCycle.ts          # Animowane palety kolorów
├── TimeOfDay.ts             # Dynamiczny time-of-day
└── WeatherOverlay.tsx       # Nakładka pogodowa
```

**Kluczowe zasady:**
1. Wszystkie efekty renderowane przez **Skia** (React Native Skia) dla wydajności
2. Cząsteczki maksymalnie 50 na raz dla utrzymania 60 FPS
3. Post-process tylko na statycznych ekranach (nie na TrackingScreen — oszczędność baterii)
4. Wszystkie efekty mają toggle w Settings
5. Efekty respektują Solar Mode (wysoki kontrast = mniej efektów post-process)

---

## 7. ŻYCIE KOLARZA & GAME VIBE — SYSTEM ASSETÓW I SPRITE'ÓW

STITCH to nie tylko aplikacja — to **pixel-artowy symulator życia kolarza**. Każdy ekran, każda animacja i każdy sprite buduje immersję w świecie dwóch kółek. Poniższa sekcja definiuje kompletny katalog assetów, animacji i game-vibe'owych elementów, które czynią STITCH unikalnym.

### 7.1 Filozofia Game Vibe

| Element | Zasada |
|:--------|:-------|
| **Cyclist Life** | Aplikacja pokazuje nie tylko jazdę, ale całe życie kolarza — serwis roweru, kawę przed trasą, pakowanie sakw, wyścigi, podróże |
| **Sprzęt jako RPG** | Rower to ekwipunek — rama, koła, napęd, hamulce. Każdy element ma statsy i wpływa na osiągi. Serwis = ulepszanie. |
| **Animowani kolarze** | Każdy ekran ma przynajmniej jednego animowanego sprite'a kolarza w kontekstowej pozie — nie tylko idle/action, ale 23+ stany |
| **Mikro-narracje** | Małe historyjki dzieją się w tle — kolarz pije bidon, sprawdza mapę, macha do innych, sprintuje do mety |
| **Pogoda i pora dnia** | Świat reaguje — deszcz, wiatr, słońce, mgła. Kolarz ubiera się adekwatnie (kurtka przeciwdeszczowa, krótki rękaw) |

### 7.2 Kompletny Katalog Sprite'ów Kolarza

Każdy sprite to arkusz 64×64 px (możliwość scale do 128×128 dla detali). Wszystkie w formacie PNG, pixel-perfect, 1px outline.

#### A. Stany Podstawowe (Core States) — 8 stanów

| # | Stan | Klatki | Opis | Wyzwalacz |
|:--|:-----|:-------|:-----|:----------|
| 1 | **idle** | 4 | Kolarz stoi przy rowerze, delikatnie kołysze się (±8px floating) | Dashboard, Profile, przed startem |
| 2 | **riding_cruise** | 6 | Spokojna jazda, kadencja ~80 RPM, lekki uśmiech | Tracking HUD (15-25 km/h) |
| 3 | **riding_tempo** | 6 | Szybsza jazda, kadencja ~95 RPM, skupienie | Tracking HUD (25-35 km/h) |
| 4 | **riding_attack** | 4 | Agresywna pozycja, sprint na kierownicy, kadencja ~110 RPM | Tracking HUD (>35 km/h) |
| 5 | **climbing_seated** | 6 | Podjazd na siedząco, ręce na górnym chwycie, wolniejsza kadencja | Elevation gain > 5% |
| 6 | **climbing_standing** | 4 | Podjazd stojąc, rower przechylony, maksymalny wysiłek | Elevation gain > 10% |
| 7 | **descending** | 4 | Zjazd w pozycji aero, ręce na dolnych gripach | Elevation loss, prędkość > 45 km/h |
| 8 | **drafting** | 6 | Jazda za innym kolarzem, osłonięty przed wiatrem | Ghost rider, grupowa jazda |

#### B. Stany Emocjonalne / Eventowe — 7 stanów

| # | Stan | Klatki | Opis | Wyzwalacz |
|:--|:-----|:-------|:-----|:----------|
| 9 | **victory** | 8 | Ręce w górę na mecie, rower uniesiony | Personal Best, wygrany challenge |
| 10 | **exhausted** | 4 | Kolarz oparty o kierownicę, ciężko oddycha | Koniec długiej jazdy, Zone 5 HR |
| 11 | **crash** | 6 | Wywrotka — kolarz leci przez kierownicę, rower się przewraca | Rzadki event humorystyczny |
| 12 | **celebration** | 6 | Strzela korkiem od bidonu jak szampanem | Achievement, milestone |
| 13 | **wave** | 4 | Macha ręką do innych kolarzy | Mijanie checkpointu, spotkanie club member |
| 14 | **rain_struggle** | 6 | Jazda w deszczu, kurtka przeciwdeszczowa, krople odbijające się | Deszczowa pogoda |
| 15 | **night_ride** | 6 | Jazda z włączonym światłem przednim (snop światła), odblaski | Jazda nocą |

#### C. Stany Lifestyle'owe (Poza Jazdą) — 8 stanów

| # | Stan | Klatki | Opis | Ekran |
|:--|:-----|:-------|:-----|:------|
| 16 | **cafe_stop** | 4 | Kolarz siedzi przy stoliku, pije espresso, rower oparty obok | Dashboard (przed jazdą), Post-Ride |
| 17 | **bike_service** | 8 | Kolarz serwisuje rower — smaruje łańcuch, pompuje koła, sprawdza hamulce | Bike Garage |
| 18 | **packing** | 6 | Pakuje sakwy/bidony/kanapki przed długą trasą | Route Planner, Pre-Ride |
| 19 | **studying_map** | 4 | Studiuje mapę/papierową kartkę z trasą | Route Planner, Segments |
| 20 | **stretching** | 6 | Rozciąga się przed/po jeździe | Dashboard, Ride Summary |
| 21 | **taking_photo** | 4 | Robi zdjęcie krajobrazu telefonem | POI, Checkpoint, Segment KOM |
| 22 | **group_ride** | 8 | Grupa 3-5 kolarzy jadących razem (jeden sprite wielopostaciowy) | Club Detail, Events |
| 23 | **podium** | 6 | Kolarz stoi na podium (1, 2 lub 3 miejsce), odbiera nagrodę | Leaderboard, Challenge zakończony |

#### D. Stany Roweru (Bike Types) — 5 wariantów

| # | Typ roweru | Opis | Stats bonus |
|:--|:-----------|:-----|:------------|
| 24 | **road_bike** | Szosówka aero, drop bary, wąskie opony | +Speed, -Comfort |
| 25 | **gravel_bike** | Gravel, szersze opony, flara na kierownicy | +Terrain, +Comfort |
| 26 | **mountain_bike** | MTB full-sus, szeroka kierownica, agresywny bieżnik | +Climbing, +Terrain |
| 27 | **city_bike** | Miejski, koszyk, prosta kierownica | +Comfort, -Speed |
| 28 | **cargo_bike** | Cargo/bikepacking, sakwy, torby | +Capacity, -Speed |

**Każdy typ roweru ma 4 kolorystyki (skin) do wyboru przez użytkownika.**

#### E. Ekspresje Twarzy (Face Expressions) — 8 wariantów

| # | Ekspresja | Opis | Wyzwalacz |
|:--|:----------|:-----|:----------|
| 29 | `cyclist_happy` | Szeroki uśmiech, gwiazdki w oczach ✨ | ✅ Istniejący — PB, achievement |
| 30 | `cyclist_idle` | Neutralny, lekki uśmiech | ✅ Istniejący — ekrany statyczne |
| 31 | `cyclist_tired` | Zmęczony, pot na czole, półprzymknięte oczy | ✅ Istniejący — koniec długiej jazdy |
| 32 | `cyclist_victory` | Euforia, szeroko otwarte oczy, okrzyk radości | ✅ Istniejący — wygrana |
| 33 | `cyclist_focused` | Skupiony, zmarszczone brwi, wzrok przed siebie | 🔲 NOWY — tempo ride, segment |
| 34 | `cyclist_pain` | Grymas bólu, zaciśnięte zęby | 🔲 NOWY — climbing standing, Zone 5 |
| 35 | `cyclist_surprised` | Zaskoczony, uniesione brwi | 🔲 NOWY — niespodziewany achievement |
| 36 | `cyclist_calm` | Spokojny, zamknięte oczy, medytacja | 🔲 NOWY — cafe stop, stretching |

### 7.3 Bike Garage — Ekran Serwisu i Ekwipunku

**Plik**: [`mobile/src/screens/BikeGarageScreen.tsx`](mobile/src/screens/BikeGarageScreen.tsx) — **NOWY**

**Cel**: RPG-owy ekran zarządzania sprzętem. Kolarz widzi swój rower, jego stan i może go serwisować.

**Zawartość:**
- **Bike Display**: Centralnie animowany sprite roweru (typ wybrany przez użytkownika), obracający się powoli (3 klatki: bok, 3/4, przód)
- **Bike Name**: Użytkownik nazywa swój rower (np. "Czarna Błyskawica")
- **Condition Meter**: Pasek stanu roweru 0-100%. Spada z każdym przejechanym kilometrem. <20% = rower "skrzypi", niższa prędkość
- **Parts Status** (ikony części):
  - 🔗 **Chain** (łańcuch): zużycie 0-100%, wymiana co ~3000 km
  - 🛞 **Tires** (opony): zużycie, przebicie (losowy event)
  - 🛑 **Brakes** (hamulce): zużycie klocków
  - ⚙️ **Drivetrain** (napęd): kaseta + korba, zużycie
- **Service Button**: "SERVICE BIKE" — animacja sprite'a `bike_service` (8 klatek), resetuje stan części
- **Service History**: Lista przeglądów z datą i przebiegiem
- **Upgrades Shop**: Możliwość "zakupu" ulepszeń (lżejsza rama, aero koła) za XP — zwiększają statsy
- **Bike Stats**: Waga (kg), Aero (0-100), Comfort (0-100), Terrain (0-100) — wpływają na osiągi w symulacji

### 7.4 Race Day — Tryb Wyścigu

**Plik**: [`mobile/src/screens/RaceDayScreen.tsx`](mobile/src/screens/RaceDayScreen.tsx) — **NOWY (aspiracyjny, Faza 3+)**

**Cel**: Specjalny tryb na zawody/wydarzenia. Imersyjny interfejs wyścigu.

**Zawartość:**
- **Pre-Race**: Odliczanie 3...2...1...GO! z animacją startera (flaga)
- **Race HUD**: Pozycja w wyścigu (1/50), dystans do lidera, międzyczasy
- **Peloton Visualization**: Uproszczona wizualizacja peletonu — gdzie jesteś względem grupy
- **Attack Button**: "ATTACK" — próba ucieczki (zużywa energię, szansa na sukces)
- **Sprint Finish**: Na ostatnim kilometrze — tapowanie dla sprintu, animacja `riding_attack`
- **Post-Race**: Ceremonia, podium, konfetti

### 7.5 Travel Mode — Tryb Podróży

**Plik**: [`mobile/src/screens/TravelModeScreen.tsx`](mobile/src/screens/TravelModeScreen.tsx) — **NOWY (aspiracyjny, Faza 3+)**

**Cel**: Długodystansowe podróże rowerowe (bikepacking, touring).

**Zawartość:**
- **Journey Map**: Trasa podróży z punktami etapowymi (noclegi, postoje, punkty widokowe)
- **Daily Log**: Dziennik podróży — dystans dnia, zdjęcia, notatki
- **Packing List**: Lista ekwipunku (namiot, śpiwór, kuchenka, jedzenie)
- **Weather Forecast**: Prognoza na kolejne dni trasy
- **Journey Stats**: Łączny dystans, dni w trasie, przewyższenia, spalone kalorie

### 7.6 Mikro-Narracje i Game Vibe Elementy

Elementy budujące atmosferę, rozsiane po całej aplikacji:

| Element | Opis | Gdzie występuje |
|:--------|:-----|:----------------|
| **Bidon Counter** | Licznik wypitych bidonów podczas jazdy (ikonka bidonu napełniająca się) | Tracking HUD |
| **Café Stop Prompt** | Po 2h jazdy: "COFFEE BREAK?" — sugestia przerwy, sprite `cafe_stop` | Tracking HUD (auto trigger) |
| **Sunrise/Sunset Alert** | Powiadomienie o wschodzie/zachodzie słońca z animacją nieba | Dashboard, Tracking |
| **Tailwind Bonus** | "TAILWIND! +2 KM/H" — wiatr w plecy, ikonka wiatru | Tracking HUD |
| **Headwind Penalty** | "HEADWIND... -3 KM/H" — wiatr w twarz, kolarz pochylony | Tracking HUD |
| **Rain Starts** | Krople deszczu na HUD, kolarz zakłada kurtkę (sprite `rain_struggle`) | Tracking HUD |
| **Puncture!** | Losowy event przebicia opony, minigra "napraw dętkę" (3 tapy) | Tracking (rzadki) |
| **Wildlife Sighting** | "DEER CROSSING!" — jeleń/sarna przebiega przez ekran (sprite) | Tracking (rzadki, humorystyczny) |
| **Segment PR** | "NEW PR ON [NAZWA]!" — złoty shimmer, sprite `victory` | Segment completion |
| **Group Ride Found** | "3 RIDERS AHEAD — JOIN THEM?" — pobliskie grupki kolarzy | Tracking, City Hub |
| **Bike Wash** | Po jeździe w deszczu: "YOUR BIKE IS DIRTY. WASH IT?" — animacja mycia roweru | Ride Summary |

### 7.7 Ambiente Dźwiękowe (Game SFX)

Dźwięki pixel-art towarzyszące akcjom (generowane proceduralnie, format WAV 8-bit):

| Dźwięk | Opis | Wyzwalacz |
|:-------|:-----|:----------|
| `click_mechanical` | Mechaniczne kliknięcie przycisku | Każdy tap UI |
| `chain_hum` | Cichy szum łańcucha (loop) | Tracking — kadencja moduluje głośność |
| `wind_rush` | Szum wiatru (loop) | Tracking — prędkość moduluje głośność |
| `bell_ring` | Dzwonek rowerowy "dzyń!" | Osiągnięcie kamienia milowego |
| `hub_click` | Kliknięcie tylnej piasty przy jeździe bez pedałowania | Descending |
| `tire_gravel` | Szuranie opon po szutrze | Jazda terenowa |
| `tire_wet` | Syk mokrego asfaltu | Deszcz |
| `brake_squeal` | Pisk hamulców | Gwałtowne hamowanie |
| `gear_shift` | Kliknięcie zmiany biegu | Zmiana prędkości > 5 km/h |
| `bottle_sip` | Łyk z bidonu | Café stop, przerwa |
| `crowd_cheer` | Tłum wiwatuje (pixel-art "beep beep!") | Sprint finish, PB, victory |
| `crash_sound` | "BAM! KLANG!" | Crash event |
| `rain_ambient` | Delikatny deszcz (loop) | Deszczowa pogoda |
| `victory_jingle` | Krótka fanfara 4-nutowa | Achievement, challenge won |

### 7.8 Pełny Inwentarz Assetów (Asset Inventory)

```
assets/generated/
├── sprites/
│   ├── cyclist_idle.png            # 4 klatki, 64x64
│   ├── cyclist_riding_cruise.png   # 6 klatek, 64x64
│   ├── cyclist_riding_tempo.png    # 6 klatek, 64x64
│   ├── cyclist_riding_attack.png   # 4 klatki, 64x64
│   ├── cyclist_climbing_seated.png # 6 klatek, 64x64
│   ├── cyclist_climbing_stand.png  # 4 klatki, 64x64
│   ├── cyclist_descending.png      # 4 klatki, 64x64
│   ├── cyclist_drafting.png        # 6 klatek, 64x64
│   ├── cyclist_victory.png         # 8 klatek, 64x64
│   ├── cyclist_exhausted.png       # 4 klatki, 64x64
│   ├── cyclist_crash.png           # 6 klatek, 64x64
│   ├── cyclist_celebration.png     # 6 klatek, 64x64
│   ├── cyclist_wave.png            # 4 klatki, 64x64
│   ├── cyclist_rain_struggle.png   # 6 klatek, 64x64
│   ├── cyclist_night_ride.png      # 6 klatek, 64x64
│   ├── cyclist_cafe_stop.png       # 4 klatki, 64x64
│   ├── cyclist_bike_service.png    # 8 klatek, 64x64
│   ├── cyclist_packing.png         # 6 klatek, 64x64
│   ├── cyclist_studying_map.png    # 4 klatki, 64x64
│   ├── cyclist_stretching.png      # 6 klatek, 64x64
│   ├── cyclist_taking_photo.png    # 4 klatki, 64x64
│   ├── cyclist_group_ride.png      # 8 klatek, 128x64 (wielopostaciowy)
│   ├── cyclist_podium.png          # 6 klatek, 64x64
│   ├── ghost_sprite.png            # ✅ istniejący
│   ├── runner_sprite.png           # ✅ istniejący
│   ├── elite_sprite.png            # 🔲 do wygenerowania
│   └── cyclist_sheet.png           # ✅ istniejący (spritesheet)
│
├── bikes/
│   ├── bike_road_red.png
│   ├── bike_road_blue.png
│   ├── bike_road_black.png
│   ├── bike_road_white.png
│   ├── bike_gravel_green.png
│   ├── bike_gravel_tan.png
│   ├── bike_mtb_orange.png
│   ├── bike_mtb_gray.png
│   ├── bike_city_cream.png
│   ├── bike_city_mint.png
│   ├── bike_cargo_yellow.png
│   └── bike_cargo_brown.png
│
├── expressions/
│   ├── cyclist_happy.png           # ✅ istniejący
│   ├── cyclist_idle.png            # ✅ istniejący
│   ├── cyclist_tired.png           # ✅ istniejący
│   ├── cyclist_victory.png         # ✅ istniejący
│   ├── cyclist_focused.png         # 🔲 NOWY
│   ├── cyclist_pain.png            # 🔲 NOWY
│   ├── cyclist_surprised.png       # 🔲 NOWY
│   └── cyclist_calm.png            # 🔲 NOWY
│
├── environment/
│   ├── sky_day.png                 # Niebo dzienne (parallax layer 1)
│   ├── sky_sunset.png              # Zachód słońca
│   ├── sky_night.png               # Nocne niebo z gwiazdami
│   ├── mountains_far.png           # Góry dalekie (parallax layer 2)
│   ├── mountains_near.png          # Góry bliskie (parallax layer 3)
│   ├── trees_pine.png              # Las iglasty (parallax element)
│   ├── city_skyline.png            # Panorama miasta (City Hub tło)
│   ├── rain_drop.png               # Pojedyncza kropla deszczu 2x3px
│   ├── snow_flake.png              # Płatek śniegu 4x4px
│   ├── dust_cloud.png              # Chmura kurzu (particle)
│   └── wind_lines.png              # Linie wiatru (particle)
│
├── props/
│   ├── water_bottle.png            # Bidon
│   ├── coffee_cup.png              # Espresso (café stop)
│   ├── bike_tool.png               # Klucz do roweru (service)
│   ├── map_paper.png               # Papierowa mapa
│   ├── camera.png                  # Aparat/telefon (taking photo)
│   ├── trophy_gold.png             # Trofeum złote ✅ istniejący (reward_trophy)
│   ├── trophy_silver.png           # Trofeum srebrne 🔲
│   ├── trophy_bronze.png           # Trofeum brązowe 🔲
│   ├── flag_checkered.png          # Flaga w szachownicę (race finish)
│   ├── bell.png                    # Dzwonek rowerowy
│   └── bike_light.png              # Lampka rowerowa (night ride)
│
├── ui_elements/
│   ├── chain_icon.png              # Ikona łańcucha (Bike Garage)
│   ├── tire_icon.png               # Ikona opony
│   ├── brake_icon.png              # Ikona hamulca
│   ├── gear_icon.png               # Ikona napędu
│   ├── wind_icon.png               # Ikona wiatru (tailwind/headwind)
│   ├── bidon_gauge.png             # Wskaźnik nawodnienia
│   └── sunrise_icon.png            # Ikona wschodu słońca
│
└── textures/
    ├── metal_plate.png              # ✅ istniejący
    ├── wood_grain.png               # ✅ istniejący
    ├── parchment_grain.png          # ✅ istniejący
    ├── carbon_fiber.png             # 🔲 NOWY — włókno węglowe (karty premium)
    ├── asphalt.png                  # 🔲 NOWY — asfalt (tła list)
    └── gravel.png                   # 🔲 NOWY — szuter (tła terenowe)
```

### 7.9 System Animacji Sprite'ów

```typescript
// mobile/src/components/CyclistSprite.tsx — NOWY KOMPONENT

type CyclistState =
  | 'idle' | 'riding_cruise' | 'riding_tempo' | 'riding_attack'
  | 'climbing_seated' | 'climbing_standing' | 'descending'
  | 'drafting' | 'victory' | 'exhausted' | 'crash'
  | 'celebration' | 'wave' | 'rain_struggle' | 'night_ride'
  | 'cafe_stop' | 'bike_service' | 'packing'
  | 'studying_map' | 'stretching' | 'taking_photo'
  | 'group_ride' | 'podium';

type BikeType = 'road' | 'gravel' | 'mtb' | 'city' | 'cargo';

interface CyclistSpriteProps {
  state: CyclistState;
  bikeType?: BikeType;
  expression?: 'happy' | 'idle' | 'tired' | 'victory' | 'focused' | 'pain' | 'surprised' | 'calm';
  size?: number;        // default 64
  fps?: number;         // default 12 (klatki na sekundę)
  loop?: boolean;       // default true
}
```

**Kluczowe zasady animacji:**
- Każdy sprite renderowany przez **Skia** dla wydajności (60 FPS UI, 12 FPS dla sprite sheet)
- Frame switching co ~83ms (12 FPS) dla płynnej animacji pixel-art
- Automatyczny dobór sprite'a na podstawie prędkości / nachylenia / pogody (Tracking HUD)
- Warstwowanie: tło → rower → kolarz → ekspresja (osobne sprite'y komponowane)
- Wszystkie sprite'y mają **czarny obrys 1px** (zasada HD-2D) i **twardy cień 4px**

---

## 8. KONWENCJA NAZEWNICTWA (Garmin/Strava)

### 8.1 Mapowanie Starych Nazw → Nowe Nazwy

| Stara Nazwa (RPG) | Plik | Nowa Nazwa (Garmin/Strava) | Nowy Plik |
|:-------------------|:-----|:----------------------------|:----------|
| `TrackingScreen` | `TrackingScreen.tsx` | **Ride** / **Record** | `RideTrackingScreen.tsx` |
| `ActivitiesScreen` | `ActivitiesScreen.tsx` | **Training Log** | `TrainingLogScreen.tsx` |
| `LeaderboardScreen` | `LeaderboardScreen.tsx` | **City Leaderboard** | `CityLeaderboardScreen.tsx` |
| `RewardsScreen` | `RewardsScreen.tsx` | **Marketplace** | `MarketplaceScreen.tsx` |
| `ProfileScreen` | `ProfileScreen.tsx` | **Athlete Profile** | `AthleteProfileScreen.tsx` |
| `OnboardingScreen` | `OnboardingScreen.tsx` | **Setup** | `SetupScreen.tsx` |

### 8.2 Słownik Terminów

| Termin STITCH | Odpowiednik Garmin/Strava | Kontekst |
|:--------------|:---------------------------|:---------|
| **Ride** | Activity / Ride | Rozpoczęcie jazdy |
| **Record** | Start / Record | Przycisk nagrywania |
| **Training Log** | Training Log / Activities | Historia aktywności |
| **Activity** | Activity / Workout | Pojedyncza aktywność |
| **Performance** | Performance Stats | Statystyki wydajności |
| **Fitness** | Fitness / Training Status | Wskaźnik formy |
| **Training Load** | Training Load | Obciążenie treningowe |
| **Segments** | Segments | Odcinki tras |
| **KOM/QOM** | KOM/QOM (King/Queen of the Mountain) | Król/Królowa segmentu |
| **Squad** | Club / Group | Klub sportowy |
| **Challenge** | Challenge / Competition | Wyzwanie |
| **Leaderboard** | Leaderboard / Rankings | Ranking |
| **Heatmap** | Personal Heatmap | Mapa cieplna |
| **Explore** | Explore / Discover | Odkrywanie tras/miejsc |
| **Checkpoint** | POI / Waypoint | Punkt kontrolny |
| **Marketplace** | Shop / Rewards | Sklep z nagrodami |
| **Connected Devices** | Devices / Sensors | Wearables |
| **Privacy Zones** | Privacy Zones | Strefy prywatności |
| **Solar Mode** | — (unikalne dla SPORT) | Tryb wysokiego kontrastu |
| **City Hub** | — (unikalne dla SPORT) | Panel rywalizacji miasta |
| **City Wars** | — (unikalne dla SPORT) | Ranking między miastami |

### 8.3 Zasady Nazewnictwa

1. **Pierwszeństwo mają terminy z Garmin/Strava** — użytkownicy kolarstwa je znają
2. **Unikalne terminy SPORT** tylko dla funkcji bez odpowiednika (City Hub, City Wars, Solar Mode, Anti-Cheat Grade)
3. **Przyciski i akcje** — czasowniki: "Start Ride", "Save Activity", "Join Club", "Challenge Club"
4. **Zakładki** — rzeczowniki: "Ride", "Train", "Compete", "Explore", "Profile"
5. **Jednostki** — metryczne (km, m, km/h, °C), z opcją imperial w Settings

---

## 9. PLAN WDROŻENIA (Fazy)

### Faza 0: Fundament (istniejący)
- ✅ Tamagui + Skia + Legend-State
- ✅ 5 ekranów bazowych
- ✅ System motywów (Dark/Solar)
- ✅ Komponenty atomowe (ArcadeButton, GameCard, PixelText, etc.)
- ✅ TriggerEngine + AvatarTrainer

### Faza 1: STITCH Core (MVP Redesign)
- 🔲 Refaktor 5 istniejących ekranów do nowego nazewnictwa
- 🔲 **ActivityDetailScreen** — najważniejszy brakujący ekran
- 🔲 **CityHubScreen** — kluczowy dla pozycjonowania vs Aktywne Miasta
- 🔲 **GlobalLeaderboardScreen** — rywalizacja miast
- 🔲 **SettingsScreen** — odciążenie Profile
- 🔲 Nowy Bottom Tab Bar (5 zakładek)

### Faza 2: STITCH Social (Kluby + Społeczność)
- 🔲 **ClubsDirectoryScreen**
- 🔲 **ClubDetailScreen**
- 🔲 **ClubChallengesScreen**
- 🔲 **MyClubsScreen**
- 🔲 **MyChallengesScreen**

### Faza 3: STITCH Explore (Odkrywanie)
- 🔲 **PersonalHeatmapScreen**
- 🔲 **POIMapScreen**
- 🔲 **SegmentsScreen**
- 🔲 **EventsScreen**
- 🔲 Rozbudowa Marketplace

### Faza 4: STITCH Performance (Analityka)
- 🔲 **PerformanceScreen**
- 🔲 **TrainingCalendarScreen**
- 🔲 **MyStatsScreen**
- 🔲 **RideSummaryScreen** (pełne podsumowanie)

### Faza 5: STITCH Effects (Pixel-Art Game Feel)
- 🔲 Silnik cząsteczkowy (ParticleSystem)
- 🔲 Screen shake
- 🔲 CRT scanlines + Chromatic aberration
- 🔲 Dithering dissolve transitions
- 🔲 Paralaksa + Dynamic time-of-day
- 🔲 Weather overlay

### Faza 6: STITCH Premium (Aspiracyjne)
- 🔲 **RoutePlannerScreen**
- 🔲 **NotificationsInboxScreen**
- 🔲 Zaawansowane segmenty (Viterbi matching)
- 🔲 AI-powered insights (LLM Coach)

---

## 10. PODSUMOWANIE — CO NOWEGO WNIESIE STITCH

| Aspekt | Przed STITCH | Po STITCH |
|:-------|:-------------|:----------|
| **Liczba ekranów** | 5 | 18+ |
| **Nawigacja** | 5 zakładek, płaska | 5 zakładek + stack navigatory |
| **Nazewnictwo** | RPG-gaming (QUEST LOG, CHARACTER SHEET) | Branżowe Garmin/Strava + unikalne SPORT |
| **City Competition** | Brak dedykowanego ekranu | CityHub + GlobalLeaderboard + Events |
| **Kluby** | Backend tylko | Pełna obsługa UI (4 ekrany) |
| **Activity Detail** | Nie istnieje | Pełny ekran z mapą, splitami, wykresami |
| **Performance** | Brak | Fitness, Training Load, VO2 Max |
| **Eksploracja** | Tylko sklep | Heatmapa, POI, Segmenty, Trasy |
| **Ustawienia** | Rozsiane po profilu | Dedykowany ekran |
| **Efekty** | Podstawowe (spring, typewriter) | Pełny system pixel-art (cząsteczki, shake, CRT, paralaksa) |
| **Pozycjonowanie** | Generic fitness app | Platforma rywalizacji między miastami |

---

*Dokument stanowi kompletny plan redesignu aplikacji mobilnej SPORT pod kryptonimem STITCH.*  
*Wszystkie nazwy plików, ścieżki i komponenty są zgodne z istniejącą strukturą projektu.*  
*Kolorystyka pominięta zgodnie z założeniami — obowiązuje istniejący system tokenów w `mobile/src/theme/`.*
