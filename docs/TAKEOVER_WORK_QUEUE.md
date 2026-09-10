# Kolejka technicznego przejęcia

Stan z 2026-09-10. Raporty rozpoznania są na main (PR 37–39).
Wykonawca prowadzi analizę, implementację, testy i PR bez ręcznego przekazywania
promptów między narzędziami. Status ukończenia wymaga dowodu, nie deklaracji.

| Kolejność | Zakres | Kryterium zakończenia |
|---|---|---|
| 1 | RISK-001: klucz w konfiguracji | Wpis usunięty, kontrola regresji zielona; osobno potwierdzona rotacja środowiskowa |
| 2 | Punkt wejścia dokumentacji | README i indeks prowadzą do startu, architektury, jakości i operacji; linki/i18n zielone |
| 3 | Odtwarzalne środowisko | Frozen install i testy porównane z CI; oddzielone braki narzędzi od błędów kodu |
| 4 | Telemetry, MFA i tenant isolation | Prześledzone aktywne endpointy, testy odmowy dostępu; brak wniosków wyłącznie z komentarzy |
| 5 | Architektura i instrukcje startu | Wersje i komendy zgodne z manifestami; usunięte duplikaty metadanych, zachowane linki |
| 6 | Duże moduły | Jedna odpowiedzialność na ekstrakcję; testy zachowania przed i po |
| 7 | Archiwizacja dokumentacji | Udowodnione zastąpienie materiału i naprawione linki; żadnego kasowania na podstawie wieku |
| 8 | Backup i RC | Odtworzenie w izolacji, krytyczna ścieżka E2E, zakres wydania i rollback |

## Granice operacyjne

Bezpieczne poprawki mogą być wykonywane na osobnych gałęziach i publikowane jako PR.
Scalenie uruchamiające produkcyjne wdrożenie wymaga gotowego planu i sprawdzenia
wpływu. Nie oznaczaj rotacji, backupu ani testów produkcyjnych jako wykonanych
na podstawie zielonych kontroli dokumentacji.

## Ograniczenia dotychczasowych raportów

- Brak RLS na tabeli nie dowodzi wycieku: sprawdź również ORM i uprawnienia API.
- Brak skryptu backupu nie dowodzi braku backupów dostawcy.
- CORS nie zastępuje autoryzacji, a liczba testów nie dowodzi pełnego pokrycia.
- Hoisted node_modules nie musi oznaczać niepełnej instalacji.
- Istnienie testu lub kroku CI nie oznacza, że ten test wykonał się i przeszedł.
