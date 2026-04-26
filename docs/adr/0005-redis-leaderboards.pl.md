# ADR-0005: Redis Sorted Sets dla rankingów w czasie rzeczywistym

**Status**: Zaakceptowany  
**Data**: 2026-04-24  
**Autor**: akarn  

---

## Kontekst

SPORT wymaga rankingów (leaderboards) w czasie rzeczywistym na wielu poziomach:
- **Ranking miejski** — wszyscy sportowcy w mieście, uszeregowani według całkowitego zweryfikowanego dystansu (km).
- **Ranking wydarzenia** — uczestnicy aktywnego wydarzenia, aktualizowany po każdej aktywności.
- **Ranking klubu** — członkowie uszeregowani według wkładu w wyzwania klubowe.

Naiwna implementacja wykorzystuje `SELECT ... ORDER BY score DESC LIMIT 10` na tabeli `Participation`. Przy ponad 10 000 współbieżnych użytkowników i 3-sekundowych interwałach telemetrii, staje się to krytycznym wąskim gardłem.

## Decyzja

Używamy **Redis Sorted Sets (`ZSET`)** do przechowywania i rankingu wszystkich tabel wyników.

Kluczowy schemat:
```
leaderboard:city:{tenant_id}       → {user_id: score}
leaderboard:event:{event_id}       → {user_id: score}
leaderboard:club:{club_id}         → {user_id: score}
```

Operacje:
```python
# Inkrementacja wyniku (O(log n))
redis.zincrby(key, km_delta, user_id)

# Top 10 (O(log n + limit))
redis.zrevrange(key, 0, 9, withscores=True)

# Pozycja użytkownika (O(log n))
redis.zrevrank(key, user_id)
```

Strategia trwałości:
- Redis jest skonfigurowany z `appendonly yes` (AOF) dla zapewnienia trwałości.
- PostgreSQL `Participation.score` pozostaje źródłem prawdy; Redis jest buforem zoptymalizowanym pod odczyt.
- W przypadku braku danych w pamięci podręcznej lub restartu Redisa, ranking jest odbudowywany z agregatów tabeli `Participation`.

## Konsekwencje

**Pozytywne:**
- `zincrby` + `zrevrange` mają złożoność O(log n) — stała wydajność przy dowolnej skali.
- Brak dodatkowych zapytań do bazy danych przy odczycie rankingów z panelu administratora lub aplikacji mobilnej.
- Możliwość ustawienia TTL dla kluczy wydarzeń, aby automatycznie usuwać wygasłe rankingi.

**Negatywne:**
- Dane w Redis są wtórne — tabela `Participation` jest zawsze nadrzędna.
- Konieczność "rozgrzewania" cache po restarcie Redisa (zadanie Celery beat).
- Zużycie pamięci: ~100 bajtów na użytkownika na ranking; 1 mln użytkowników × 10 rankingów = ~1 GB RAM.

## Rozważane Alternatywy

| Opcja | Dlaczego odrzucona |
|-------|--------------------|
| PostgreSQL `RANK()` | Poprawny, ale zbyt wolny dla czasu rzeczywistego (SLA <100ms) |
| Elasticsearch | Zbyt rozbudowany dla posortowanych wyników numerycznych |
| Memcached | Brak natywnej struktury posortowanych zbiorów; wymagałby ręcznego obliczania pozycji |
