# Polityka Anti-Cheat i Scoring — 4VELO

| | |
|--|--|
| **Status** | Active — public |
| **Wersja** | 1.0 |
| **Data** | 2026-06-12 |
| **Ostatnia aktualizacja** | 2026-06-12 |
| **Owner** | Product / Trust |
| **Audience** | Uczestnicy lig, organizatorzy, decydenci |
| **lang** | pl |
| **translation** | [English](../../en/trust/ANTI_CHEAT_SCORING_POLICY.md) |
| **canonical_path** | docs/gtm/pl/trust/ANTI_CHEAT_SCORING_POLICY.md |
| **Publiczny URL** | `{admin-domain}/#/trust/anti-cheat` |

---

## 1. Zakres

Platforma 4VELO obsługuje wyłącznie trzy dyscypliny:

| Dyscyplina | Typ w systemie | Opis |
|------------|----------------|------|
| Rower | `BIKE` | Jazda rowerem (szosa, MTB, miejski) |
| Bieg | `RUN` | Bieganie, jogging, trucht |
| Nordic walking | `WALK` | Nordic walking (kijki); w systemie klasyfikowany jako aktywność piesza z walidacją prędkości |

Aktywności spoza tego zakresu nie są obsługiwane w kampaniach i ligach 4VELO.

---

## 2. Normalizacja wyniku (scoring)

Rankingi mogą uwzględniać **normalizację**, aby porównywać uczestników o różnej sprawności i różnych warunkach:

- Wynik bazowy pochodzi ze zweryfikowanego dystansu GPS (lub zaimportowanego źródła z odpowiednią flagą).
- Organizator kampanii (tenant) może włączyć współczynnik normalizacji per uczestnik (np. profil sprawności).
- **Szczegóły formuł wewnętrznych nie są publikowane** — zapobiega to celowemu obchodzeniu systemu.
- Do rankingu z nagrodami domyślnie liczą się aktywności ze statusem **zweryfikowana** (`is_verified=true`).

---

## 3. System Anti-Cheat — cztery warstwy

Każda aktywność przechodzi automatyczną weryfikację w warstwach:

| Warstwa | Co sprawdza | Przykłady wykrycia |
|---------|-------------|-------------------|
| **1 — Bramka kinetyczna** | Fizyczna niemożliwość ruchu | Teleport >500 m, przyspieszenie >6 m/s², stała prędkość (CV <5%), linia prosta >92% |
| **1.5 — ML anomalii** | Wzorce statystyczne nietypowe dla człowieka | Nienaturalny rozkład prędkości, segmenty, proporcje czasu |
| **2 — Limity prędkości (V-max)** | Prędkość maksymalna per dyscyplina | RUN 12 m/s (~43 km/h) · BIKE 25 m/s (~90 km/h) · WALK 3,5 m/s (~12,6 km/h) |
| **3 — Walidacja trasy** | Zgodność trasy z siecią dróg/ścieżek | Trasa nieroutowalna, duży mismatch dystansu GPS vs topologia |
| **4 — Score weryfikacyjny** | Łączny wynik zaufania 0–1 | Niski score → kolejka moderacji lub odrzucenie |

Dodatkowo **forensics** (analiza batch): duplikat fingerprint trasy, mismatch metadanych dystansu, import z wearables (Strava/Garmin), aktywność symulowana.

---

## 4. Co dyskwalifikuje lub flaguje aktywność

### Automatyczne odrzucenie (hard reject)

- Prędkość przekraczająca V-max dla danej dyscypliny (wielokrotnie lub utrzymana).
- Teleportacja punktów GPS (skok lokalizacji bez fizycznego przejścia).
- Trasa niemożliwa do przejechania/przebiegnięcia (np. jazda autostradą tam, gdzie brak dojazdu rowerem).
- Duplikat trasy (ten sam fingerprint w wielu kontach lub eventach).
- Aktywność oznaczona jako symulacja/test.

### Flaga do moderacji (soft flag)

- Import z zewnętrznego źródła (Strava/Garmin) — może mieć niższą wagę w rankingu z nagrodami.
- Podejrzenie nordic walking vs bieg (długie odcinki >4 m/s przy typie WALK).
- Niski `verification_score` bez jednoznacznego hard reject.
- Nietypowy, ale możliwy profil prędkości (np. zjazd górski).

### Zabronione zachowania (regulamin ligi)

Niezależnie od automatów, **regulamin kampanii** zabrania:

- Jazdy pojazdem silnikowym z włączonym GPS.
- Spoofingu lokalizacji (aplikacje fałszujące GPS).
- Przesyłania cudzego pliku GPX lub nagrania trasy innej osoby.
- Udostępniania konta („mule”) w celu sztucznego nabijania km.
- Nagradzania aktywności niezgodnych z wybraną dyscypliną.

Przy nagrodach o wartości materialnej organizator może wymagać dodatkowej weryfikacji moderatora.

---

## 5. Status aktywności w aplikacji

| Status | Znaczenie dla uczestnika |
|--------|--------------------------|
| **Zweryfikowana** | Aktywność policzona do rankingu |
| **W kolejce** | Trwa automatyczna lub ręczna weryfikacja |
| **Odrzucona** | Nie liczy się do rankingu; powód dostępny w historii treningów |
| **Oflagowana** | Widoczna z zastrzeżeniem; decyzja moderatora w toku |

Jeśli trasa została odrzucona, sprawdź: czy nie jechałeś pojazdem, czy GPS nie „skakał”, czy trasa była zgodna z drogami (rower). FAQ GPS: [campaign-start/FAQ_GPS_BATERIA.md](../campaign-start/FAQ_GPS_BATERIA.md).

---

## 6. Proces odwołania (appeal)

1. **Zgłoszenie** — w aplikacji (szczegóły aktywności → „Zgłoś odwołanie”) lub e-mail na adres supportu tenanta / operatora platformy.
2. **Wymagane informacje** — data, dyscyplina, krótki opis sytuacji (np. „zjazd z góry”, „GPS w tunelu”).
3. **Przegląd** — moderator sprawdza metryki (średnia prędkość, profil, flagi forensics). **Nie publikujemy publicznych oskarżeń** o oszustwo w czatach ligi.
4. **Decyzja** — przywrócenie aktywności · utrzymanie odrzucenia · ostrzeżenie · wykluczenie z eventu (przy powtarzalnym naruszeniu).
5. **SLA orientacyjny** — pierwsza odpowiedź w ciągu **5 dni roboczych**; decyzja końcowa w ciągu **10 dni roboczych** od kompletnego zgłoszenia.

Cel operacyjny moderatora tenanta: **<60 s** na przejrzenie pojedynczego case w panelu (przy dostępnych danych).

---

## 7. Rola moderatora vs automat

| Element | Automat | Moderator |
|---------|---------|-----------|
| Odrzucenie V-max / teleport | Tak | Może cofnąć (false positive) |
| Kolejka anti-cheat SOC | Priorytetyzacja po `verification_score` | Przegląd i decyzja |
| Import Strava/Garmin | Flaga domyślna | Może zaakceptować z uzasadnieniem |
| Spór między uczestnikami | — | Decyzja na podstawie regulaminu + danych |
| Ban z eventu / konta | Po regule auto_ban (jeśli włączone) | Zawsze możliwy ręcznie |

Operator platformy (GLOBAL_OWNER) ma dostęp do pełnego audit logu decyzji moderacyjnych.

---

## 8. Integracje zewnętrzne

Import z **Strava** lub **Garmin** jest dozwolony technicznie, ale:

- Aktywność importowana może być **oflagowana** (`wearable_imported`).
- W ligach z nagrodami organizator może wymagać **natywnego GPS z aplikacji 4VELO** jako warunku liczenia do rankingu.
- Import nie omija warstw anti-cheat — metadane i fingerprint trasy są nadal analizowane.

---

## 9. Aktualizacje polityki

Zmiany progu lub zakresu publikujemy z **min. 7-dniowym wyprzedzeniem** przed startem nowego sezonu. Dla trwających kampanii stosuje się wersję obowiązującą w dniu startu sezonu.

**Wersja:** 1.0 · **Data:** 2026-06-12

---

*Powiązane: [ONE_PAGER.md](../ONE_PAGER.md) · [REGULAMIN_KAMPANII_TEMPLATE.md](../campaign-start/REGULAMIN_KAMPANII_TEMPLATE.md) · [SPORT_CHEATING_ATHLETES_REPORT](../../../reports/SPORT_CHEATING_ATHLETES_REPORT_2026-06-11.pl.md) (analiza wewnętrzna).*
