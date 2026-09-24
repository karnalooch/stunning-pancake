# Runbook — mobile (build, release, odporność danych)


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-09-24 |
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
| **Last reviewed** | 2026-09-24 |
| **Cel** | Zbudować i wydać aplikację React Native/Expo oraz obsłużyć awarie GPS/telemetrii w polu. |
| **Audience** | Mobile Lead, Platform Operator (env), QA |
| **Architektura warstw GPS** | [DATA_RESILIENCE.md](../../DATA_RESILIENCE.md) |
| **Kod** | `mobile/src/services/GpsSyncManager.ts`, `gpsSyncStorage.ts`, `App.tsx` |

---

## Wymagania wstępne

| Wymaganie | Uwagi |
|-----------|--------|
| Node.js / pnpm | Node.js 24.21.0 LTS + pnpm 12.4.2 (toolchain root monorepo) |
| EAS CLI | Używaj przypiętego w repo `eas-cli@24.7.0` przez skrypty `pnpm --dir mobile ...`; instalacja globalna nie jest potrzebna. |
| Konto Expo | Dostęp do projektu EAS |
| Env | Tylko **publiczne** prefiksy `EXPO_PUBLIC_*` (bez sekretów w repo) |

---

## Zmienne środowiskowe (nazwy)

| Zmienna | Cel |
|---------|-----|
| `EXPO_PUBLIC_API_URL` | Django REST API (prod/staging) |
| `EXPO_PUBLIC_TELEMETRY_URL` | FastAPI telemetry (domyślnie Railway) |

Profile zdalne pobierają te wartości z wybranego EAS Environment (`development` / `preview` / `production`); lokalny development może używać ignorowanego przez Git `.env`. Tylko `pilot-local` celowo trzyma endpointy localhost w `eas.json`. **Nie** dokumentuj wartości URL prod w tabelach — użyj nazw zmiennych.

---

## Build i release (Mobile Lead)

### 1. Development

```bash
# from the monorepo root
pnpm install --frozen-lockfile
pnpm --dir mobile start
```

### 2. Preview / internal (EAS)

1. Zaloguj się przypiętym CLI: `pnpm --dir mobile dlx eas-cli@24.7.0 login`
2. Profil z `eas.json` (np. preview)
3. `pnpm --dir mobile build:preview:android` (lub `pnpm --dir mobile build:preview:ios`)

### 2a. Lokalny build natywny Windows — wyłącznie diagnostyczny

Kanoniczne artefakty pilot/preview/production powstają z przypiętych profili **EAS**. Surowy lokalny `expo prebuild + Gradle` służy wyłącznie do diagnostyki.

Diagnostyka na Windows:

```powershell
# root monorepo
. .\scripts\android-env.ps1
pnpm install --frozen-lockfile
pnpm --dir mobile build:diagnostic:android:windows
```

Zasady:

- przy problemach CMake/Ninja z długością ścieżek używaj krótkiej ścieżki worktree;
- nie przełączaj monorepo na hoisted linking tylko po to, żeby maskować problem długości ścieżek;
- lokalnego APK z Gradle nie traktuj jako artefaktu preview/production;
- nie używaj doraźnego `reactNativeArchitectures` w instrukcjach release-grade;
- build ograniczony do jednego ABI jest dozwolony wyłącznie jako jawnie opisana diagnostyka emulatora;
- autorytet package/version/runtimeVersion dla wydania pozostaje w repo SSOT + profilu EAS + bramce native provenance.

Historyczny skrypt `build:local:preview:android` pozostaje tylko aliasem kompatybilności do polecenia diagnostycznego i nie oznacza buildu profilu EAS preview. Nowa dokumentacja i automatyzacja używają `build:diagnostic:android:windows`.

### 3. Production store

1. Wersja produktu ma jedno źródło prawdy: repo-root `version.json`.
2. Zmień ją poleceniem `pnpm version:set -- <MAJOR.MINOR.PATCH> --prerelease <id>` (np. `dev`, `rc.1`) albo bez `--prerelease` dla stabilnego release.
3. Sprawdź kontrakt: `pnpm version:check`. `mobile/app.config.js` pobiera z SSOT wyłącznie numeryczne `MAJOR.MINOR.PATCH` jako wersję widoczną dla użytkownika.
4. Uruchom przypięte skrypty `pnpm --dir mobile build:prod:android` / `pnpm --dir mobile build:prod:ios`. EAS jest właścicielem natywnych numerów buildów (`android.versionCode` / `ios.buildNumber`) i dla profilu production zwiększa je automatycznie.
5. Po QA użyj przypiętego CLI do submitu, np. `pnpm --dir mobile dlx eas-cli@24.7.0 submit --platform android --profile production`.
6. Stabilny tag Git musi mieć dokładnie postać `vMAJOR.MINOR.PATCH`, zgadzać się z `version.json` i jest blokowany, dopóki `prerelease` nie jest puste.
7. **Gate:** [PRE_RELEASE_VERIFICATION.md](./PRE_RELEASE_VERIFICATION.md) + smoke API (`EXPO_PUBLIC_API_URL`).

Nie edytuj ręcznie `versionCode`, `buildNumber`, `mobile/package.json`, `admin/package.json` ani wersji w `app.config.js`. Robi to kontrakt wersjonowania; root `app.json` nie jest już źródłem konfiguracji Expo.

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
| Build EAS fail | Credentials / profile | `pnpm --dir mobile dlx eas-cli@24.7.0 credentials`, log buildu |

---

## Rollback release (Release Manager)

1. Store: wstrzymaj rollout % lub cofnij do poprzedniej wersji w konsoli sklepu.
2. EAS: przebuduj poprzedni git tag przypiętymi skryptami `pnpm --dir mobile build:prod:*`.
3. API: jeśli breaking change — rollback backend według [DEPLOYMENT.md](../../DEPLOYMENT.md).

---

## Powiązane

- [MOBILE_BACKGROUND_TRACKING_MIGRATION.md](./MOBILE_BACKGROUND_TRACKING_MIGRATION.md) — migracja trackingu tła (Android/iOS, KPI, eskalacja)
- [DATA_RESILIENCE.md](../../DATA_RESILIENCE.md)
- [ADR-005](../../adr/005-telemetry-tracking.md)
- [TROUBLESHOOTING.md](../../TROUBLESHOOTING.md)
- [OPERATIONS_INDEX.md](./OPERATIONS_INDEX.md)
- [../admin/P0_SMOKE_CHECKLIST.md](../../admin/P0_SMOKE_CHECKLIST.md) (nie dotyczy mobile bezpośrednio)
