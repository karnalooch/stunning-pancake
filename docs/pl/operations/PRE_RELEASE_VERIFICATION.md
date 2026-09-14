# Weryfikacja przed wydaniem

| | |
|--|--|
| **Status** | Aktywny |
| **Rola właściciela** | Właściciel wydania |
| **Ostatni przegląd** | 2026-09-10 |
| **lang** | pl |
| **translation** | [English](../../en/operations/PRE_RELEASE_VERIFICATION.md) |
| **canonical_path** | docs/pl/operations/PRE_RELEASE_VERIFICATION.md |

To jest zapis decyzji o wydaniu w obecnej fazie, opartej na domowym labie. Railway i
Kubernetes są wariantami wdrożenia, a nie dowodem gotowości aplikacji.

## Tożsamość kandydata

Zapisz SHA commita, tagi obrazów, zakres migracji bazy, operatora, datę testu i nazwę
backupu. Nie wydawaj z brudnego drzewa roboczego ani ze zmiennego tagu obrazu.

## Wymagane bramki

1. Uruchom z katalogu repo `python scripts/release/pre_release_check.py`.
2. Wszystkie blokujące kontrole dla dokładnego SHA kandydata muszą przejść. Kontrola
   pominięta, anulowana lub nieblokujący audyt bezpieczeństwa nie oznacza PASS.
3. W domowym labie wykonaj `python scripts/home_lab.py up`, a potem
   `python scripts/home_lab.py check`.
4. Sprawdź kolejno: logowanie, utworzenie użytkownika tenanta, zapis aktywności,
   ingest GPS z ważnym JWT, obsługę zadania Celery i wynik w panelu admina.
5. Wykonaj `python scripts/home_lab.py backup`, a plik sprawdź przez
   `python scripts/home_lab.py verify-restore <plik>`.
6. Przejrzyj migracje przez `python manage.py showmigrations --plan` oraz
   `python manage.py makemigrations --check --dry-run`. Przed produkcją uruchom je
   wyłącznie w labie.
7. Zapisz decyzję GO/NO-GO. Brak dowodu odtworzenia, czerwone E2E, nieznany klucz
   podpisujący albo nieprzejrzane migracje destrukcyjne oznaczają NO-GO.

## Kontrakt rollbacku

Przed wdrożeniem zapisz poprzednie niezmienne tagi obrazów i backup bazy. Rollback
aplikacji polega na wdrożeniu tych tagów. Rollback bazy zaczyna się od odtworzenia
zweryfikowanego backupu do osobnej bazy, sprawdzenia jej i dopiero przełączenia
aplikacji w oknie serwisowym. Nie cofaj destrukcyjnej migracji bez jej osobnej,
przetestowanej operacji odwrotnej.

Po rollbacku sprawdź zdrowie backendu i telemetrii, logowanie, odczyt znanej
aktywności, jedno bezpieczne zadanie Celery i widoczność w adminie. Zapisz czas,
operatora i wynik.

## Późniejsze przeniesienie tego samego kandydata na Railway

Promuj przetestowane, niezmienne obrazy. Ustaw sekrety Railway poza repo, obróć każdy
klucz wcześniej zapisany w Git, podłącz trwały Postgres/Redis, wykonaj ten sam plan
migracji i smoke test oraz osobno potwierdź backup dostawcy. Nie seeduj danych demo.
Gotowość Railway pozostaje zablokowana do czasu sprawdzenia klucza podpisującego,
backupu, healthchecków i uprawnień do rollbacku na tym koncie.
