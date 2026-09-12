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

## Git i ochrona pracy
- Zachowaj istniejące zmiany użytkownika. Nie resetuj, nie czyść, nie nadpisuj ani nie stashuj ich automatycznie.
- Brudne drzewo nie blokuje odczytów ani niezależnej pracy. Jeśli zmiany kolidują z zadaniem lub uniemożliwiają bezpieczną zmianę gałęzi, opisz konkretną kolizję.
- Dla nowego zadania implementacyjnego pracuj na osobnej gałęzi, jeśli zadanie nie wskazuje istniejącej. Nie przenoś zmian między gałęziami bez ustalenia ich pochodzenia.
- Commit, push i PR wykonuj, gdy obejmuje je zlecenie; nie proś ponownie o już udzieloną zgodę. Merge, wdrożenie, force-push i operacje destrukcyjne wymagają wyraźnego zlecenia obejmującego tę czynność.
- Dodawaj do stage konkretne pliki zadania. Przed commitem sprawdź staged diff i jego zgodność z zakresem.
- Nie ujawniaj sekretów, tokenów, prywatnych kluczy ani danych produkcyjnych w odpowiedzi lub logach.

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
