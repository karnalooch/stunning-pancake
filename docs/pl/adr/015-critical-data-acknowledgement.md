# ADR 015 — potwierdzenie ACK i bezpieczne usuwanie danych krytycznych

| | |
|---|---|
| **Status** | Zaakceptowano |
| **Data decyzji** | 2026-09-16 |
| **Owner role** | Tech Lead / Platform Operator |
| **Audience** | Mobile, backend, telemetry, platform, operations |
| **lang** | pl |
| **translation** | [English](../../adr/015-critical-data-acknowledgement.md) |

**Powiązane:** [ADR 011](./011-telemetry-ingest-durability-under-load.md) · [DATA_RESILIENCE](../DATA_RESILIENCE.md) · [Partial Takeover Pilot Plan](../../PARTIAL_TAKEOVER_PILOT_PLAN.md)

## Kontekst

4VELO zapisuje dane, których cicha utrata albo przypisanie do niewłaściwego użytkownika bezpośrednio niszczy zaufanie: sesje jazdy, ślad GPS, stan profilu i tenanta, członkostwo i operacje administracyjne, naliczenia nagród/leaderboardu oraz żądania eksportu lub usunięcia danych. Przed pilotem traktujemy je z rygorem zbliżonym do systemów finansowych: niejednoznaczny wynik jest bezpiecznie ponawiany, sam sukces transportu nie oznacza zapisu, a lokalna kopia może zostać skasowana dopiero po dowodzie istnienia innej trwałej kopii.

ADR 011 wymaga już trwałego outboxu mobilnego dla telemetrii. Ten ADR rozszerza semantykę ACK na cały projekt i usuwa niejednoznaczność, w której HTTP `2xx` albo przyjęcie przez nietrwałą kolejkę mogłoby zostać potraktowane jak trwałe zapisanie danych.

## Decyzja

### 1. Niezmiennik ACK dla danych krytycznych

Dla **danych krytycznych** ACK oznacza dokładnie:

> **Producent może teraz nieodwracalnie usunąć swoją jedyną lokalną/ponawialną kopię bez wiarygodnego scenariusza utraty danych.**

Endpoint, kolejka, worker ani klient NIE MOŻE uznać zapisu za potwierdzony tylko dlatego, że:

- request dotarł do procesu;
- walidacja przeszła;
- dane weszły do kolejki w pamięci procesu;
- dane są w cache;
- nietrwały Redis/Redis Stream przyjął wpis;
- status HTTP wynosi `200`, `201` albo `202`;
- zaplanowano background task.

Sukces transportu i trwałe potwierdzenie to dwa różne pojęcia.

### 2. Co może być granicą ACK

Dane krytyczne mogą zostać potwierdzone dopiero po jednym z dwóch zdarzeń:

1. **Commit do kanonicznego trwałego storage** — zakończył się powodzeniem; albo
2. **Commit do trwałego journalu** — journal ma udowodnione wszystkie właściwości:
   - przetrwanie restartu procesu/kontenera;
   - przetrwanie restartu hosta/usługi zgodnie z kontraktem docelowego wdrożenia;
   - procedurę replay/recovery;
   - retencję, która nie może po cichu usunąć nieprzetworzonych, już potwierdzonych wpisów;
   - monitoring backlogu i failed-delivery/DLQ;
   - objęcie backupem/recovery albo jawnie równoważnym mechanizmem trwałości.

Jeżeli którejkolwiek właściwości nie potrafimy udowodnić, journal **nie jest granicą ACK**.

Dla pilota telemetry powinno używać **ACK po commit do DB**, chyba że trwałość Redis Stream zostanie jawnie skonfigurowana i potwierdzona testami restart/recovery. Sam `XADD` do Redisa bez udowodnionej trwałości oznacza przyjęcie do kolejki, nie trwały ACK.

### 3. Tożsamość i kompletność ACK

Każdy ACK retryowalnej operacji krytycznej MUSI być powiązany z konkretną operacją.

Dla paczki telemetry oznacza co najmniej:

- zgodny `client_batch_id`;
- zgodny user/activity scope;
- pełne pokrycie punktów (`inserted + świadomie dropped_privacy + już trwale zdeduplikowane` pokrywa wysłaną paczkę);
- brak ACK dla innej albo częściowo utrwalonej paczki.

Analogiczny correlation/idempotency key jest wymagany dla innych retryowalnych zapisów biznesowych, jeżeli niejednoznaczna odpowiedź może prowadzić do duplikatu albo utraty.

### 4. Zasada niejednoznacznego wyniku

Timeout, reset połączenia, śmierć procesu albo brak/poprawności ACK oznacza **UNKNOWN**, nie porażkę i nie sukces.

Producent zachowuje retryowalną kopię i ponawia operację z idempotency key. Konsument musi sprawić, że ponowna dostawa jest bezpieczna poprzez constraint DB, trwały rejestr idempotencji albo mechanizm o równoważnej sile.

Odpowiedź `duplicate/replay` może być uznana za ACK wyłącznie wtedy, gdy odbiorca potrafi udowodnić, że pierwotna operacja osiągnęła trwałą granicę ACK.

### 5. Delete-after-ACK

Klient/outbox/worker NIE MOŻE usunąć ostatniej ponawialnej kopii przed prawidłowym ACK.

Maszyna stanów powinna to pokazywać jawnie, np.:

`pending -> syncing -> acked -> eligible_for_delete`

Restart procesu w stanie `syncing` prowadzi do retry/recovery, nigdy do skasowania.

### 6. Finalizacja jest barierą commit

Jazda/sesja NIE MOŻE być prezentowana jako w pełni zapisana/zakończona, jeżeli krytyczne dane podrzędne nadal czekają, chyba że UI jawnie pokazuje odzyskiwalny stan „zapisywanie / synchronizacja w toku”.

Dla nagrywania jazdy:

1. zatrzymujemy producenta GPS;
2. trwale zapisujemy ostatni lokalny stan;
3. wysyłamy/ponawiamy wszystkie wymagane batch'e do trwałego ACK;
4. rekoncyliujemy/budujemy kanoniczną trasę aktywności i dane pochodne;
5. finalizujemy aktywność;
6. dopiero wtedy pokazujemy trwałe zakończenie.

Jeżeli krok pozostaje niedokończony, stan ma pozostać odzyskiwalny i widocznie oczekujący.

### 7. Zakres danych krytycznych

Niezmiennik obejmuje co najmniej:

- utworzenie i finalizację jazdy/sesji;
- punkty GPS/telemetry i rekonstrukcję trasy;
- zmianę profilu/tenanta wpływającą na scope autoryzacji;
- członkostwo w klubie/ekipie i uprzywilejowane mutacje admina;
- nagrody, leaderboard lub dane o charakterze salda/kredytu;
- żądania usunięcia konta i eksportu danych;
- billing/płatności, jeśli zostaną włączone;
- każdą przyszłą operację, w której brak/duplikat może zaszkodzić użytkownikowi albo zmienić stan autoryzacji/rozliczenia.

Cache, stan renderowania i odtwarzalne dane pochodne mogą mieć słabszy kontrakt tylko wtedy, gdy kanoniczne źródło jest kompletne, a rekonstrukcja deterministyczna.

### 8. Scope ACK

Trwały ACK jest ważny tylko dla uwierzytelnionego i autoryzowanego podmiotu/obiektu. Correlation ID nie zastępuje autoryzacji.

Tam, gdzie ma to zastosowanie, odbiorca przed zapisem i ACK weryfikuje user, tenant, activity/resource oraz audience/scope.

### 9. Log nie jest dowodem trwałości

Logi, eventy analityczne, Sentry/Crashlytics, metryki, klucze cache Redis oraz komunikaty sukcesu w UI nigdy nie są kanonicznym dowodem zapisu.

Mogą służyć obserwowalności, ale ACK musi wynikać z samej trwałej ścieżki danych.

## Testy akceptacyjne przed pilotem

Przed wejściem do P6 krytyczne ścieżki objęte tym ADR muszą udowodnić co najmniej:

- retry po timeout po commit do serwera, ale przed odpowiedzią;
- retry po timeout przed commit;
- restart procesu/kontenera pomiędzy zapisem i odpowiedzią;
- ponowną dostawę bez podwójnego efektu biznesowego;
- restart klienta offline z zachowanym outboxem;
- restart serwera przy oczekującej paczce;
- blokadę finalizacji przy niepotwierdzonych danych podrzędnych;
- odrzucenie replay correlation-id pomiędzy userami/tenantami;
- zachowanie trwałego stanu stanowiącego podstawę ACK po backup/restore.

Testy wymagające rzeczywistego Androida albo runtime home labu pozostają `NOT RUN`, dopóki nie zostaną wykonane w tym środowisku; code review nie jest dowodem trwałości runtime.

## Konsekwencje

- Część endpointów może być wolniejsza, ponieważ w pilocie preferujemy synchroniczny trwały commit zamiast wczesnego sukcesu.
- Wysokowydajne kolejki są dozwolone, ale muszą udowodnić trwałość, zanim staną się granicą ACK.
- Retry/idempotency staje się częścią kontraktu API, a nie szczegółem implementacji.
- UI musi rozróżniać „przyjęto / synchronizacja trwa” od trwałego zakończenia.
- P3 Pilot Data Safety Audit jest obowiązkowy przed uznaniem dalszego UI/paneli za gotowość do pilota.
