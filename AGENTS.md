# 4VELO — zasady pracy agentów

## Cel i współpraca
- Realizuj jedno konkretne zadanie w repozytorium 4VELO. Preferuj małe, sprawdzalne zmiany.
- Użytkownik ustala cel; ChatGPT przygotowuje plan i ocenia raport; Kilo wykonuje zadanie.
- Jeśli otrzymujesz gotowy plan, sprawdź jego założenia w aktualnym kodzie i wykonaj go. Nie twórz konkurencyjnego planu ani dodatkowych transz.
- Polecenie Plan/Review oznacza analizę bez edycji, chyba że użytkownik wyraźnie zleci inaczej. Polecenie wykonania upoważnia do potrzebnych lokalnych zmian i testów; nie pytaj ponownie o każdy krok.
- Bieżące instrukcje użytkownika i ograniczenia narzędzi mają pierwszeństwo. Nie obchodź kontroli dostępu ani blokad narzędzi.
- Odpowiadaj po polsku, zwięźle. Nazwy kodu i styl commitów dostosuj do repo.

## Start i zakres
- Sprawdź katalog repo, bieżącą gałąź, HEAD oraz `git status --short --branch`.
- Ustal pliki i kryteria ukończenia na podstawie zadania. Przed edycją przeczytaj właściwy kod, najbliższe testy i mające zastosowanie instrukcje podkatalogów.
- Dokumenty mapy repo i planu porządków są pomocą nawigacyjną, jeśli istnieją. Czytaj tylko potrzebne fragmenty; aktualny kod i konfiguracja rozstrzygają fakty.
- Nie traktuj lokalnego `origin/main` jako dowodu aktualnego stanu serwera. Gdy aktualność bazy ma znaczenie, odśwież ją; przy blokadzie jawnie podaj ograniczenie.
- Nie naprawiaj przy okazji niezwiązanych problemów. Wymień je krótko w raporcie.

## Kontekst i koszt
- Szukaj najpierw przez `rg --files` i ograniczone `rg`; przy braku narzędzia użyj lokalnego odpowiednika.
- Zawężaj wyszukiwanie do komponentu. Nie czytaj całego monorepo, całej dokumentacji ani pełnej historii Git bez potrzeby.
- Pomijaj zależności, buildy, cache, wygenerowane pliki i duże logi w ogólnych wyszukiwaniach. Otwieraj je celowo, gdy są potrzebnym dowodem.
- Czytaj potrzebne fragmenty z kontekstem; nie odczytuj ponownie niezmienionych plików bez konkretnego powodu.
- Grupuj niezależne odczyty. Zależne operacje i modyfikacje wykonuj sekwencyjnie.
- Zachowuj pełne logi lokalnie, a w rozmowie pokazuj wynik, kod wyjścia i istotny fragment błędu. Nie ukrywaj błędu przez filtrowanie wyjścia.
- Nie deleguj, nie uruchamiaj innych agentów ani płatnych usług bez zlecenia. Nie zmieniaj sam modelu, providera ani ustawień rozliczeń.
- Po dwóch kolejnych nieskutecznych poprawkach tego samego problemu przerwij zgadywanie. Przedstaw przyczynę lub brakujące dane, zmienione pliki i proponowany następny krok.
- Po spełnieniu kryteriów i wymaganych kontroli zakończ. Nie uruchamiaj kolejnego audytu dla samego potwierdzenia.

## Issue → Project → dostarczenie
- Każde nowe zadanie, które ma zmienić repozytorium, zaczynaj od jednego głównego GitHub Issue, chyba że użytkownik wskazał już właściwe Issue lub istniejący PR. Nie twórz Issue dla samej analizy, planowania, odczytu lub odpowiedzi bez zmian w repo.
- Issue jest kanonicznym elementem planowania. Zapisz w nim co najmniej: cel, zakres i non-scope, kryteria ukończenia, wymagane kontrole oraz odniesienie do właściwej transzy/takeover planu, jeśli zadanie do niej należy.
- Upewnij się, że Issue jest widoczne w GitHub Project `4VELO — Product & Takeover`. Auto-add jest mechanizmem pomocniczym, nie dowodem wykonania; gdy narzędzia pozwalają, zweryfikuj obecność i ustaw właściwe pola Project, w szczególności `Status`, `Priority`, `Area`, `Phase`, `Work type` i `Effort` tam, gdzie mają zastosowanie.
- Praca należąca do konkretnego wydania musi mieć przypisany właściwy Milestone przed rozpoczęciem implementacji. Dla zadania naprawdę release-neutral (np. czyste governance/docs) brak Milestone musi być świadomy i jawnie opisany w Issue lub raporcie.
- Dopiero po ustaleniu Issue/Project/Milestone utwórz osobną gałąź z aktualnego `main`, chyba że zadanie jawnie wskazuje istniejącą gałąź.
- Po pierwszym spójnym commicie utwórz Draft PR możliwie wcześnie. PR ma wskazywać główne Issue przez `Closes #<issue>` (lub równoważny wspierany keyword), opisywać zakres i walidację oraz zawierać wymagane dla danej transzy deklaracje/kontrakty.
- Issue pozostaje kanonicznym trackingiem pracy, a PR jest artefaktem wykonawczym. Podczas implementacji ustaw odpowiednie elementy Project na `In progress`; po oznaczeniu PR jako Ready for review ustaw PR na `In review`, a Issue pozostaw jako aktywne do czasu merge.
- Merge ręczny nadal wymaga wyraźnego polecenia użytkownika. Wyjątkiem jest bezpieczny auto-merge opisany w sekcji `Automatyczne mergowanie`; standardem pozostaje squash merge, jeśli repo lub konkretne zadanie nie wymagają innej metody.
- Po merge zweryfikuj: PR jest merged, `Closes #...` zamknęło Issue, automatyzacje Project ustawiły zakończone elementy na `Done`, a `main` wskazuje oczekiwany commit. Nie zakładaj, że automatyzacja zadziałała bez odczytanego potwierdzenia.
- Jeśli agent nie ma uprawnień do Projects/Milestones lub dostępne narzędzia nie pozwalają wykonać/zweryfikować kroku, nie obchodź tego innym mechanizmem i nie udawaj sukcesu. Wykonaj bezpieczną część procesu, a brakujący krok oznacz jako `BLOCKED` lub `MANUAL ACTION REQUIRED`.
- Nie twórz dodatkowych Issue/PR tylko po to, by zadowolić proces. Jedna spójna transza powinna mieć jeden główny Issue i jeden odpowiadający mu PR, o ile zakres nie wymaga jawnego podziału.

## Git i ochrona pracy
- Zachowaj istniejące zmiany użytkownika. Nie resetuj, nie czyść, nie nadpisuj ani nie stashuj ich automatycznie.
- Brudne drzewo nie blokuje odczytów ani niezależnej pracy. Jeśli zmiany kolidują z zadaniem lub uniemożliwiają bezpieczną zmianę gałęzi, opisz konkretną kolizję.
- Dla nowego zadania implementacyjnego pracuj na osobnej gałęzi, jeśli zadanie nie wskazuje istniejącej. Nie przenoś zmian między gałęziami bez ustalenia ich pochodzenia.
- Commit, push i PR wykonuj, gdy obejmuje je zlecenie; nie proś ponownie o już udzieloną zgodę. Wdrożenie, force-push i operacje destrukcyjne wymagają wyraźnego zlecenia obejmującego tę czynność. Merge może być automatyczny wyłącznie dla niskiego ryzyka zgodnie z sekcją `Automatyczne mergowanie`; pozostałe PR-y wymagają wyraźnego polecenia merge.
- Widoczność pracy w GitHub Project i statusy Issue/PR prowadź zgodnie z sekcją `Issue → Project → dostarczenie`; nie duplikuj alternatywnego workflow w zadaniu.
- Dodawaj do stage konkretne pliki zadania. Przed commitem sprawdź staged diff i jego zgodność z zakresem.
- Nie ujawniaj sekretów, tokenów, prywatnych kluczy ani danych produkcyjnych w odpowiedzi lub logach.

## Automatyczne mergowanie
- Domyślnie traktuj merge jako `manual`. Agent może oznaczyć PR dokładną linią `Auto-merge: eligible` tylko po sprawdzeniu pełnej listy zmienionych plików i wyłącznie dla rutynowej zmiany niskiego ryzyka.
- Nie oznaczaj jako eligible zmian obejmujących workflowy/actions, skrypty automatyzacji repo, `AGENTS.md`, CI/merge policy, deployment/Kubernetes/Docker/infra, sekrety, auth/OAuth/security, migracje baz danych, dependency manifests/lockfiles/requirements ani materiał kluczy/certyfikatów. Przy niepewności użyj `Auto-merge: manual`.
- Sam marker nie upoważnia do merge. Repozytoryjna automatyzacja musi niezależnie potwierdzić: PR z tego samego repo i od właściciela, target `main`, non-draft, brak ryzykownych ścieżek, `Aggregate CI gate = success`, `Kilo Code Review = success`, brak aktywnego `CHANGES_REQUESTED`, brak nierozwiązanych review threads i mergeability względem aktualnego `main`.
- Jeśli bezpieczny PR jest tylko behind względem `main`, automatyzacja może wykonać zwykłe GitHub update-branch i musi poczekać na świeże kontrole. Nie używaj force-push do przygotowania auto-merge.
- Automatyczny merge zawsze jest squash. Branch protection pozostaje nadrzędną bramką; nie twórz obejść ani tokenów z prawem bypassu.
- Zmiany polityki auto-merge oraz samej implementacji automatyzacji zawsze są `Auto-merge: manual` i wymagają jawnego polecenia użytkownika do merge.
- Po auto-merge nadal zweryfikuj wynik: PR merged, powiązane Issue zamknięte, Project `Done` i oczekiwany HEAD `main`.

## Implementacja w monorepo
- Korzystaj z istniejących wzorców i zależności. Nie dodawaj bibliotek ani abstrakcji bez potrzeby wynikającej z zadania.
- Ustal komponent i komendy z jego manifestów, konfiguracji testów i CI. Nie zgaduj ścieżek, wersji runtime ani poleceń.
- Dla JS/TS respektuj `packageManager` i lockfile. Nie zastępuj pnpm przez npm/yarn i nie aktualizuj zależności przy okazji.
- Dla Pythona używaj środowiska i menedżera zależności określonych przez repo. Nie instaluj pakietów globalnie jako obejścia.
- Uwzględniaj kontrakty między backendem, telemetry, adminem, mobile i współdzielonymi paczkami, gdy zmiana ich dotyczy.
- Zmiany API sprawdzaj z konsumentami i istniejącym generowaniem schematów/klienta. Wygenerowane pliki odtwarzaj właściwym generatorem.
- Przy zmianach autoryzacji i danych sprawdź granice uprawnień, izolację danych oraz migracje. Nie uruchamiaj migracji na produkcji w ramach lokalnej walidacji.
- Przy zmianach CI/Docker sprawdź odpowiednie wyzwalacze, filtry ścieżek, zależności jobów, warunki agregacji i kontekst builda. Nie osłabiaj bramek, aby uzyskać zielony wynik.

## Walidacja i dowody
- Uruchom najmniejszy zestaw kontroli, który wiarygodnie pokrywa zmianę, oraz wszystkie bramki wymagane przez zadanie lub repo.
- Dla zmiany zachowania dodaj lub popraw test sprawdzający rezultat i istotną regresję. Nie dodawaj testów powielających kod wyłącznie dla liczby testów.
- Sama dokumentacja wymaga kontroli diffu oraz właściwej kontroli dokumentacji, jeśli jest dostępna; nie wymaga automatycznie pełnego builda.
- Rozszerz testowanie, gdy zmiana przecina komponenty albo wynik wskazuje konkretną pozostałą niepewność.
- Sprawdź końcowy diff i `git diff --check`. Upewnij się, że testowany stan odpowiada końcowym zmianom; po kolejnej edycji powtórz kontrole, których wynik mogła zmienić.
- Podawaj prawdziwe komendy i kody wyjścia. Rozróżniaj PASS, FAIL, BLOCKED i NOT RUN. Brak środowiska, pominięty test lub stary log nie oznacza PASS.
- Nie deklaruj zielonego CI, pushu ani merge bez odczytanego potwierdzenia. Wynik lokalny nie jest wynikiem zdalnego CI.

## Przekazywanie pracy do nowego zadania
- Jedno zadanie Kilo obejmuje jedną spójną transzę.
- Po ukończeniu transzy przedstaw raport i zakończ zadanie. Nie rozpoczynaj automatycznie kolejnej transzy; poczekaj na ocenę raportu i zlecenie dalszej pracy.
- Jeśli dalsza praca wymaga nowego celu albo kontekst stał się przeładowany, przygotuj krótkie przekazanie zawierające: cel, gałąź i HEAD, stan lokalnych zmian, wykonane kontrole, blokady oraz dokładny następny krok.
- Jeśli masz dostępne narzędzie tworzenia nowego zadania i jego użycie obejmuje zlecenie użytkownika, użyj go i przekaż ten kontekst. W przeciwnym razie podaj gotowy prompt do nowego zadania.
- Nie deklaruj utworzenia nowego zadania bez potwierdzenia narzędzia.
- Nie twórz podzadań ani dodatkowych agentów wyłącznie w celu skrócenia historii rozmowy.
- Przekazanie nie zastępuje sprawdzenia aktualnego stanu repo w nowym zadaniu. Zachowaj informacje o niezacommitowanych zmianach i ich pochodzeniu.

## Raport końcowy
Jeśli zadanie wymaga własnego formatu, zastosuj go. W pozostałych przypadkach:
1. Wynik: co ukończono i czy spełniono kryteria.
2. Zmiany: pliki i krótki opis zachowania.
3. Walidacja: komendy, wyniki, kody wyjścia; osobno kontrole niewykonane.
4. Git: gałąź, HEAD, stan drzewa; SHA commita i URL PR tylko jeśli powstały.
5. Pozostałe ryzyka lub blokada, jeśli występują.

Zwykle wystarcza 15–30 linii. Nie wklejaj całych logów ani ponownie całego planu.
