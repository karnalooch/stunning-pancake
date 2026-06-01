# Runbook — mobile (GPS i odporność danych)

**Ostatnia aktualizacja:** 2026-06-02  
**Kod:** `mobile/src/services/GpsSyncManager.ts`, `gpsSyncStorage.ts`, `App.tsx`

---

## Co robi klient

| Mechanizm | Opis |
|-----------|------|
| **MMKV buffer** | Bufor punktów GPS (do 2000); overflow → `gps_buffer_overflow` |
| **Outbox** | Partie telemetry po nieudanym uploadzie; retry przy starcie i co 30 s |
| **pending_session** | POST sesji Django, gdy sieć padła przy starcie jazdy |
| **NetInfo** | Po powrocie online: `flushGpsUploadQueues()` |
| **AppState** | W tle odpina NetInfo; przy `active` — flush + ponowna subskrypcja |
| **Launch recovery** | `recoverGpsDataOnLaunch()` — baner „dokończ wysyłkę” w HUD |

Pełny diagram i klucze MMKV: [DATA_RESILIENCE.md](../DATA_RESILIENCE.md).

---

## Pliki

| Plik | Rola |
|------|------|
| `GpsSyncManager.ts` | Task w tle, upload, recovery, NetInfo |
| `gpsSyncStorage.ts` | Klucze MMKV, bufor, outbox |
| `rideSessionService.ts` | Sesja aktywności Django |
| `App.tsx` | `recoverGpsDataOnLaunch()` przy starcie aplikacji |

---

## Zmienne (mobile)

| Zmienna | Opis |
|---------|------|
| `EXPO_PUBLIC_TELEMETRY_URL` | FastAPI telemetry (domyślnie Railway) |
| `EXPO_PUBLIC_API_URL` | Django API |

---

## Debug (dev)

1. Włącz logi `[GPS]` w Metro — recovery wypisuje liczbę punktów w buforze/outbox.
2. Symuluj tryb samolotowy → wyłącz → sprawdź, czy outbox się opróżnia.
3. Zabij aplikację w trakcie jazdy → uruchom ponownie → baner recovery / wznowienie trasy.

---

## Powiązane

- [DATA_RESILIENCE.md](../DATA_RESILIENCE.md) — architektura warstw
- [ADR-005](../adr/005-telemetry-tracking.md) — telemetria
- [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) — problemy sieciowe / CORS (backend)
