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

- P0: ACTIVE do chwili merge PR #84; P1: PLANNED (home lab gotowy, telefon NOT RUN); P2–P5: PLANNED. Uruchomienie na telefonie: NOT RUN.
- Jedno zlecenie = jeden ograniczony cel; mały PR, test zachowania i review.
- Po dwóch nieskutecznych poprawkach tego samego problemu wracamy do dowodów, nie mnożymy spekulacyjnych zmian.
- Nie ruszamy niepowiązanych modułów, zależności ani chronionych lokalnych plików.
- Merge i wdrożenie wymagają zlecenia obejmującego tę czynność.
- Nie kontynuujemy mechanicznie według numerów T; zadania wybieramy według blokerów ścieżki pilotażu.

## P1 — przygotowanie po stronie repo (2026-09-14)

Status: home lab jest dostępny na main po scaleniu PR #51 (squash `1c7e7840a580208affb7d74a0432d4dbe704a82e`); uruchomienie telefonu i pełna ścieżka użytkownika pozostają NOT RUN — ENVIRONMENT REQUIRED. Dostępny connector GitHub nie daje sesji terminala na komputerze właściciela ani dostępu do telefonu. Nie wykonano builda Androida, migracji ani połączeń z Railway. W ramach tej transzy home lab nie był ponownie uruchamiany.

### Chronologia wcześniejszej walidacji home labu (PR #51, przed merge)

- Pełną walidację runtime home labu wykonano na końcowym HEAD PR #51 (przed jego scaleniem do main), w izolowanym środowisku:
  - Docker Desktop 4.91.0; Engine 29.8.0; Compose v5.5.1 — zweryfikowane poleceniami `docker version`, `docker compose version`.
  - Siedem usług rdzenia (`db`, `redis`, `backend`, `telemetry`, `global_admin`, `celery_worker`, `celery_beat`) uruchomionych i raportowanych jako `Healthy` przez `python scripts/home_lab.py status` oraz `python scripts/home_lab.py check`.
  - `backend` `http://127.0.0.1:8000/health/` → HTTP 200.
  - `telemetry` `http://127.0.0.1:8001/api/telemetry/health` → HTTP 200.
  - Backup utworzony poleceniem home labu.
  - `verify-restore` wykonany w izolowanej bazie; główna baza pozostała sprawna (brak wpływu na `4velo-home_pgdata`).
  - Home lab został zatrzymany poleceniem `down` (bez `-v`); wolumen `4velo-home_pgdata` nie został usunięty.
- Dodatkowa walidacja LF entrypointu wykonana na końcowym HEAD PR #51 w świeżym worktree i zbudowanym z niego obrazie (przed merge):
  - w świeżym worktree potwierdzono binarnie: `CRLF=0` dla `backend/docker-entrypoint.sh`;
  - obraz backendu zbudowano z tego świeżego worktree;
  - zawartość `/app/docker-entrypoint.sh` sprawdzono w obrazie przez `docker run --rm`;
  - potwierdzono brak znaku CR oraz prawidłowy shebang `#!/bin/sh`.
- Dokładnie ten zweryfikowany stan został następnie scalony do main jako squash: `1c7e7840a580208affb7d74a0432d4dbe704a82e`.
- Home lab jest obecnie dostępny na main, ale w ramach PR #84 nie był ponownie uruchamiany.

Powyższe potwierdza techniczną możliwość uruchomienia i odtworzenia środowiska oraz obecność `django_migrations` w odtworzonej bazie. Dotychczasowy `verify-restore` nie jest jeszcze pełnym testem integralności wszystkich danych biznesowych ani dowodem spełnienia RPO 24h / RTO 4h — to zostaje odrębną kontrolą po merge PR #84.

### Potwierdzone zależności

| Element | Stan w chwili odczytu | Wniosek |
| --- | --- | --- |
| PR #84, plan | OPEN, Draft; SHA początkowy 96bf6b096fbf26cfc5bab30621079ea55e81d143 (sprzed synchronizacji z main); workflowy success, Aggregate CI gate success | Wynik dotyczy tego SHA; każda aktualizacja wymaga nowego CI |
| PR #51, home lab | MERGED, squash `1c7e7840a580208affb7d74a0432d4dbe704a82e` (2026-09-14) | Home lab, runbooki i `scripts/home_lab.py` są już na main; numer PR pozostaje historyczną wskazówką |
| PR #55, simulator guard | MERGED, squash `dc3e20e8a48b594a469b28c1a3e80ebceb527d82` | Zamknięty; nie wymaga kontynuacji |
| PR #57, release gate | OPEN; SHA historyczny, oparty na #51 | Nadal wymaga osobnej oceny po włączeniu #51 do main |
| PR #44, Compose prod | OPEN; SHA historyczny | Osobna poprawka ścieżki obrazu; nie dowodzi gotowości wdrożenia |
| mobile/eas.json | development, preview i production wskazują adresy Railway | Żaden obecny profil nie jest potwierdzonym profilem lokalnego pilotażu |

Home lab (`scripts/home_lab.py`, `docs/{en,pl}/operations/HOME_LAB.md`, `.env.home.example`, `.github/workflows/home-lab.yml`) jest dostępny na aktualnym main po merge PR #51. Numery PR-ów w tabeli są historycznymi odnośnikami, nie gwarancją bieżącego stanu — faktyczny stan potwierdza `git rev-parse origin/main` i polecenia repo, nie nagłówki tabeli.
Źródła: [PR #51](https://github.com/karnalooch/stunning-pancake/pull/51), [PR #57](https://github.com/karnalooch/stunning-pancake/pull/57), [PR #44](https://github.com/karnalooch/stunning-pancake/pull/44), [profile mobile](../mobile/eas.json).

### Minimalny zestaw usług do sprawdzenia

Proponowany rdzeń z #51: db (PostGIS/TimescaleDB), redis, backend, telemetry, global_admin, celery_worker i celery_beat.
Profile routing, simulation, tracking i all-admin pozostają wyłączone, chyba że test krytycznej ścieżki wykaże konkretną zależność.
Przed uruchomieniem sprawdzić bind portów, brak publicznego wystawienia, lokalne sekrety oraz faktyczne role DB po T11.

Nie uruchamiać obecnych poleceń EAS development/preview jako testu lokalnego bez sprawdzenia efektywnych adresów API i telemetry.
Nie korzystać automatycznie z build:local:preview:android: zawiera expo prebuild --clean, co wymaga przeglądu istniejących plików natywnych.
Potrzebny jest natywny build Android z lokalnymi adresami, uprawnieniami GPS i działającym MMKV, a nie samo uruchomienie wersji web.

### Warunkowa procedura home lab

PR #51 jest już scalony, więc poniższe kroki są dostępne na aktualnym main. Nie uruchamiać ich ponownie w ramach tej transzy; kolejne użycie wykonywać tylko na komputerze z Dockerem i w izolowanym checkoutcie:

1. Sprawdzić git status --short --branch, git rev-parse HEAD, docker version, docker compose version i python --version.
2. Potwierdzić co najmniej 16 GB RAM i 40 GB wolnego miejsca według runbooka HOME_LAB.md.
3. Uruchomić python scripts/home_lab.py init tylko jeśli lokalny .env.home jeszcze nie istnieje. Nie wyświetlać zawartości pliku; nie dodawać .env.home do Git.
4. Uruchomić python scripts/home_lab.py config, następnie python scripts/home_lab.py up.
5. Uruchomić python scripts/home_lab.py status oraz python scripts/home_lab.py check; zapisać wyniki i kody wyjścia bez sekretów.
6. Dopiero po zielonym check i sprawdzeniu izolacji przygotować syntetyczne konta tenantów A/B, admina i GLOBAL_OWNER przez zatwierdzoną ścieżkę aplikacji.
7. Zweryfikować lokalne adresy w buildzie telefonu, następnie wykonać krótki zapis jazdy, synchronizację i odczyt w panelu. Rozszerzone scenariusze są w bramce powyżej.

Powyższe kroki zostały już przetestowane w izolacji po merge PR #51 (wyniki w sekcji „Potwierdzona walidacja home labu" powyżej). Nie uruchamiać down -v, wipe, seed produkcyjnego ani przywracania backupu nad istniejącą bazą.
Backup/restore zostaje osobną kontrolą po review procedury — dotychczasowy verify-restore potwierdza techniczną możliwość odtworzenia i obecność django_migrations, ale nie jest jeszcze pełnym testem integralności wszystkich danych biznesowych ani dowodem RPO/RTO.

### Najbliższa potrzebna informacja / następne zadanie

Docker oraz komputer home lab zostały potwierdzone w izolowanej walidacji po merge PR #51.

Następne zadanie po merge PR #84 ma być ograniczonym przygotowaniem P1 dla Androida:

- zinwentaryzować aktualne profile EAS/Expo (`mobile/eas.json`, `mobile/app.config.js`) i efektywne adresy backendu oraz telemetry, w tym to, który profil wskazuje na Railway, a który mógłby wskazywać lokalny home lab;
- ustalić najmniejszy bezpieczny wariant połączenia prawdziwego telefonu z lokalnym home labem (adresy LAN, certyfikaty, wyłącznie sieć właściciela);
- sprawdzić wymagania sieci LAN, firewall, cleartext HTTP, uprawnienia GPS oraz trwałego zapisu (MMKV) w bieżącej konfiguracji natywnej;
- nie wystawiać niezabezpieczonego serwisu publicznie i nie wykonywać jeszcze builda ani zmian kodu w ramach PR #84;
- wynikiem następnego zadania ma być plan i pierwszy mały, testowalny zakres implementacyjny, a nie gotowy build.
