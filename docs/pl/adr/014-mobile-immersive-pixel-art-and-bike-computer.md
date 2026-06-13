# ADR 014: Immersyjna skóra pixel-art na rdzeniu komputera rowerowego / nawigacji (mobile)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Mobile Lead / Product |
| **Last reviewed** | 2026-06-13 |
| **Audience** | Zobacz dokument kanoniczny |
| **lang** | pl |
| **translation** | [English](../../adr/014-mobile-immersive-pixel-art-and-bike-computer.md) |
| **canonical_path** | docs/pl/adr/014-mobile-immersive-pixel-art-and-bike-computer.md |
| **Design SSOT** | [docs/design/DESIGN_SYSTEM_MOBILE.md](../../design/DESIGN_SYSTEM_MOBILE.md) |
---

## Stan
Zaakceptowano (13.06.2026). Rozszerza [ADR 006 (system designu Stitch)](006-design-system-stitch.md). Zastępuje archiwalną propozycję [`docs/archive/plans/mobile-asset-enhancement-proposal.md`](../../archive/plans/mobile-asset-enhancement-proposal.md).

## Kontekst
Chcemy, żeby aplikacja mobilna wyglądała i działała jak immersyjna, animowana gra pixel-art (referencja: koncept „Cyklo-Siedlce Grand Prix" — ilustrowane sceny, animowany kolarz, cząsteczki, dymki, paski energii/HUD), by przyciągnąć młodszych odbiorców i poprawić retencję/wiralność. Jednocześnie **podstawowym zadaniem apki jest komputer rowerowy / nawigacja** (rower, bieg, nordic walking), gdzie dane muszą być czytelne „na rzut oka" i bezpieczne podczas jazdy. Bogate ilustrowane tła szkodzą czytelności gęstych danych — to napięcie jest sednem tej decyzji.

## Decyzja (skrót)
1. **Rdzeń vs skóra**: rdzeń = komputer/nawigacja z **edytowalnymi polami danych** (Garmin/Wahoo/Karoo); na to nakładamy **skórę pixel-art**. Skóra nigdy kosztem czytelności/bezpieczeństwa danych.
2. **Strefy**: skupienia (Active Ride — minimum animacji; żywa jazda = mapa + marker + minimum, **bez** scrollującej sceny 2.5D pod danymi) vs zaangażowania (Home, Ride Summary + karta do share, City Hub, Profile/Bike Garage, Onboarding, Marketplace). Pełnoekranowa scena 2.5D (`active_ride_hud_mockup`, [design SSOT](../../design/MOBILE_ASSET_NANO_BANANA_PROMPTS.md) §16b) należy do zaangażowania/marketingu; jej layout pól danych i sun-readability adoptuje realny HUD.
3. **Edytowalne pola**: `DataFieldRegistry` + `DataFieldGrid` (1–10 pól, presety, drag reorder/resize, layouty per profil/sport w MMKV z wersjonowanym schematem).
4. **Warstwy renderu**: wymienna warstwa bazowa (`SceneBackground` parallax LUB MapLibre retro) + wspólny stos (Ambient → Particles (Skia `drawAtlas`) → CyclistSprite → Scrim → UI → SpeechBubble).
5. **Paleta scena vs chrome**: sceny mogą mieć bogatszą paletę; chrome UI trzyma tokeny Stitch; styk reguluje `scrim`.
6. **Jedno źródło tokenów**: skonsolidować `stitch.ts` / legacy octopath-solar / `@4velo/tokens`.
7. **Pipeline assetów**: Gemini + deterministyczny post-process (palette-quant, nearest-neighbor, sprite packing, `pngquant`/`oxipng`, manifest z seed/hash, reference-locked klatki). Kanoniczne prompty per asset dla **Nano Banana Pro** (`gemini-3-pro-image`) z dołączoną referencją Cyklo-Siedlce Grand Prix: [docs/design/MOBILE_ASSET_NANO_BANANA_PROMPTS.md](../../design/MOBILE_ASSET_NANO_BANANA_PROMPTS.md) (lustro PL: [docs/pl/design/...](../design/MOBILE_ASSET_NANO_BANANA_PROMPTS.md)); ikony UI jako PNG, nie ręczne SVG. Bohater **konfigurowalny** (jeden bazowy sprite; kolor kasku = palette-swap, nazwa miasta = decal i18n, nie wypalane w sprite); pełnoekranowy `active_ride_hud_mockup` definiuje sun-readable layout komputera rowerowego.
8. **Silniki**: Reanimated 4 + Skia (rdzeń), + MapLibre retro style, Skia `drawAtlas`, gesture-handler. Lottie/Rive odrzucone dla pixel-artu.
9. **Audio (4 warstwy)**: UI SFX, reward, ambient sterowane danymi, nawigacja eyes-free (TTS `expo-speech`); migracja `SoundService` z `expo-av` (deprecated) na `expo-audio`.
10. **Rollout**: feature flag `immersiveTheme`, reduced-motion, auto-degradacja (`useFrameBudgetMonitor`, [ADR 012 — budżety wydajności](../../adr/012-mobile-performance-budgets.md)), auto-pauza w tle/baterii, analityka zaangażowania w telemetrii/Datadog.

## Konsekwencje
- Rozdział użytkowości (nawigacja) od zaangażowania (gra) ogranicza ryzyko nieczytelnego UI; karta wyniku pixel-art = lewar wzrostu.
- Koszt GPU/baterii efektów przy aktywnym GPS — mitygowany regułami stref, budżetami FPS i auto-pauzą.
- Turn-by-turn zależy od instrukcji manewrów z routingu (BRouter/OSRM); fallback: linia trasy + dystans do skrętu.
- **Definition of done**: zmiana wizji = aktualizacja tego ADR i design SSOT w tym samym PR.

---

## Pełna wersja (kanoniczna)

Pełny tekst ADR (język źródłowy dokumentu): **[014-mobile-immersive-pixel-art-and-bike-computer.md](../../adr/014-mobile-immersive-pixel-art-and-bike-computer.md)**.

> Skrót PL — nie zastępuje pełnego ADR przy review architektury. Specyfikacja designu: **[docs/design/DESIGN_SYSTEM_MOBILE.md](../../design/DESIGN_SYSTEM_MOBILE.md)**.
