# FAQ & TUTORIALS — 4VELO Platform


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | pl |
| **translation** | [English](../../en/product/FAQ.md) |
| **canonical_path** | docs/pl/product/FAQ.md |

---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Product / Support |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Użytkownicy końcowi, support |

Dokumentacja techniczna: [docs/README.md](../README.md) · GPS: [operations/MOBILE.md](../operations/MOBILE.md) · RODO: [compliance/RCP.md](../../compliance/RCP.md)

## Często Zadawane Pytania (FAQ)

### 1. Dlaczego moja trasa została odrzucona?
Nasz system Anti-Cheat sprawdza fizyczne parametry Twojego ruchu. Jeśli prędkość była zbyt wysoka (np. jazda samochodem) lub trasa nie pokrywała się z drogami (w przypadku roweru), aktywność może zostać odrzucona lub oflagowana.

### 2. Jak działają Strefy Prywatności?
Możesz zdefiniować strefy (np. wokół domu), w których Twój ślad GPS będzie automatycznie ucinany lub maskowany szumem. Dzięki temu Twoja dokładna lokalizacja zamieszkania nigdy nie trafi do publicznych rankingów.

### 3. Jak odebrać nagrodę?
Po zebraniu odpowiedniej liczby punktów (XP), przejdź do zakładki "Rewards", wybierz voucher i kliknij "Redeem". Wygenerowany kod QR pokaż w punkcie partnerskim.

## Tutoriale (Krótkie instrukcje)

### Pierwszy Bieg / Jazda
1. Otwórz aplikację i poczekaj na "GPS Lock".
2. Przytrzymaj przycisk "START SESSION".
3. Schowaj telefon — system działa w tle.
4. Po zakończeniu przytrzymaj "STOP" i poczekaj na synchronizację.

### Integracja z Garmin/Strava
1. Przejdź do profilu.
2. Wybierz "Integrations".
3. Zaloguj się do swojego konta Garmin/Strava i zaakceptuj przesyłanie danych.
4. Twoje nowe aktywności będą automatycznie lądować w 4VELO.

### 4. Zgubiłem sygnał GPS w trakcie jazdy — czy stracę trasę?

Aplikacja zapisuje punkty lokalnie (MMKV) i wysyła je ponownie po powrocie sieci. Po restarcie aplikacji może pojawić się prośba o dokończenie wysyłki — zaakceptuj i poczekaj na synchronizację. Szczegóły: [DATA_RESILIENCE.md](../DATA_RESILIENCE.md).
