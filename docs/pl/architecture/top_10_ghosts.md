# Architektura Wyświetlania Posiadaczy Najwyższego Priorytetu (Top 10 Duchów)

Dokument ten opisuje proces priorytetyzacji kolarzy na mapie czasu rzeczywistego, tak aby dynamiczne zapytania nie zablokowały serwera bazy danych PostgreSQL/TimescaleDB przy wysokim natężeniu ruchu.

## 1. Strategia Zapytania (SQL / PostGIS)

Zastosowano pojedyncze, wydajne zapytanie SQL wykorzystujące konstrukcję `UNION ALL` oraz wagi ważności (priority scores). Baza zwraca dokładnie 10 rekordów w ramach jednej operacji.

### Logika Przydzielania Wag (Priorytety):
- **Waga 3 (Najwyższy priorytet):** Członkowie tego samego klubu sportowego (Grupetto).
- **Waga 2:** Globalni znajomi użytkownika.
- **Waga 1:** Pozostali użytkownicy w promieniu od 2 km do 5 km.

### Implementacja Pseudo-SQL
```sql
(
  -- Priorytet 1: Klubowicze
  SELECT user_id, geom, 3 as priority FROM live_positions 
  WHERE club_id = :my_club AND NOT is_in_privacy_zone
) UNION ALL (
  -- Priorytet 2: Znajomi
  SELECT user_id, geom, 2 as priority FROM live_positions 
  WHERE user_id IN (:my_friends_list) AND NOT is_in_privacy_zone
) UNION ALL (
  -- Priorytet 3: Lokalni kolarze (Zasięg 5km)
  SELECT user_id, geom, 1 as priority FROM live_positions 
  WHERE ST_DWithin(geom, :my_loc, 5000)
  AND NOT is_in_privacy_zone
)
ORDER BY priority DESC, ST_Distance(geom, :my_loc) ASC
LIMIT 10;
```

---

## 2. Implementacja Techniczna (FastAPI & Redis)

Aby nie przeciążać bazy PostgreSQL przy każdym ruchu mapy klienta:
1. **FastAPI:** Pobiera w trybie asynchronicznym listę kolarzy oznaczonych jako "Online" w pamięci podręcznej Redis.
2. **Redis Geo-Spatial:** Użycie komendy `GEORADIUS` (lub `GEOSEARCH` w klastrze) do wstępnego odfiltrowania odległości użytkowników.
3. **Filtracja Prywatności (v2):** Serwer sprawdza warunek `ST_Within` dla stref wykluczenia kolarzy przed wysłaniem ich do innych osób.

---

## 3. Optymalizacja UI (Legend-State)

Zgodnie z Mandatem 60 FPS:
- Tylko 10 priorytetowych obiektów JSON przekazywanych jest do warstwy graficznej MapLibre.
- **Kolorystyka markerów:** Dynamiczne rozróżnianie typów powiązań (np. obwódka Cyan `#00D1FF` dla klubu, Purple `#B066FF` dla obcych).
