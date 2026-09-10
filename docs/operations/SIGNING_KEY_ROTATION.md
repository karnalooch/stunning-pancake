# Klucz podpisujący — procedura operacyjna

Status: wymaga weryfikacji przez operatora środowiska. Usunięcie wpisu z Git
nie wykonuje rotacji i nie usuwa jego historycznych kopii.

## Przed scaleniem konfiguracji

1. W panelu usług ustal, czy backend i konsumenci JWT otrzymują trwały `SECRET_KEY`
   z magazynu zmiennych środowiskowych. Nie publikuj wartości w raportach ani logach.
2. Potwierdź sposób przekazywania zmiennych do wdrożenia. Samo pole `variables`
   w `railway.json` nie dowodzi, że platforma je stosuje.
3. Jeśli ujawniona wartość była używana, przygotuj nowy losowy klucz w magazynie
   sekretów oraz skoordynowane wdrożenie wszystkich usług weryfikujących podpisy.
4. Sprawdź użycie klucza do szyfrowania danych, podpisów i JWT przed wymianą.
   Nie zakładaj, że dotyczy wyłącznie sesji. Uwzględnij ponowne logowanie użytkowników.
5. Zweryfikuj operację na staging: logowanie, odświeżanie tokenu, ingest telemetry,
   restart usług i odrzucanie tokenów podpisanych wycofanym kluczem.
6. Ustaw nową wartość produkcyjną przed wdrożeniem zmiany. Nie zostawiaj usługi
   z pustym kluczem: obecny backend na PaaS może wygenerować klucz przy starcie,
   co nie zapewnia trwałości podpisów między restartami i replikami.

## Po wdrożeniu

- Potwierdź healthchecki i krytyczną ścieżkę użytkownika oraz ponowny restart.
- Zapisz datę i wynik bez wartości kluczy. RISK-001 pozostaje otwarty do tej chwili.
- Nie przywracaj ujawnionego klucza w rollbacku.
- Ewentualne czyszczenie historii Git zaplanuj oddzielnie: wymaga koordynacji klonów
  i nie zastępuje unieważnienia klucza. Nie wykonuj automatycznego force push.

`python scripts/check_config_secrets.py` blokuje pola kluczy podpisujących
w śledzonych konfiguracjach Railway. Jest to wąska kontrola regresji; nie zastępuje
pełnego skanowania sekretów ani sprawdzenia środowiska produkcyjnego.
