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
6. Ustaw trwałą wartość produkcyjną przed wdrożeniem zmiany. Backend z `DEBUG=0`
   odmawia startu bez jawnego, niepustego klucza lub z domyślnym kluczem developerskim,
   również na PaaS. Nie generuje zastępczego klucza przy starcie. Dawny mechanizm
   generowania klucza nie jest dopuszczalnym rollbackiem ani rozwiązaniem braku konfiguracji.
7. Dla telemetrii potwierdź rzeczywiste `TELEMETRY_INGEST_JWT_REQUIRED=1`,
   `TELEMETRY_INGEST_AUDIENCE_REQUIRED=1` oraz zgodność klucza wystawcy i weryfikatora.
   Brak wymaganej konfiguracji produkcyjnej/PaaS zatrzymuje usługę przed dostępem
   do bazy i uruchomieniem zadań. Zweryfikuj także kanoniczne `TELEMETRY_INGEST_QUEUE=0`.

## Po wdrożeniu

- Potwierdź healthchecki i krytyczną ścieżkę użytkownika oraz ponowny restart.
- Zapisz datę i wynik bez wartości kluczy. RISK-001 pozostaje otwarty do tej chwili.
- Nie przywracaj ujawnionego klucza w rollbacku ani nie wyłączaj wymuszenia autoryzacji.
- Ewentualne czyszczenie historii Git zaplanuj oddzielnie: wymaga koordynacji klonów
  i nie zastępuje unieważnienia klucza. Nie wykonuj automatycznego force push.

`python scripts/check_config_secrets.py` blokuje pola kluczy podpisujących
w śledzonych konfiguracjach Railway. Jest to wąska kontrola regresji; nie zastępuje
pełnego skanowania sekretów ani sprawdzenia środowiska produkcyjnego.

Testy zabezpieczeń startu i zielone CI nie zamykają dowodu operacyjnego T68 / #343.
Zachowaj odrębne, pozbawione sekretów potwierdzenie rzeczywistej konfiguracji
oraz wymaganej rotacji lub unieważnienia. Nie oznaczaj braku tego dowodu jako PASS.
