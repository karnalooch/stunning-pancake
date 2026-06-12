# Harmonogram kampanii — szablon

| | |
|--|--|
| **Kampania** | `[NAZWA_KAMPANII]` |
| **Start** | `[DATA_START]` |
| **Koniec** | `[DATA_KONIEC]` |
| **Organizator** | `[NAZWA_TENANTA]` |

---

## T-4 tygodnie (przygotowanie)

| Zadanie | Owner | Done |
|---------|-------|------|
| Podpisanie DPIA + lista podprocesorów | Legal / DPO | [ ] |
| Konfiguracja tenanta (branding, sezon, dyscypliny) | Platform Operator | [ ] |
| Finalizacja regulaminu kampanii | Tenant admin | [ ] |
| Brief plakatu → grafik | Marketing tenant | [ ] |
| Test aplikacji przez 3–5 osób (GPS, join, ranking) | QA / kapitan | [ ] |

## T-2 tygodnie (komunikacja)

| Zadanie | Owner | Done |
|---------|-------|------|
| Publikacja regulaminu + FAQ na stronie / intranecie | Tenant | [ ] |
| Plakaty w biurach / urzędzie / klubie | Tenant | [ ] |
| Mail kickoff #1 (zapowiedź + link do app) | HR / komunikacja | [ ] |
| Post social media + grafika | Marketing | [ ] |
| Szkolenie moderatorów (anti-cheat inbox) | Platform Operator | [ ] |

## T-1 tydzień

| Zadanie | Owner | Done |
|---------|-------|------|
| Mail kickoff #2 (instrukcja GPS + start date) | HR | [ ] |
| Weryfikacja burst protection / capacity (jeśli >1k uczestników) | Platform Operator | [ ] |
| Push testowy do zarejestrowanych | Tenant admin | [ ] |

## T-0 — dzień startu

| Godzina | Akcja |
|---------|-------|
| 08:00 | Push „Kampania ruszyła!” |
| 08:00–20:00 | Monitoring join rate, sesji, mapy live |
| Cały dzień | Support na `[EMAIL_SUPPORT]` — SLA odpowiedzi <4 h |

**Weekend RSP (szczyt):** patrz [RSP_WEEKEND_RUNBOOK.md](../operations/RSP_WEEKEND_RUNBOOK.md).

## T+1 tydzień (połowa sezonu)

| Zadanie | Owner |
|---------|-------|
| Push „Ranking tygodnia” / quest pośredni | Tenant |
| Raport uczestnictwa % (admin panel) | Tenant admin |
| Moderacja: przegląd kolejki anti-cheat | Moderator |

## T-koniec (ostatni tydzień)

| Zadanie | Owner |
|---------|-------|
| Push „Zostało X dni!” | Tenant |
| Przypomnienie o dokończeniu synchronizacji GPS | Automat / mail |
| Zamrożenie rankingu: `[DATA_KONIEC] 23:59` | System |

## T+1 po zakończeniu

| Zadanie | Owner | Done |
|---------|-------|------|
| Zamknięcie sezonu w panelu (archiwum) | Tenant admin | [ ] |
| Raport końcowy (PDF ranking, fair-play) | Tenant admin | [ ] |
| Ogłoszenie zwycięzców + wręczenie nagród | Tenant | [ ] |
| Retrospektywa z Platform Operator | Ops | [ ] |

---

*Dostosuj daty do kalendarza lokalnego (maj–czerwiec = szczyt sezonu rowerowego w Polsce).*
