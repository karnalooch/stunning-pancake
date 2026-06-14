# Mobile Fix-Forward Playbook (4VELO)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Mobile Lead / On-call |
| **Last reviewed** | 2026-06-14 |
| **Audience** | On-call, mobile engineers, QA, release |
| **lang** | pl |
| **translation** | [English](../../en/operations/MOBILE_FIX_FORWARD_PLAYBOOK.md) |
| **canonical_path** | docs/pl/operations/MOBILE_FIX_FORWARD_PLAYBOOK.md |
| **Powiązane** | [TROUBLESHOOTING.md](../../TROUBLESHOOTING.md) · [MOBILE.md](./MOBILE.md) · [MOBILE_FULL_VISION_VERIFICATION.md](./MOBILE_FULL_VISION_VERIFICATION.md) |

---

## Cel

Procedura szybkiego i bezpiecznego naprawiania regresji mobile po merge/release bez "chaotycznych hotfixów".

Model: **detect → triage → isolate → patch → verify → communicate → follow-up**.

---

## 1) Klasy incydentów i SLA reakcji

| Klasa | Przykład | SLA reakcji | SLA hotfix |
|-------|----------|-------------|------------|
| P0 | crash on startup, brak startu jazdy, utrata telemetry | 15 min | 2-4h |
| P1 | deep link broken, błędne summary, brak mapy | 30 min | 8h |
| P2 | UI drift, copy mismatch, pojedynczy ekran fallback | 1h | 24-48h |

---

## 2) Triage template (obowiązkowy)

Każdy incydent musi mieć:

1. **Impact:** ilu userów / jaka funkcja.
2. **Scope:** platforma (iOS/Android), wersja builda, warunki.
3. **Repro steps:** minimalny scenariusz.
4. **Suspected area:** plik/moduł/feature.
5. **Rollback vs fix-forward decision**.

Bez tych 5 punktów nie ruszamy patcha.

---

## 3) Drzewo decyzji: rollback czy fix-forward

## Rollback, gdy:

- P0 i brak pewnej przyczyny root-cause w <60 min.
- Błąd dotyka startup/lifecycle auth/ride i nie ma szybkiego guard fix.

## Fix-forward, gdy:

- root-cause jest zidentyfikowany,
- poprawka jest lokalna,
- mamy szybką ścieżkę weryfikacji (unit + smoke + manual repro).

---

## 4) Procedura fix-forward (krok po kroku)

1. **Zamrożenie zakresu:** naprawa tylko przyczyny i minimalnych efektów ubocznych.
2. **Dodanie testu reprodukującego** (jeśli możliwe).
3. **Patch kodu** w najmniejszym możliwym obszarze.
4. **Weryfikacja lokalna:**
   - lint na zmodyfikowanych plikach,
   - testy dotkniętej domeny,
   - smoke flow dla scenariusza błędu.
5. **Patch notes:** co się zepsuło, co naprawiono, czego nie dotykano.
6. **Deployment + monitoring** przez ustalone okno obserwacji.

---

## 5) Minimalne zestawy testów per domena

| Domena | Zestaw minimalny |
|--------|------------------|
| Auth/session | login/register + restore session + logout |
| Ride lifecycle | start/pause/resume/stop + summary |
| GPS durability | recovery banner + resend po reconnect |
| Navigation | trasa stack/tabs + deep links krytyczne |
| Explore/marketplace | wejście/wyjście + fallback network |
| Profile/training | ładowanie historii + activity detail |

---

## 6) Komunikacja incydentu

## Do zespołu (wewnętrznie)

- status co 30-60 min,
- ETA kolejnego update'u,
- czy decyzja to rollback czy fix-forward.

## Do stakeholderów

- impact językiem biznesowym,
- status mitigation,
- przewidywany termin pełnego rozwiązania.

---

## 7) Post-incident follow-up (do 24h)

Po naprawie trzeba dodać:

1. test regresyjny,
2. update odpowiedniego runbooka,
3. notatkę "co mogło temu zapobiec" (quality gate / check),
4. decyzję czy potrzeba dodatkowego hardeningu.

---

## 8) Najczęstsze źródła regresji (watchlist)

- rozjechany kontrakt `types.ts` vs `linking.ts`,
- pojedynczy język i18n,
- wprowadzenie nowych fallback URL dla release,
- brak edge-state handling przy API error,
- szybkie refaktory ekranów bez adapterów legacy,
- niespójne tokeny UI i lokalne hardcoded style.

---

## 9) Gotowy szablon "Hotfix PR"

## Incident
- ID:
- Severity:
- Trigger version:

## Root cause
- ...

## Scope
- Files changed:
- Why this is minimal:

## Verification
- Tests:
- Smoke:
- Manual repro:

## Risk
- Potential side effects:
- Rollback plan:

## Docs updated
- ...
