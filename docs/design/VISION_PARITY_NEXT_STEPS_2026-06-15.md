# Vision Parity — następne kroki (2026-06-15)

| | |
|--|--|
| **Data** | 2026-06-15 |
| **Kontekst** | Uzupełnienie do [`VISION_PARITY_GATE_2026-06-15.md`](VISION_PARITY_GATE_2026-06-15.md) |
| **Stan fundamentu** | Komponenty, definicje assetów, fixtures, harness — gotowe |

Fundament jest położony. Żeby wizja była realnie zakodowana, brakuje 6 konkretnych rzeczy. Część można dorobić od ręki (bez emulatora), część wymaga uruchomienia generatora/emulatora po stronie zespołu.

---

## 6 brakujących elementów

### Mogę dorobić teraz (bez emulatora, bezpiecznie)

#### 1. Integracja komponentów w pozostałych ekranach

Dziś tylko onboarding jest wpięty. Kolejność:

| Ekran | Komponenty |
|-------|------------|
| **Profil** | `AvatarFramed` + `AchievementGrid` + `LaurelHeader` + `OrnateFrame` |
| **Rywalizacja** | `CityBanner` + `VersusBar` + `LaurelHeader` |
| **Ride summary** | `FinishCelebration` + grade |
| **HUD** | panele 9-slice + ikony akcji zamiast glifów Unicode |

Działają z fallbackiem — ekrany od razu nabiorą kształtu wizji, jeszcze przed PNG-ami.

#### 2. Wpięcie fixtures do ekranów

`isVisionFixtures()` → profil / compete / ride renderują dane 1:1 z mocków.

To warunek, by SSIM-diff w ogóle mógł zejść do zera (inne liczby = wieczny FAIL).

#### 3. Auto-wire assetów

Skrypt skanujący `assets/generated/` i automatycznie wypełniający `require()` w `visionAssets.ts` / `assetRegistry` dla istniejących plików.

Dzięki temu krok „generacja → wiring" jest jednym poleceniem i CI-safe (żadnych `require` do nieistniejących plików).

#### 4. Realny font display

- Dodać `@expo-google-fonts/silkscreen` (lub Pixelify)
- Załadować w `App.tsx` przez `useFonts`
- Przełączyć `FONTS.display`

Cięższe pixelowe tytuły jak na mockach.

### Wymaga zespołu (gotowe „pod to")

#### 5. Uruchomić generator assetów

```bash
python scripts/generate_assets.py
```

Wyprodukuje 25 zdefiniowanych PNG (herby, działy, odznaki, banery, frame, sky). Po tym auto-wire (#3) podpina je bez dotykania kodu.

#### 6. Emulator + harness

1. Zbudować APK z `EXPO_PUBLIC_VISION_FIXTURES=true`
2. Zrobić zrzuty 19 ekranów
3. Odpalić `vision_parity_harness.py --actual <dir> --composite`

→ realny % SSIM i pętla iteracji do progu **0.92**.

To moment, w którym „wizja jest zakodowana" staje się mierzalna.

---

## Najszybszy realny progres

Bez czekania na nic: zrobić **#1 + #2 + #3 + #4** (integracja ekranów + fixtures + auto-wire + font), każdy z PNG before/after jak dotychczas.

Potem zespół odpala **#5** i **#6**, i wskakujemy w pętlę diffów.

### Decyzja do podjęcia

| Opcja A | Opcja B |
|---------|---------|
| Ruszyć z #1–#4 teraz (kolejność: profil → compete → ride/HUD) | Najpierw auto-wire (#3) + font (#4), żeby po generacji wszystko „samo się złożyło" |

---

## Dodatkowe elementy (poza 6 punktami)

Wartościowe dla różnicy między „wygląda podobnie" a „jest zakodowane 1:1":

### Techniczne (kod)

| Element | Opis |
|---------|------|
| **Maestro / adb flow per ekran** | Deterministyczna nawigacja do każdego z 19 kroków audytu (inaczej harness nie ma z czego liczyć SSIM) |
| **9-slice na OrnateFrame** | Gdy `frame_ornate.png` będzie wygenerowany; bez tego ramki zawsze będą „prawie jak mock" |
| **scenes.ts + sunset/night** | Podpięcie `sky_sunset` / `sky_night` do compete / onboarding / finish (dziś głównie `sky_day`) |
| **HUD: ikony akcji z PNG** | Zamiast glifów Unicode (■ ▶ ❚❚) — duży wizualny gap na `02_active_ride_hud.png` |
| **Migracja `fontWeight: '700'` → PixelText** | Na pozostałych ekranach (guard już to śledzi: ~86 miejsc) |
| **Map style** | `retro-ride-style.json` zsynchronizowany z tokenami `grandPrix` — ważne dla HUD i mapy |

### Proces / bramki

| Element | Opis |
|---------|------|
| **CI job „vision-parity"** | Odpala harness, gdy w repo pojawią się zrzuty z emulatora (raport % + fail poniżej 0.92) |
| **Component gallery (dev-only)** | Wszystkie 9 komponentów na jednym ekranie; szybki podgląd bez pełnego flow |
| **Checklist per ekran w gate doc** | Nie tylko PASS/FAIL globalnie, ale: layout / typography / assets / dane / empty-state |

### Dane / API

| Element | Opis |
|---------|------|
| **tenant_id → crest, department → icon** | W typach/API (nie tylko heurystyka po nazwie) |
| **Osiągnięcia z API** | Zamiast statycznej siatki — profil bez tego nie będzie 1:1 z mockiem przy realnych danych |

---

## Priorytetyzacja — największy zwrot teraz

Jeśli iść dalej w kodzie **bez emulatora**, kolejność:

1. Integracja ekranów (profil → compete → ride/HUD)
2. Fixtures w ekranach
3. Auto-wire assetów
4. Font display (Silkscreen)
5. Maestro flow + component gallery

Reszta (generacja PNG, emulator, SSIM w CI) domyka pętlę „mierzalnie 1:1".

---

## Powiązane dokumenty

- [`VISION_PARITY_GATE_2026-06-15.md`](VISION_PARITY_GATE_2026-06-15.md) — gate 56/56 + postęp faz A–D
- [`screenshots/2026-06-15-parity-progress/`](screenshots/2026-06-15-parity-progress/) — PNG per krok
- [`screenshots/2026-06-14-emulator-audit/vision/`](screenshots/2026-06-14-emulator-audit/vision/) — referencja wizualna (56 PNG)
