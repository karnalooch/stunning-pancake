# Mobile Startup Hardening Playbook (4VELO)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Mobile Lead / Release Manager |
| **Last reviewed** | 2026-06-14 |
| **Audience** | Mobile engineers, QA, release, on-call |
| **lang** | pl |
| **translation** | [English](../../en/operations/MOBILE_STARTUP_HARDENING_PLAYBOOK.md) |
| **canonical_path** | docs/pl/operations/MOBILE_STARTUP_HARDENING_PLAYBOOK.md |
| **Powiązane** | [MOBILE.md](./MOBILE.md) · [MOBILE_FULL_VISION_VERIFICATION.md](./MOBILE_FULL_VISION_VERIFICATION.md) · [DATA_RESILIENCE.md](../../pl/DATA_RESILIENCE.md) · [ADR 012](../../adr/012-mobile-performance-budgets.md) · [ADR 014](../../adr/014-mobile-immersive-pixel-art-and-bike-computer.md) |

---

## Cel

Checklist i procedury prewencyjne na start przebudowy mobile full vision. Dokument minimalizuje ryzyko poprawek "po fakcie" przez:

- twarde bramy przed merge/release,
- mapowanie ownerów i odpowiedzialności,
- kolejność prac bez konfliktów architektonicznych,
- listę antywzorców, które najczęściej powodują regresje.

---

## 1) Reguły "nie negocjujemy"

1. **Ride core > skin**: live HUD i tracking mają priorytet nad efektami wizualnymi.
2. **Brak sekretów w kliencie**: tylko `EXPO_PUBLIC_*` dla danych publicznych.
3. **Offline durability**: żaden merge nie może osłabić MMKV buffer/outbox/recovery.
4. **Kontrakt nawigacji jest centralny**: trasy i deep linki modyfikujemy przez `navigation/types.ts` + `navigation/routeContract.ts` + `navigation/linking.ts`.
5. **UI token-first**: brak nowych hardcoded kolorów/spacingu poza tokenami theme.
6. **PL/EN parity**: nowe stringi muszą wejść równolegle do `strings.pl.ts` i `strings.en.ts`.

---

## 2) Owner matrix (kto blokuje merge)

| Obszar | Owner | Bloker merge gdy niespełnione |
|--------|-------|-------------------------------|
| Ride lifecycle + GPS durability | Mobile Lead | `ride-lifecycle` lub `gps-recovery` smoke fail |
| Navigation contract + deep links | Mobile Lead | brak zgodności route types i linking config |
| API/auth/session | Backend + Mobile Lead | błędy 401 refresh flow / session restore |
| Performance budgets | Mobile Lead + QA | naruszenia budżetów bez planu degradacji |
| Accessibility/reduced motion | Mobile Lead + QA | brak fallbacku motion lub niska czytelność HUD |
| i18n PL/EN | Mobile + Product | brak kluczy lub rozjazd copy między językami |
| Docs parity EN/PL | Documentation maintainer | brak aktualizacji indeksów i runbooków |

---

## 3) Faza startowa (D0-D3) — minimalny zestaw stabilizujący

## D0 (przed pierwszym dużym PR)

- Potwierdzić aktywne SSOT:
  - `docs/design/DESIGN_SYSTEM_MOBILE.md`
  - `docs/adr/014-mobile-immersive-pixel-art-and-bike-computer.md`
  - `docs/pl/DATA_RESILIENCE.md`
  - `docs/adr/012-mobile-performance-budgets.md`
- Potwierdzić env na lokalnym buildzie:
  - `EXPO_PUBLIC_API_URL`
  - `EXPO_PUBLIC_TELEMETRY_URL`
  - `EXPO_PUBLIC_ENABLE_FIREBASE` (wg środowiska)
- Potwierdzić że `expo start` i build preview uruchamiają app bez crash na cold start.

## D1-D2 (architektura i kontrakty)

- Zamrozić kontrakt tras (`navigation/types.ts` + deep link mapa).
- Zdefiniować granice modułów `features/*` i ich README contracts.
- Ustanowić adaptery legacy (wrappery) zamiast masowego przepisywania wszystkiego naraz.

## D3 (pierwszy quality gate)

- Uruchomić:
  - unit/integration dla kontraktów nawigacji i performance budget,
  - smoke E2E (`auth-login`, `ride-lifecycle`, `gps-recovery-banner`).
- Wymagać checklisty "done" w PR:
  - i18n parity,
  - offline fallback,
  - edge state UI.

---

## 4) Quality gates per PR (obowiązkowe)

Każdy PR musi mieć sekcję "Gate evidence":

1. **Scope:** co dokładnie zmieniono (max 5 punktów).
2. **Ryzyka:** co może się zepsuć.
3. **Dowody testów:** komendy + wynik (pass/fail).
4. **Edge states:** offline / loading / empty / error.
5. **i18n:** potwierdzenie PL/EN.
6. **Docs:** lista zaktualizowanych dokumentów.

Jeśli dowodów brak, PR wraca do autora.

---

## 5) Anti-regression checklist (copy/paste do PR)

- [ ] Nie zmieniono kontraktu `RootStackParamList` bez aktualizacji linking.
- [ ] Nie dodano hardcoded URL fallback dla release (`__DEV__` only).
- [ ] Ride HUD nadal pokazuje GPS + battery + clock.
- [ ] STOP wymaga potwierdzenia (hold/guard).
- [ ] `useMotionPolicy` / degrade nadal działają przy niskim FPS.
- [ ] `RiderPreferencesService` nie traci zgodności kluczy MMKV.
- [ ] `ActivityService` i `OfflineCacheService` mają fallback UI na ekranach domenowych.
- [ ] Nie dodano nowych stringów tylko w jednym języku.
- [ ] `expo-battery`, mapa i voice cues mają bezpieczny fallback, gdy API platformowe zawiedzie.
- [ ] Zaktualizowano co najmniej jeden runbook, jeśli zmiana dotyczy operacji.

---

## 6) Smoke matrix (co sprawdzamy codziennie)

| Flow | Oczekiwany wynik | Priorytet |
|------|-------------------|-----------|
| Auth login/register | użytkownik dochodzi do shell bez crash | P0 |
| Start ride | przejście do tracking + live metryki | P0 |
| Pause/resume/stop | prawidłowy lifecycle + summary | P0 |
| GPS recovery | niewysłane punkty da się dosłać po powrocie online | P0 |
| Explore map | render mapy + brak zacięć na wejściu/wyjściu | P1 |
| Marketplace | pobranie balance/pools, brak crash przy błędzie API | P1 |
| Profile/training/activity | fallback cache działa offline | P1 |
| Settings sections | przełączanie sekcji + zapisy preferencji | P1 |
| Deep links | `activity`, `explore/map`, `settings` otwierają poprawne trasy | P1 |

---

## 7) Performance hardening checklist

- HUD:
  - target 60 FPS, budżet minimalny 55 FPS,
  - automatyczny degrade motion/particles aktywny.
- Telemetry:
  - ingest latency < 2s (docelowo),
  - outbox flush < 5s (docelowo),
  - retry/backoff + `Retry-After`.
- Pamięć:
  - brak nowych dużych assetów bez uzasadnienia,
  - atlasy i tekstury ładowane świadomie.

Jeśli metryki przekraczają budżet, PR musi zawierać plan mitigacji.

---

## 8) Security/privacy hardening checklist

- JWT i refresh tokeny wyłącznie przez SecureStore + `authTokenStorage`.
- Brak wrażliwych wartości w logach dev/prod.
- Privacy Zones:
  - endpointy utrzymane,
  - UI nie może sugerować, że funkcja działa, jeśli backend zwraca błąd.
- W przypadku błędów auth:
  - stan sesji czyści się deterministycznie,
  - user dostaje poprawną ścieżkę powrotu do logowania.

---

## 9) Start-release gate (przed preview/prod)

- [ ] `pnpm --filter 4velo lint` bez błędów.
- [ ] Krytyczne testy unit/integration pass.
- [ ] Krytyczne Maestro smoke pass.
- [ ] Manual QA P0 pass (auth/ride/gps/deep-link/settings).
- [ ] Wersja docs EN/PL zsynchronizowana.
- [ ] Wersja build i release notes uzupełnione.
- [ ] Rollback plan wskazany (kto, jak, kiedy).

---

## 10) Definicja "done" dla etapu startowego

Etap startowy uznajemy za domknięty tylko gdy:

1. Ride core i GPS resilience są stabilne przez minimum 3 kolejne dni testów.
2. Najważniejsze trasy deep-link działają bez regresji.
3. Docs matrix + runbooki są aktualne i podpięte w indeksach.
4. Zespół ma jeden uzgodniony schemat jakości PR (sekcja Gate evidence).
