# 4VELO — plan częściowego takeoveru i pilotażu

Data decyzji: 2026-09-14. Właściciel zatwierdził zakres w rozmowie i zlecił publikację w repozytorium.

## Pierwszeństwo i cel

Ten dokument zastępuje obowiązek wykonania całego programu T00–T59 przed pilotażem oraz jego automatyczną kolejność. [Master Cleanup Plan](TAKEOVER_CLEANUP_PLAN.md) pozostaje backlogiem, historią decyzji i źródłem szczegółowych kontraktów. Nie oznaczamy odłożonych transz jako DONE. Istniejących bramek CI i zabezpieczeń nie osłabiamy.

Cel: bezpieczna, użyteczna aplikacja do nagrywania jazdy, z przebudowywanym etapami interfejsem mobilnym i zachowanym backendem. Mierzymy działające ścieżki użytkownika, nie liczbę zamkniętych transz.

T11 scalono w PR #83: squash `6e0c720599fce7afc7ef1861f9342303d0b0344b`. To fundament izolacji, nie potwierdzenie bezpieczeństwa całego wdrożenia.

## Zachowujemy i przebudowujemy

| Obszar | Decyzja |
| --- | --- |
| Django, PostGIS, konta, role i API | Zachowujemy; naprawiamy problemy dotyczące pilotażu |
| GPS i synchronizacja | Zachowujemy warunkowo, po testach niezawodności |
| Mobile | Przebudowujemy ekranami w istniejącym projekcie, bez drugiej aplikacji |
| Admin klubu | Zachowujemy; dopracowujemy potrzebne widoki |
| GLOBAL_OWNER | Zachowujemy; sprawdzamy kluby, administratorów, blokady i audyt |
| Infrastruktura | Izolowany home lab jako bramka; Railway po pozytywnej walidacji i osobnym zleceniu wdrożenia |
| Pozostałe funkcje | Odkładamy; nieużywane endpointy zabezpieczamy albo wyłączamy na serwerze |

## Zakres pilotażu

Pierwsza platforma: Android. Jeden klub, przy zachowaniu modelu wielotenantowego. Proponowana pierwsza grupa: 3–5 dobrowolnych testerów z Grupetto; zaproszenia dopiero po bramce bezpieczeństwa.

Mobile: logowanie, profil, rozpoczęcie i zakończenie jazdy, nagrywanie GPS, mapa, czas, dystans, prędkość, trwały zapis offline i synchronizacja, historia i szczegóły aktywności. Jawne stany GPS, uprawnień, błędów i oczekującej synchronizacji.

Wygląd: nowoczesny czytelny pixelart w ilustracjach, avatarach i detalach. Zwykła czytelna typografia, funkcjonalna mapa i wykresy. Ekran jazdy czytelny na słońcu i obsługiwany jedną ręką.

Admin klubu: członkowie, dozwolone role, przegląd i moderacja aktywności własnego klubu.

GLOBAL_OWNER: kluby, administratorzy, blokady kont i istniejący audyt. Bez nowego panelu analitycznego od zera.

Poza pilotażem: publiczny live tracking, billing B2B, vouchery, sponsorzy, AI, symulatory, Electron, Kubernetes jako produkcja, zaawansowana grywalizacja i walidacja iOS. Ukrycie przycisku nie jest wyłączeniem funkcji po stronie serwera.

## Ustalenia z kodu i niepewności

Odczyt kodu na bazie T11, nie wynik testu runtime:

- [gpsSyncUpload.ts](../mobile/src/services/gpsSyncUpload.ts) wysyła punkty do telemetrii przez HTTP batch, z opcjonalną ścieżką WS. Wyłączenie podglądu live nie usuwa zależności zapisu jazdy od telemetrii.
- [GpsSyncManager.ts](../mobile/src/services/GpsSyncManager.ts) wiąże finalizację z opróżnieniem kolejki. Należy sprawdzić propagowanie błędów finalizacji: helper może zakończyć się po wyczerpaniu prób bez potwierdzenia serwera, a wywołujący ustawić finalized=true.
- [gpsSyncStorage.ts](../mobile/src/services/gpsSyncStorage.ts) ogranicza zapis outbox do ostatnich 50 wpisów. Należy testem rozstrzygnąć możliwość utraty niepotwierdzonych paczek.
- Weryfikujemy także trwałość bez dostępnego MMKV, równoległe wysyłki różnych paczek, restart oraz zmianę konta. Nie przepisujemy mechanizmów przed ustaleniem przyczyny.

Nie ma jeszcze dowodu działania całej ścieżki na telefonie. Nie wyznaczamy daty końca przed pierwszym uruchomieniem.

## Etapy i kryteria ukończenia

Etap grupuje cel; implementacja nadal odbywa się w małych PR-ach o jednej odpowiedzialności.

| Etap | Zakres | Kryterium |
| --- | --- | --- |
| P0 — zakres | Ten plan, powiązanie backlogu, status T11 | Brak sprzecznego nakazu wykonania wszystkich transz |
| P1 — punkt odniesienia | Home lab, instalowalny Android, syntetyczne konta dwóch tenantów, istniejący interfejs | Raport logowanie → jazda → zapis → historia → admin z dokładnym miejscem błędu |
| P2 — bezpieczny zapis | Autoryzacja telemetrii, izolacja odczytów, kontrakt paczek, ACK, retry, finalizacja | Testy ustalonych scenariuszy bez utraty, duplikacji ani pomieszania danych |
| P3 — mobile UI | Jazda → podsumowanie → historia → główny → profil/logowanie | Prawdziwe dane, stany błędu i synchronizacji na każdym ekranie |
| P4 — panele i operacje | Admin, GLOBAL_OWNER, konfiguracja, migracje, backup i odtworzenie | Pełna ścieżka i odtworzenie bazy sprawdzone |
| P5 — pilotaż | Realne jazdy małej grupy po bramce | Brak znanych blokerów bezpieczeństwa i zapisu; decyzja o rozszerzeniu |

Mockupy można projektować po P0 równolegle czasowo z pracami technicznymi, ale bez automatycznego uruchamiania dodatkowych agentów. Etapy nie upoważniają do wdrożeń ani operacji na prawdziwych danych.

## Przypisanie T00–T59

Klasyfikacja dotyczy zakresu, nie zmienia faktycznych statusów wykonania. Jeśli realizujemy część transzy, zapisujemy wykonane kryteria i pozostały zakres, zamiast oznaczać całą jako DONE.

| Kategoria | Transze | Zasada |
| --- | --- | --- |
| Wykonany fundament | T00, T02–T04, T07–T11, T21–T22, T24 | Zachować i testować istotne regresje |
| Przed pilotażem | T01, T05, T13–T14, T16 | Rozwiązać blokadę sekretów; zabezpieczyć używany ingest i trwały zapis |
| Zabezpieczyć albo wyłączyć | T06, T12 | Odczyty GPS i billing; każdy aktywny endpoint musi respektować uprawnienia |
| Potrzebny zakres operacyjny | T17–T20, T23, T28, T33–T34, T48–T49, T57–T59 | Dobrać zakres do aktywnych usług; nie usuwać istniejących bramek |
| Gdy konkretny bloker | T29, T39 | Podatności runtime i kontrakt API potrzebnej ścieżki |
| Po pilotażu | T15, T25–T27, T30–T32, T35–T38, T40–T47, T50–T56 | Porządki, skalowanie i dokumentacja nieblokujące pilotażu |

Odstąpienie od całej transzy nie zwalnia z jej koniecznej zależności: np. naprawa T29 może wymagać części T27. Zakres i dowód zapisujemy w zadaniu.

T05/T16: osobny krótkotrwały token aud=telemetry wydawany po sprawdzeniu user/activity/tenant. Każdy włączony transport HTTP/WS musi być zabezpieczony; nieużywany WS można wyłączyć z testem odmowy. Przed pracą sprawdzić istniejącą gałąź fix/telemetry-required-jwt i otwarte PR-y, bez duplikowania.

T01: usunięcie sekretu z kodu nie zastępuje jego unieważnienia/rotacji. Wymagana akcja właściciela pozostaje jawna; nie wykonujemy rotacji automatycznie.

## Bramka przed testerami

- Jazda z wygaszonym ekranem na rzeczywistym Androidzie.
- Utrata sieci, zakończenie offline, powrót internetu i potwierdzona synchronizacja.
- Przerwanie procesu oraz odzyskanie danych zapisanych przed przerwaniem. Nie obiecujemy nagrywania podczas wymuszonego zatrzymania przez system/użytkownika.
- Wygaśnięcie tokenu, ponowienie tej samej paczki i brak duplikatów.
- Długotrwały offline i przepełnienie kolejki bez cichego usuwania niepotwierdzonych danych.
- Błąd zapisu/finalizacji nie daje fałszywego komunikatu sukcesu.
- Zmiana konta nie wysyła kolejki poprzedniego użytkownika jako nowego.
- Brak dostępu do drugiego tenanta; dwa tenanty także w testach jednego klubu.
- MFA i dozwolone operacje admina oraz GLOBAL_OWNER.
- Rzeczywista rola DB aplikacji bez SUPERUSER/BYPASSRLS; test RLS przez runtime, także w używanych workerach.
- Niepotrzebne endpointy wyłączone lub chronione; brak publicznego GPS.
- Backup i odtworzenie w izolacji, dowody RPO 24h / RTO 4h.
- Retencja GPS zgodna z ustalonymi 30 dniami; brak współrzędnych i sekretów w publicznych logach/raportach.
- Brak nierozwiązanych podatności runtime HIGH/CRITICAL według obowiązującej polityki.
- Wymagane CI zielone dla dokładnie wydawanej wersji, bez skipów udających walidację.

Nie obchodzimy istniejących wymagań pełnego PostGIS/Redis gate ani zależności wydania poprzez samo przemianowanie RC na pilotaż. Zmiana kontraktu bramki wymaga jawnej decyzji i dowodu równoważnego pokrycia.

## Następne zadanie: P1 — przygotowanie punktu odniesienia

1. Odczytać aktualny main, właściwe AGENTS.md, dokumenty home lab oraz stan istniejących PR-ów #44/#51/#57. Numery są wskazówkami historycznymi, nie dowodem bieżącego stanu.
2. Ustalić dostępne środowisko i komendy z manifestów/runbooków; nie zgadywać adresów, sekretów ani dostępu do komputera właściciela.
3. Sporządzić minimalną listę usług, transportów i endpointów potrzebnych dla jazdy oraz listę funkcji wyłączanych.
4. Na izolowanym home labie i syntetycznych danych sprawdzić bieżący build Android i ścieżkę P1. Nie wystawiać niezabezpieczonego serwisu publicznie.
5. Zwrócić raport: SHA, środowisko, kroki i wyniki PASS/FAIL/BLOCKED/NOT RUN, pierwszy odtworzony bloker, najmniejszy następny fix.
6. Jeżeli brak dostępu do home labu lub telefonu, zakończyć przygotowanie po stronie repo i wskazać konkretną potrzebną czynność właściciela; nie deklarować testu jako PASS.

## Zasady pracy i status

- P0: publikacja dokumentacji; P1–P5: PLANNED. Uruchomienie na telefonie: NOT RUN.
- Jedno zlecenie = jeden ograniczony cel; mały PR, test zachowania i review.
- Po dwóch nieskutecznych poprawkach tego samego problemu wracamy do dowodów, nie mnożymy spekulacyjnych zmian.
- Nie ruszamy niepowiązanych modułów, zależności ani chronionych lokalnych plików.
- Merge i wdrożenie wymagają zlecenia obejmującego tę czynność.
- Nie kontynuujemy mechanicznie według numerów T; zadania wybieramy według blokerów ścieżki pilotażu.

## P1 — przygotowanie po stronie repo (2026-09-14)

Status: analiza zależności wykonana; uruchomienie home labu i test telefonu BLOCKED — ENVIRONMENT REQUIRED. Dostępny connector GitHub nie daje sesji terminala na komputerze właściciela ani dostępu do telefonu. Nie wykonano builda, migracji ani połączeń z Railway.

### Potwierdzone zależności

| Element | Stan w chwili odczytu | Wniosek |
| --- | --- | --- |
| PR #84, plan | OPEN, Draft; SHA 37ab9f66f6d21bda620d5c98699cd93836361375, workflowy success, Aggregate CI gate success | Wynik dotyczy tego SHA; każda aktualizacja wymaga nowego CI |
| PR #51, home lab | OPEN; SHA b541d599b82e3ebe6de0514cf4486a7e1b10bec6 | Kontynuować istniejący PR i sprawdzić zgodność z main po T11; nie kopiować starej gałęzi w całości |
| PR #57, release gate | OPEN; SHA 9d726eb76f1f0798ca08639f1e25f80e9032d02f, oparty na #51 | Nie scalać przed przygotowaniem zależności |
| PR #44, Compose prod | OPEN; SHA 87962874f18ea9c9570b84eea6f48906147fb932 | Osobna poprawka ścieżki obrazu; nie dowodzi gotowości wdrożenia |
| mobile/eas.json | development, preview i production wskazują adresy Railway | Żaden obecny profil nie jest potwierdzonym profilem lokalnego pilotażu |

Odczyt drzewa main nie wykazał scripts/home_lab.py ani runbooka HOME_LAB.md — są dopiero w #51.
Źródła: [PR #51](https://github.com/karnalooch/stunning-pancake/pull/51), [PR #57](https://github.com/karnalooch/stunning-pancake/pull/57), [PR #44](https://github.com/karnalooch/stunning-pancake/pull/44), [profile mobile](../mobile/eas.json).

### Minimalny zestaw usług do sprawdzenia

Proponowany rdzeń z #51: db (PostGIS/TimescaleDB), redis, backend, telemetry, global_admin, celery_worker i celery_beat.
Profile routing, simulation, tracking i all-admin pozostają wyłączone, chyba że test krytycznej ścieżki wykaże konkretną zależność.
Przed uruchomieniem sprawdzić bind portów, brak publicznego wystawienia, lokalne sekrety oraz faktyczne role DB po T11.

Nie uruchamiać obecnych poleceń EAS development/preview jako testu lokalnego bez sprawdzenia efektywnych adresów API i telemetry.
Nie korzystać automatycznie z build:local:preview:android: zawiera expo prebuild --clean, co wymaga przeglądu istniejących plików natywnych.
Potrzebny jest natywny build Android z lokalnymi adresami, uprawnieniami GPS i działającym MMKV, a nie samo uruchomienie wersji web.

### Warunkowa procedura home lab

Dopiero po sprawdzeniu i przygotowaniu #51 na aktualnej bazie, na komputerze z Dockerem i w izolowanym checkoutcie:

1. Sprawdzić git status --short --branch, git rev-parse HEAD, docker version, docker compose version i python --version.
2. Potwierdzić co najmniej 16 GB RAM i 40 GB wolnego miejsca według runbooka #51.
3. Uruchomić python scripts/home_lab.py init tylko jeśli lokalny .env.home jeszcze nie istnieje. Nie wyświetlać zawartości pliku.
4. Uruchomić python scripts/home_lab.py config, następnie python scripts/home_lab.py up.
5. Uruchomić python scripts/home_lab.py status oraz python scripts/home_lab.py check; zapisać wyniki i kody wyjścia bez sekretów.
6. Dopiero po zielonym check i sprawdzeniu izolacji przygotować syntetyczne konta tenantów A/B, admina i GLOBAL_OWNER przez zatwierdzoną ścieżkę aplikacji.
7. Zweryfikować lokalne adresy w buildzie telefonu, następnie wykonać krótki zapis jazdy, synchronizację i odczyt w panelu. Rozszerzone scenariusze są w bramce powyżej.

Polecenia są odczytane ze skryptu w #51, nie przetestowane tutaj i nie są obecnie dostępne na main.
Nie uruchamiać down -v, wipe, seed produkcyjnego ani przywracania backupu nad istniejącą bazą.
Backup/restore zostaje osobną kontrolą po review procedury — samo sprawdzenie tabeli migracji nie jest dowodem odzyskania pełnych danych.

### Najbliższa potrzebna informacja

Ustalić dostępny komputer home lab oraz obecność działającego Dockera. Nie wymaga to podawania haseł ani tokenów.
Następne zadanie implementacyjne: kontynuacja #51 na bazie po T11 i bezpieczna konfiguracja lokalnego testu, z małym zakresem i rzeczywistą walidacją środowiskową.
