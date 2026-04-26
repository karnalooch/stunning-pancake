# 🚀 Plan Wdrożenia Produkcyjnego: SPORT na Railway.app

Witaj w fazie wdrożeniowej! Skoro mamy czas i chcesz się uczyć, przejdziemy przez proces **Professional Cloud Deployment**. Zamiast ręcznej konfiguracji, użyjemy podejścia **GitOps** — każda zmiana w kodzie będzie automatycznie aktualizować Twoją infrastrukturę.

## 🏗️ Filar 1: Optymalizacja Kontenerów (Docker)
Zanim wyślemy kod w chmurę, musimy przygotować nasze obrazy Docker tak, aby były gotowe na prawdziwy ruch (30+ osób).

### Kroki:
1.  **Przejście na Gunicorn (Backend)**: Zmienimy `runserver` (który jest tylko do deweloperki) na `gunicorn` (standard przemysłowy).
2.  **Multi-stage Builds**: Zoptymalizujemy rozmiar obrazów, aby szybciej się budowały i zużywały mniej zasobów na Railway (oszczędność kredytów!).
3.  **Healthchecks**: Dodamy do kontenerów instrukcje, które pozwolą Railway wiedzieć, czy serwis faktycznie "żyje".

## 🛤️ Filar 2: Infrastruktura jako Kod (railway.json)
Railway pozwala zdefiniować całe środowisko w jednym pliku JSON. Dzięki temu:
*   Jeśli kiedyś zechcesz postawić drugi taki sam system (np. dla innego miasta), zajmie Ci to sekundy.
*   Mamy pełną kontrolę nad zmiennymi środowiskowymi.

## 💾 Filar 3: Baza Danych i Migracje
Nauczysz się, jak bezpiecznie zarządzać danymi w chmurze:
1.  **Provisioning**: Automatyczne tworzenie bazy PostgreSQL z rozszerzeniem PostGIS (dla map).
2.  **Automatyczne Migracje**: Skonfigurujemy system tak, aby przy każdym wdrożeniu Django samo aktualizowało tabelki w bazie danych.

## 🔐 Filar 4: Bezpieczeństwo i Sekrety
Nigdy nie trzymamy haseł w kodzie!
*   Nauczysz się używać **Railway Shared Variables**.
*   Skonfigurujemy klucze Stripe i Sentry w bezpieczny sposób.

---

### 📅 Harmonogram na ten tydzień:

*   **Dzień 1 (Dzisiaj):** Audyt i optymalizacja Dockerfile'i. Przygotowanie `railway.json`.
*   **Dzień 2:** Pierwszy "Deployment testowy" — sprawdzamy, czy serwisy widzą się w chmurze.
*   **Dzień 3:** Konfiguracja bazy danych i pierwsze migracje "na żywo".
*   **Dzień 4:** Podpięcie domeny i certyfikatów SSL (HTTPS).
*   **Dzień 5:** Stres-testy (symulujemy ruch od Grupetta Siedlce).
*   **Dzień 6:** Optymalizacja kosztów i ustawienie powiadomień (Sentry).
*   **Dzień 7:** Oficjalny start testów terenowych!

---

> [!TIP]
> **Zadanie na teraz:** Przyjrzyj się plikowi `backend/Dockerfile`. Zmienimy w nim ostatnią linię z `runserver` na `gunicorn`. Czy wiesz, dlaczego `runserver` nie nadaje się na produkcję? (Podpowiedź: chodzi o wielowątkowość i bezpieczeństwo).

Czy akceptujesz taki plan i tempo pracy? Jeśli tak, zaczynamy od edycji Dockerfile'i!
