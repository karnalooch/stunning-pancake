# DPIA platformy 4VELO — stan przedpilotażowy

| | |
|--|--|
| **Status** | PRE-PRODUCTION — ocena robocza / NO-GO do czasu zamknięcia blockerów |
| **Data oceny** | 2026-09-28 |
| **Owner role** | DPO / Legal / Product |
| **lang** | pl |
| **translation** | [English](../en/compliance/DPIA_PLATFORM_CURRENT.md) |
| **canonical_path** | docs/compliance/DPIA_PLATFORM_CURRENT.md |

## 1. Stan faktyczny

4VELO jest w fazie technicznego przejęcia i stabilizacji. Kanoniczny gate T58 opisuje
pilot jako **NO-GO** do czasu zamknięcia wymaganych dowodów przedpilotażowych.
Ten dokument nie zakłada, że publiczny pilot lub produkcyjne przetwarzanie danych
osób fizycznych zostały uruchomione.

Repozytorium potwierdza jednak projektowane funkcje, które przy użyciu z
rzeczywistymi użytkownikami obejmują:

- konto użytkownika, e-mail, role i dane tenanta;
- dokładne ślady GPS i telemetrię aktywności;
- strefy prywatności;
- dane profilu i fizjologiczne, w tym opcjonalne tętno;
- import aktywności i tokeny OAuth Strava/Garmin;
- scoring, wykrywanie anomalii i anti-cheat;
- rankingi, kampanie i potencjalne nagrody;
- moderację, audit log i odwołania;
- opcjonalne płatności przez Stripe.

## 2. Dlaczego DPIA jest wymagana przed pilotem z realnymi danymi

Art. 35 RODO wymaga DPIA przed przetwarzaniem, gdy jego rodzaj może powodować
wysokie ryzyko dla praw i wolności osób. Projekt 4VELO łączy kilka przesłanek
podwyższonego ryzyka: ciągłe dane lokalizacyjne, potencjalne dane dotyczące
zdrowia, profilowanie/automatyczną ocenę aktywności oraz kontekst wielotenantowy.

Dlatego uruchomienie pilota z realnymi użytkownikami i opisanym zakresem danych
jest **legal NO-GO**, dopóki niniejsza ocena nie zostanie uzupełniona o
rzeczywiste role, podstawy prawne, podprocesorów i środki organizacyjne.

Podstawa: art. 35 RODO:
https://eur-lex.europa.eu/eli/reg/2016/679/oj

## 3. Role administrator / procesor

Na 2026-09-28 finalny podmiot prawny operatora 4VELO i model ról per wdrożenie
nie są jeszcze utrwalone w dokumentacji produkcyjnej. Nie wolno wpisywać
fikcyjnej nazwy firmy.

Przed pierwszym przetwarzaniem produkcyjnym należy dla każdego celu ustalić:

| Cel | Rola do ustalenia przed pilotem |
|---|---|
| konto i bezpośrednia usługa 4VELO | administrator zależnie od modelu kontraktowego |
| kampania JST/firmy definiowana przez tenant | tenant może być administratorem, 4VELO procesorem lub współadministrowanie może wymagać analizy |
| bezpieczeństwo własnej platformy i audit | możliwa własna rola administratora operatora |
| płatności / e-mail / push / hosting | relacja z odpowiednim procesorem/podprocesorem wg faktycznego przepływu |

Finalne role muszą być spójne z umowami, privacy notice, RCP i listą
podprocesorów.

## 4. Kategorie danych

| Kategoria | Przykłady | Ryzyko |
|---|---|---|
| Identyfikacyjne | e-mail, username, account ID | standardowe |
| Lokalizacyjne | ślad GPS, live position, privacy zones | wysokie prywatnościowo |
| Profil / fizjologia | wiek, wzrost, waga, parametry sprawności | zależne od użycia |
| Dane dotyczące zdrowia | tętno lub metryki ujawniające stan fizyczny/zdrowotny | szczególna kategoria, jeśli spełnia art. 9 RODO |
| Techniczne | IP, device ID, logi, tokeny push | standardowe/podwyższone |
| OAuth / integracje | tokeny Strava/Garmin, metadata aktywności | podwyższone |
| Płatnicze | identyfikatory transakcji/statusy od operatora płatności | zależne od faktycznego zakresu |

Wzrost, waga, wiek i tętno nie powinny być automatycznie nazywane "danymi
biometrycznymi". Dane biometryczne w rozumieniu RODO mają osobną, węższą
definicję związaną ze specjalnym przetwarzaniem cech w celu jednoznacznej
identyfikacji osoby.

## 5. Podstawy prawne — do finalizacji przed pilotem

Obecny kod i dokumentacja nie wystarczają do uznania podstaw prawnych za
zamknięte. Dla każdego celu należy osobno udokumentować podstawę z art. 6 RODO.
Przykładowo:

- realizacja usługi użytkownika może opierać się na art. 6 ust. 1 lit. b tylko
  w zakresie rzeczywiście niezbędnym do wykonania umowy;
- anti-cheat/bezpieczeństwo może wymagać analizy uzasadnionego interesu
  (art. 6 ust. 1 lit. f) i testu równowagi;
- marketing wymaga niezależnej podstawy i nie może być warunkiem korzystania z
  podstawowej usługi;
- gdy przetwarzanie ujawnia dane dotyczące zdrowia, potrzebny jest dodatkowy
  wyjątek z art. 9 ust. 2 RODO, a nie tylko podstawa z art. 6.

## 6. Automated decision-making / art. 22

4VELO posiada automatyczne hard reject, verification score, ML anomaly detection
oraz opcjonalny mechanizm auto-ban. Art. 22 RODO ma zastosowanie, gdy decyzja
jest oparta wyłącznie na automatycznym przetwarzaniu i wywołuje skutki prawne
lub podobnie istotnie wpływa na osobę.

Dlatego przed pilotem obowiązuje zasada:

- automatyczny scoring może służyć do wykrywania, triage i tymczasowego statusu;
- gdy wynik może oznaczać utratę istotnej nagrody, wykluczenie z wydarzenia,
  blokadę konta lub inny istotny skutek, musi istnieć realna możliwość
  interwencji człowieka, przedstawienia stanowiska i zakwestionowania decyzji;
- konfiguracja auto-ban i automatycznych hard rejectów musi zostać przeglądnięta
  przed każdą kampanią, w której taki skutek jest możliwy;
- moderator musi mieć uprawnienie i informacje pozwalające faktycznie zmienić
  decyzję — review nie może być wyłącznie formalnym kliknięciem.

Podstawa: art. 22 RODO:
https://eur-lex.europa.eu/legal-content/EN-PL/TXT/?uri=CELEX:32016R0679

## 7. Kontekst pracowniczy / AI Act

Kampania firmowa nie może domyślnie zmieniać sportowego scoringu 4VELO w system
oceny pracowniczej. Wyników, flag anti-cheat, profilu sprawności ani danych
aktywności nie wolno wykorzystywać do decyzji o zatrudnieniu, awansie,
wynagrodzeniu, zwolnieniu, przydziale zadań lub ocenie wyników pracy bez
oddzielnej oceny prawnej i klasyfikacji pod AI Act.

To ograniczenie ma być zapisane w kontrakcie/regulaminie wdrożenia firmowego.

AI Act, art. 4 i Annex III:
https://eur-lex.europa.eu/legal-content/PL/TXT/?uri=CELEX:32024R1689

## 8. Retencja i usuwanie — stan faktyczny

Repo zawiera częściowe mechanizmy retencji (m.in. live events, GPX archives) i
dokumentacyjne cele 30/90 dni, ale audyt repo wskazuje brak jednej potwierdzonej
macierzy retencji dla wszystkich tabel danych osobowych oraz brak pełnego proof
erasure dla wszystkich danych GPS/telemetrycznych.

Dlatego wartości typu "konto + 1 rok" lub "90 dni" są na dziś **targetem
polityki**, nie dowodem kompletnego egzekwowania we wszystkich storage'ach.

Przed pilotem wymagane są:

- macierz: typ danych -> storage -> okres -> mechanizm purge/anonymization;
- test end-to-end usunięcia konta obejmujący backend, telemetry, cache, eksporty
  i storage pośredni;
- zasady retencji audit logów wynikające z celu, ryzyka i obowiązków
  kontraktowych — bez fałszywego twierdzenia, że RODO nakazuje uniwersalne
  minimum 3 lat.

## 9. Podprocesorzy i transfery

Aktualny template podprocesorów zawiera placeholdery. Przed realnym pilotem
należy wpisać faktycznych dostawców i zweryfikować:

- hosting/DB/Redis;
- e-mail;
- push (Expo/FCM/APNs, jeśli aktywne);
- monitoring;
- płatności;
- integracje sportowe;
- region przetwarzania;
- DPA;
- podstawę transferu poza EOG, jeśli dotyczy.

Placeholder lub nieznany status DPA oznacza NO-GO dla produkcyjnego przepływu
PII przez danego dostawcę.

## 10. Minimalne środki wymagane przed GO

- [ ] rzeczywisty administrator/operator i dane kontaktowe;
- [ ] role controller/processor per cel i typ kampanii;
- [ ] finalna podstawa art. 6 dla każdego celu;
- [ ] art. 9 basis dla danych zdrowotnych, jeśli aktywne;
- [ ] finalna lista podprocesorów + DPA/SCC/adequacy gdy dotyczy;
- [ ] privacy notice i Terms zgodne z faktycznym przepływem;
- [ ] test DSAR/export/delete;
- [ ] retencja sprawdzona w każdym storage;
- [ ] human-review safeguard dla istotnych decyzji anti-cheat;
- [ ] zakaz employment decision use bez osobnej oceny;
- [ ] re-review DPIA na dokładnym release candidate.

## 11. Ocena końcowa na 2026-09-28

**NO-GO dla publicznego pilota z realnymi danymi osobowymi wyłącznie na podstawie
tego dokumentu.** Nie jest to nowy blocker techniczny; jest to uczciwe
odzwierciedlenie faktu, że obecny T58 również pozostaje NO-GO, a dokumenty
prawne nie mają jeszcze rzeczywistego operatora, kompletu DPA i końcowej
weryfikacji przepływów.

Po zmianie zakresu danych, funkcji anti-cheat, dostawców lub modelu B2B/B2G DPIA
musi zostać ponownie przejrzana.
