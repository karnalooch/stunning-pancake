# FAQ — GPS, bateria i synchronizacja

| | |
|--|--|
| **Kampania** | `[NAZWA_KAMPANII]` |
| **Audience** | Uczestnicy kampanii |
| **lang** | pl |

---

## Przed startem

### Jak przygotować telefon?

1. Zainstaluj aplikację 4VELO i zaloguj się.
2. Nadaj uprawnienia: **lokalizacja zawsze** (Android) / **Zawsze** (iOS) — wymagane do trackingu w tle.
3. Wyłącz oszczędzanie baterii dla aplikacji (ustawienia producenta: Samsung, Xiaomi, Huawei — „bez ograniczeń”).
4. Naładuj telefon przed dłuższą aktywnością; zabierz powerbank na rower >2 h.

### Czy muszę trzymać aplikację otwartą?

Nie. Po starcie sesji możesz zablokować ekran — GPS działa w tle. Na Androidzie widoczna jest notyfikacja „Tracking Active”.

---

## Podczas aktywności

### Dlaczego GPS „skacze” lub zatrzymuje się?

| Przyczyna | Co zrobić |
|-----------|-----------|
| Tunel, garaż, zagęszczone budynki | Normalne — trasa uzupełni się po wyjściu na otwartą przestrzeń |
| Telefon w tylnej kieszeni plecaka | Przenieś do kieszeni bocznej lub uchwytu na rowerze |
| System oszczędza baterię | Wyłącz optymalizację baterii dla 4VELO |
| Brak sygnału >10 min | Dokończ aktywność; punkty zapisane lokalnie zsynchronizują się później |

### Czy stracę trasę bez internetu?

**Nie.** Aplikacja zapisuje punkty lokalnie (outbox) i wysyła je po powrocie sieci. Po restarcie aplikacji może pojawić się baner „dokończ synchronizację” — zaakceptuj i poczekaj.

---

## Po aktywności

### Dlaczego moja trasa została odrzucona?

System anti-cheat sprawdza fizyczne parametry ruchu. Najczęstsze powody:

- Prędkość typowa dla pojazdu silnikowego (np. jazda samochodem).
- Trasa niezgodna z drogami (rower poza dozwolonym routingiem).
- Podejrzenie fałszowania GPS.

Szczegóły: [Polityka Anti-Cheat](../trust/ANTI_CHEAT_SCORING_POLICY.md). Możesz złożyć **odwołanie** (np. zjazd z góry, błąd GPS).

### Jak długo trwa weryfikacja?

Zwykle kilka minut. Skomplikowane przypadki — do 48 h. Status widzisz w historii treningów.

---

## Bateria

### Ile zużywa tracking?

- Tryb zbalansowany (domyślny): ~5–8% / godz. (zależy od modelu).
- Wskazówki: zmniejsz jasność ekranu, tryb samolotowy nie — GPS wymaga danych.

### Czy mogę ładować telefon podczas jazdy?

Tak — zalecane przy długich trasach rowerowych.

---

## Integracje

### Strava / Garmin

Możesz połączyć konto w profilu. Importowane aktywności mogą być **oflagowane** — w kampaniach z nagrodami organizator może wymagać nagrywania w aplikacji 4VELO.

---

## Pomoc

- Support kampanii: `[EMAIL_SUPPORT]`
- Polityka fair-play: `{admin-domain}/#/trust/anti-cheat`
