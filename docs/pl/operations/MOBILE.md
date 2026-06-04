# Runbook — mobile (build, release, odporność danych)


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | pl |
| **translation** | [English](../../en/operations/MOBILE.md) |
| **translation_status** | reviewed |
| **translation_reviewed** | 2026-06-04 |
| **canonical_path** | docs/pl/operations/MOBILE.md |

---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Mobile Lead |
| **Last reviewed** | 2026-06-03 |
| **Cel** | Zbudować i wydać aplikację React Native/Expo oraz obsłużyć awarie GPS/telemetrii w polu. |
| **Audience** | Mobile Lead, Platform Operator (env), QA |
| **Architektura warstw GPS** | [DATA_RESILIENCE.md](../../DATA_RESILIENCE.md) |
| **Kod** | `mobile/src/services/GpsSyncManager.ts`, `gpsSyncStorage.ts`, `App.tsx` |

---

## Wymagania wstępne

| Wymaganie | Uwagi |
|-----------|--------|
| Node.js / npm | Zgodnie z `mobile/package.json` |
| EAS CLI | `npm i -g eas-cli` (release store) |
| Konto Expo | Dostęp do projektu EAS |
| Env | Tylko **publiczne** prefiksy `EXPO_PUBLIC_*` (bez sekretów w repo) |

---

## Zmienne środowiskowe (nazwy)

| Zmienna | Cel |
|---------|-----|
| `EXPO_PUBLIC_API_URL` | Django REST API (prod/staging) |
| `EXPO_PUBLIC_TELEMETRY_URL` | FastAPI telemetry (domyślnie Railway) |

Ustaw w EAS Secrets / `eas.json` profiles / lokalnie `.env` (gitignored). **Nie** dokumentuj wartości URL prod w tabelach — użyj nazw zmiennych.

---

## Build i release (Mobile Lead)

### 1. Development

```bash
cd mobile
npm install
npx expo start
```

### 2. Preview / internal (EAS)

1. Zaloguj: `eas login`
2. Profil z `eas.json` (np. preview)
3. `eas build --profile preview --platform android` (lub ios)

### 3. Production store

1. Podnieś wersję w `app.json` / `app.config.*` (version + buildNumber/versionCode).
2. `eas build --profile production --platform all`
3. `eas submit` wg profilu store (po przejściu QA).
4. **Gate:** [PRE_RELEASE_VERIFICATION.md](./PRE_RELEASE_VERIFICATION.md) + smoke API (`EXPO_PUBLIC_API_URL`).

### Weryfikacja po buildzie

| Check | Oczekiwane |
|-------|------------|
| App start | Brak crash na splash |
| Login / API | `EXPO_PUBLIC_API_URL` odpowiada |
| Telemetry | Punkty trafiają na `EXPO_PUBLIC_TELEMETRY_URL` |
| Recovery | Patrz § Test recovery |

---

## Zachowanie klienta (GPS / sieć)

| Mechanizm | Opis |
|-----------|------|
| **MMKV buffer** | Bufor punktów GPS (do 2000); overflow → `gps_buffer_overflow` |
| **Outbox** | Partie telemetry po nieudanym uploadzie; retry co 30 s |
| **pending_session** | POST sesji Django przy utracie sieci na starcie jazdy |
| **NetInfo** | Po online: `flushGpsUploadQueues()` |
| **AppState** | W tle odpina NetInfo; przy `active` — flush + subskrypcja |
| **Launch recovery** | `recoverGpsDataOnLaunch()` — baner w HUD |

Diagram i klucze MMKV: [DATA_RESILIENCE.md](../../DATA_RESILIENCE.md).

---

## Pliki (implementacja)

| Plik | Rola |
|------|------|
| `GpsSyncManager.ts` | Task w tle, upload, recovery, NetInfo |
| `gpsSyncStorage.ts` | Klucze MMKV, bufor, outbox |
| `rideSessionService.ts` | Sesja aktywności Django |
| `App.tsx` | `recoverGpsDataOnLaunch()` przy starcie |

---

## Test recovery (QA / Mobile Lead)

1. Włącz logi `[GPS]` w Metro — recovery loguje rozmiar bufora/outbox.
2. Tryb samolotowy → wyłącz → outbox powinien się opróżnić.
3. Zabij app w trakcie jazdy → uruchom ponownie → baner recovery / wznowienie trasy.

---

## Troubleshooting

| Objaw | Przyczyna | Akcja |
|-------|-----------|--------|
| Brak uploadu GPS | Zły `EXPO_PUBLIC_TELEMETRY_URL` / CORS | Sprawdź URL w EAS env; [TROUBLESHOOTING.md](../../TROUBLESHOOTING.md) |
| Sesja nie startuje | API down / auth | `EXPO_PUBLIC_API_URL`, token |
| Baner recovery stale | Duży outbox | Dev: wyczyść MMKV testowo; prod: poczekaj na flush + sieć |
| `gps_buffer_overflow` | >2000 punktów w buforze | Sieć + flush; rozważ krótszą jazdę offline |
| Build EAS fail | Credentials / profile | `eas credentials`, log buildu |

---

## Rollback release (Release Manager)

1. Store: wstrzymaj rollout % lub cofnij do poprzedniej wersji w konsoli sklepu.
2. EAS: przebuduj poprzedni git tag z `eas build`.
3. API: jeśli breaking change — rollback backend według [DEPLOYMENT.md](../../DEPLOYMENT.md).

---

## Powiązane

- [DATA_RESILIENCE.md](../../DATA_RESILIENCE.md)
- [ADR-005](../../adr/005-telemetry-tracking.md)
- [TROUBLESHOOTING.md](../../TROUBLESHOOTING.md)
- [OPERATIONS_INDEX.md](./OPERATIONS_INDEX.md)
- [../admin/P0_SMOKE_CHECKLIST.md](../../admin/P0_SMOKE_CHECKLIST.md) (nie dotyczy mobile bezpośrednio)
