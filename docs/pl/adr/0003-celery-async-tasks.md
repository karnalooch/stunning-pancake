# ADR-0003: Kolejka zadań asynchronicznych — Celery zamiast sygnałów Django dla ciężkich zadań

**Status**: Zaakceptowany  
**Data**: 2026-04-24  
**Autor**: akarn  

---

## Kontekst

Kilka operacji w SPORT jest kosztownych obliczeniowo lub zależy od zewnętrznych usług o zmiennych opóźnieniach:

1. **Walidacja BRouter** — wywołanie HTTP do serwera BRouter (10–30s dla długich śladów GPX)
2. **Powiadomienia push** — dostarczanie FCM/APNs (sieciowe wejście/wyjście, limity stawek)
3. **Agregacja postępów wydarzenia** — agregacje DB w tysiącach uczestnictw
4. **Generowanie karty aktywności** — renderowanie obrazu Pillow (obciążenie CPU, 1–5s)

Początkowo walidacja BRouter została zaimplementowana jako **Sygnał Django** (`post_save` na `Activity`). Blokuje to wątek odpowiedzi API i obniża przepustowość pod obciążeniem współbieżnym.

## Decyzja

Przyjmujemy **Celery 5.3 z Redisem jako brokerem** dla wszystkich ciężkich prac w tle.

Topologia kolejek:
```
Kolejka CRITICAL      → walidacja BRouter, aktualizacja postępów wydarzenia
Kolejka NOTIFICATIONS → push FCM, podsumowania e-mail, alerty Matrix
Kolejka DEFAULT      → wszystko inne
```

Sygnały pozostają jako **wyzwalacz** (cienka warstwa), który kolejkuje zadanie Celery, zamiast wykonywać logikę w linii:

```python
# signals.py — tylko kolejkowanie
from activities.tasks import validate_activity_async
validate_activity_async.delay(instance.pk)

# tasks.py — wykonanie w workerze
@shared_task(queue='critical', max_retries=3)
def validate_activity_async(activity_id):
    ...
```

## Konsekwencje

**Pozytywne:**
- Punkty końcowe API są nieblokujące — przesłanie aktywności zwraca wynik natychmiast.
- Współbieżność workerów jest konfigurowalna niezależnie od workerów webowych.
- Nieudane zadania są automatycznie ponawiane z wykładniczym czasem oczekiwania (exponential backoff).
- Workery Celery mogą być skalowane horyzontalnie poprzez dodawanie kontenerów.

**Negatywne:**
- Spójność ostateczna (eventual consistency): wynik weryfikacji nie jest dostępny natychmiast po przesłaniu.
- Dodatkowy komponent infrastruktury (Redis musi być wysoko dostępny).
- Serializacja zadań: modele muszą być przekazywane przez PK, a nie instancję, aby uniknąć nieaktualnych danych.

## Plan migracji

Faza 7 wprowadza infrastrukturę. Potok sygnałów pozostaje synchroniczny do czasu potwierdzenia stabilności workera Celery w środowisku staging. Przełącznik `ASYNC_VALIDATION=True` w `.env` kontroluje zmianę.

## Rozważane Alternatywy

| Opcja | Dlaczego odrzucona |
|-------|--------------------|
| Django-RQ | Prostszy, ale brakuje mu trasowania zadań typu canvas i harmonogramu beat |
| Dramatiq | Dobry, ale mniejsze wsparcie w ekosystemie Django |
| Sygnały w linii | Blokują wątek API; nieakceptowalne przy >100 współbieżnych użytkownikach |
