/**
 * Public trust policy content — keep in sync with docs/gtm/{pl,en}/trust/ANTI_CHEAT_SCORING_POLICY.md
 */

export const POLICY_PL = `# Polityka Anti-Cheat i Scoring — 4VELO

**Wersja:** 1.0 · **Ostatnia aktualizacja:** 2026-06-12

---

## 1. Zakres

Platforma 4VELO obsługuje wyłącznie trzy dyscypliny:

| Dyscyplina | Typ w systemie | Opis |
|------------|----------------|------|
| Rower | BIKE | Jazda rowerem |
| Bieg | RUN | Bieganie, jogging |
| Nordic walking | WALK | Nordic walking z walidacją prędkości |

---

## 2. Normalizacja wyniku (scoring)

Rankingi mogą uwzględniać **normalizację**, aby porównywać uczestników o różnej sprawności. Organizator kampanii (tenant) może włączyć współczynnik normalizacji per uczestnik. **Szczegóły formuł wewnętrznych nie są publikowane.** Do rankingu z nagrodami domyślnie liczą się aktywności ze statusem **zweryfikowana**.

---

## 3. System Anti-Cheat — cztery warstwy

| Warstwa | Co sprawdza | Przykłady wykrycia |
|---------|-------------|-------------------|
| 1 — Bramka kinetyczna | Fizyczna niemożliwość ruchu | Teleport >500 m, przyspieszenie >6 m/s² |
| 1.5 — ML anomalii | Wzorce statystyczne | Nienaturalny rozkład prędkości |
| 2 — Limity prędkości | V-max per dyscyplina | RUN 12 m/s · BIKE 25 m/s · WALK 3,5 m/s |
| 3 — Walidacja trasy | Zgodność z siecią dróg | Trasa nieroutowalna |
| 4 — Score weryfikacyjny | Wynik zaufania 0–1 | Niski score → moderacja lub odrzucenie |

---

## 4. Co dyskwalifikuje lub flaguje aktywność

### Automatyczne odrzucenie

- Prędkość przekraczająca V-max dla danej dyscypliny.
- Teleportacja punktów GPS.
- Trasa niemożliwa do przejechania/przebiegnięcia.
- Duplikat trasy (ten sam fingerprint w wielu kontach).
- Aktywność oznaczona jako symulacja/test.

### Flaga do moderacji

- Import Strava/Garmin — może mieć niższą wagę w rankingu z nagrodami.
- Podejrzenie nordic walking vs bieg (odcinki >4 m/s przy typie WALK).
- Niski verification_score bez jednoznacznego hard reject.

### Zabronione zachowania (regulamin ligi)

- Jazda pojazdem silnikowym z włączonym GPS.
- Spoofing lokalizacji.
- Cudzy GPX / nagranie trasy innej osoby.
- Udostępnianie konta („mule”).
- Nagradzanie aktywności niezgodnych z dyscypliną.

---

## 5. Status aktywności w aplikacji

| Status | Znaczenie |
|--------|-----------|
| Zweryfikowana | Liczy się do rankingu |
| W kolejce | Trwa weryfikacja |
| Odrzucona | Nie liczy się; powód w historii |
| Oflagowana | Decyzja moderatora w toku |

---

## 6. Proces odwołania (appeal)

1. **Zgłoszenie** — w aplikacji lub e-mail supportu tenanta.
2. **Wymagane informacje** — data, dyscyplina, opis sytuacji.
3. **Przegląd** — moderator sprawdza metryki. Brak publicznych oskarżeń w czatach ligi.
4. **Decyzja** — przywrócenie · utrzymanie odrzucenia · ostrzeżenie · wykluczenie.
5. **SLA** — pierwsza odpowiedź w **5 dni roboczych**; decyzja w **10 dni roboczych**.

---

## 7. Rola moderatora vs automat

Automat odrzuca V-max i teleport. Moderator może cofnąć false positive, zaakceptować import wearable z uzasadnieniem i wykluczyć z eventu przy powtarzalnych naruszeniach.

---

## 8. Integracje zewnętrzne

Import Strava/Garmin może być oflagowany. W ligach z nagrodami organizator może wymagać natywnego GPS z aplikacji 4VELO.

---

## 9. Aktualizacje polityki

Zmiany publikujemy z min. **7-dniowym wyprzedzeniem** przed startem nowego sezonu.

*Pełna wersja dokumentu: docs/gtm/pl/trust/ANTI_CHEAT_SCORING_POLICY.md*
`;

export const POLICY_EN = `# Anti-Cheat and Scoring Policy — 4VELO

**Version:** 1.0 · **Last updated:** 2026-06-12

---

## 1. Scope

The 4VELO platform supports only three disciplines:

| Discipline | System type | Description |
|------------|-------------|-------------|
| Cycling | BIKE | Bicycle |
| Running | RUN | Running, jogging |
| Nordic walking | WALK | Nordic walking with speed validation |

---

## 2. Score normalization (scoring)

Leaderboards may use **normalization** to compare participants with different fitness levels. Campaign organizer (tenant) may enable per-participant normalization. **Internal formula details are not published.** For prize leagues, only **verified** activities count by default.

---

## 3. Anti-cheat system — four layers

| Layer | What it checks | Detection examples |
|-------|----------------|-------------------|
| 1 — Kinematic gate | Physically impossible movement | Teleport >500 m, acceleration >6 m/s² |
| 1.5 — ML anomalies | Statistical patterns | Unnatural speed distribution |
| 2 — Speed limits | V-max per discipline | RUN 12 m/s · BIKE 25 m/s · WALK 3.5 m/s |
| 3 — Route validation | Road/path network match | Unroutable track |
| 4 — Verification score | Trust score 0–1 | Low score → moderation or rejection |

---

## 4. What disqualifies or flags an activity

### Automatic rejection

- Speed exceeding V-max for the discipline.
- GPS point teleportation.
- Route impossible to ride/run.
- Duplicate route (same fingerprint across accounts).
- Activity marked as simulation/test.

### Moderation flag

- Strava/Garmin import — may have lower weight in prize leaderboards.
- Suspected nordic walking vs running (segments >4 m/s with WALK type).
- Low verification_score without clear hard reject.

### Prohibited behaviour (league rules)

- Motor vehicle travel with GPS enabled.
- Location spoofing.
- Someone else's GPX / recording.
- Account sharing ("mule").
- Rewarding activities inconsistent with discipline.

---

## 5. Activity status in the app

| Status | Meaning |
|--------|-----------|
| Verified | Counts toward leaderboard |
| In queue | Verification in progress |
| Rejected | Does not count; reason in history |
| Flagged | Moderator decision pending |

---

## 6. Appeal process

1. **Submit** — in app or tenant support email.
2. **Required information** — date, discipline, brief description.
3. **Review** — moderator checks metrics. No public accusations in league chats.
4. **Decision** — restore · uphold rejection · warning · exclusion.
5. **SLA** — first response within **5 business days**; final decision within **10 business days**.

---

## 7. Moderator vs automation

Automation rejects V-max and teleport. Moderator can reverse false positives, accept wearable import with justification, and exclude from event for repeat violations.

---

## 8. External integrations

Strava/Garmin import may be flagged. Prize leagues may require native GPS from the 4VELO app.

---

## 9. Policy updates

Changes published with at least **7 days' notice** before a new season starts.

*Full document: docs/gtm/en/trust/ANTI_CHEAT_SCORING_POLICY.md*
`;
