# ADR 0001: Wybór Frameworka Backendowego i Bazy Danych

## Status
Zaakceptowany

## Kontekst
Platforma „SPORT” wymaga solidnego, skalowalnego backendu zdolnego do obsługi:
1.  Złożonej logiki biznesowej i ról użytkowników (B2B/B2C).
2.  Zaawansowanych danych geoprzestrzennych (ślady GPS, geofencing).
3.  Wydajnej integracji telemetrii w czasie rzeczywistym.
4.  Szybkiego rozwoju dzięki wbudowanym narzędziom administracyjnym.

## Decyzja
Wybraliśmy **Django (Python)** jako główny framework webowy oraz **PostgreSQL z PostGIS** jako główną bazę danych.

### Uzasadnienie
- **Django**: Zapewnia gotowy panel administracyjny, solidny ORM i zaawansowane zarządzanie rolami użytkowników. Jego dojrzałość i filozofia „batteries-included” skracają czas wprowadzenia produktu na rynek (time-to-market).
- **PostGIS**: Branżowy standard dla danych geoprzestrzennych. Pozwala na złożone zapytania przestrzenne (np. „czy punkt znajduje się w strefie prywatności?”) bezpośrednio w SQL z wysoką wydajnością.
- **Django REST Framework (DRF)**: Umożliwia szybkie tworzenie przejrzystych, udokumentowanych API RESTful.
- **Ekosystem Pythona**: Doskonałe wsparcie dla przetwarzania danych, AI/ML (z myślą o przyszłości) oraz integracji z zewnętrznymi narzędziami telemetrycznymi, takimi jak Traccar.

## Konsekwencje
- **Plusy**: Szybki rozwój paneli administratora/moderatora. Solidna obsługa danych GPS poprzez PostGIS. Silne domyślne ustawienia bezpieczeństwa.
- **Minusy**: Nieco większe zużycie pamięci w porównaniu do minimalnych frameworków, takich jak FastAPI (niwelowane przez konteneryzację). Domyślnie synchroniczna natura (obsługiwana przez Celery/Redis dla ciężkich zadań).

## Rozważane Alternatywy
- **FastAPI**: Rozważany pod kątem wysokowydajnej telemetrii, ale odrzucony dla głównej aplikacji ze względu na brak wbudowanego panelu administracyjnego i mniej dojrzały ekosystem dla złożonego zarządzania rolami B2B. (Może zostać wykorzystany jako mikrousługa w przyszłości, jeśli zajdzie taka potrzeba).
- **Node.js (NestJS)**: Silna alternatywa, ale Python został preferowany ze względu na lepsze biblioteki geoprzestrzenne i do nauki o danych (GeoPandas, Shapely).
