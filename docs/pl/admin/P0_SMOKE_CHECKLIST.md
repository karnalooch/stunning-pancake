# Lista kontrolna dymu administratora P0

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Zobacz dokument kanoniczny |
| **lang** | pl |
| **translation** | [English](../../admin/P0_SMOKE_CHECKLIST.md) |
| **canonical_path** | docs/pl/admin/P0_SMOKE_CHECKLIST.md |
---

| | |
|--|--|
| **Stan** | ✅ Aktywne (zamknięcie P0 **GOTOWE** 2026-06-02) |
| **Rola właściciela** | Menedżer wersji / Kontrola jakości |
| **Ostatnia recenzja** | 2026-06-03 |
| **Publiczność** | Testerzy GLOBAL_OWNER, TENANT_ADMIN, TENANT_MODERATOR |
| **Indeks** | [ADMIN_INDEX.md](./ADMIN_INDEX.md) |

**Cel:** Możliwość wydrukowania weryfikacji po wdrożeniu.  
**Wymaganie wstępne:** Przed testowaniem ponownie wdróż administratora i interfejs API w środowisku docelowym.  
**Numer referencyjny:** [UI_AUDIT_2026-06-02.md](../../admin/UI_AUDIT_2026-06-02.md) §8 · [P1_ROADMAP.md](./P1_ROADMAP.md) · [ADMIN_ROADMAP.md](./ADMIN_ROADMAP.md) · [RELIABILITY_AUDIT_PLAYBOOK.md](../reports/RELIABILITY_AUDIT_PLAYBOOK.md)  
**Automatyzacja:** `admin/scripts/p0-role-smoke.mjs` (Playwright — smoke nawigacji per rola)  
**Kolej (jeśli sim):** [../../operations/RAILWAY_PRODUCTION_CHECKLIST.md](../../operations/RAILWAY_PRODUCTION_CHECKLIST.md) · `scripts/railway-verify-production.ps1`

---

## Podpisanie (ukończone raz na środowisko)

| Pole | Wartość |
|-------|------------|
| **Środowisko** | np. `admin-production-083b.up.railway.app` |
| **Buduj / wdrażaj identyfikator** | |
| **Tester** | |
| **Data** | |
| **Wynik ogólny** | ☐ **START** — P1 może się uruchomić &nbsp;|&nbsp; ☐ **NIE-GO** — blok P1, problemy z plikami |

**Uwagi / blokery:**```
```---

## GLOBAL_WŁAŚCICIEL

Zaloguj się jako `GLOBAL_OWNER`. Używaj środowiska **nieprodukcyjnego** do kontroli niszczących, chyba że zostało to wyraźnie zatwierdzone.

| # | Sprawdź | Przełęcz |
|---|--------|:----:|
| 1 | **Auth / login** — dane uwierzytelniające działają; sesja utrzymuje się po odświeżeniu | ☐ |
| 2 | **Dashboard** — ładowanie kart KPI; trend tygodniowy jest prawdopodobny (nie „+10 tys.” vs łącznie ~10 tys.); znaczek symulatora widoczny, gdy obecne są dane sim | ☐ |
| 3 | **Użytkownicy** — lista paginacji (15/stronę); wyszukiwanie kończy się niepowodzeniem; otwórz użytkownika **szuflada** ładuje szczegóły (bez długiego stanu pustego) | ☐ |
| 4 | **RBAC** — rola otwarta → szuflada uprawnień; macierz tylko do odczytu; brak błędów konsoli | ☐ |
| 5 | **Wytrzyj** — widoczna strefa niebezpieczna; zablokowano błędną frazę; wymagana poprawna fraza + potwierdzenie MFA (**nie kończ czyszczenia na prodzie**, jeśli nie jest to zaplanowane) | ☐ |
| 6 | **Symulator** — ładuje się strona; status/postęp rozsądny; **PRZEJDŹ** tylko wtedy, gdy można bezpiecznie uruchomić kartę SIM w tym środowisku | ☐ |
| 7 | **Podszywanie się** — sandbox widoczny w szufladzie użytkownika; rozpoczyna się sesja dla właściciela; dziennik kontroli pokazuje wiersze personifikacji | ☐ |
| 8 | **Nawigacja** — widoczne pełne sekcje paska bocznego (Przegląd, Zarządzanie, Operacje, Sponsoring, Analityka, System) | ☐ |

**Podpisanie roli:** Tester ______________ Data ______________ ☐ WYJDŹ ☐ NIE WYJDŹ

---

## ADMINISTRATOR TENANTA

Zaloguj się jako „TENANT_ADMIN” w zakresie jednego dzierżawcy.

| # | Sprawdź | Przełęcz |
|---|--------|:----:|
| 1 | **Auth / login** — konto administratora najemcy działa | ☐ |
| 2 | **Panel kontrolny** — ładuje widok obejmujący najemcę (bez wprowadzających w błąd globalnych sum 10 tys., jeśli najemca jest mały) | ☐ |
| 3 | **Użytkownicy** — lista zawiera **tylko użytkowników dzierżawców**; utwórz/edytuj w szufladzie; zakres działań zbiorczych (odrzucony przez wielu najemców) | ☐ |
| 4 | **RBAC** — trasa ukryta lub tylko do odczytu według zasad (bez macierzy edycji) | ☐ |
| 5 | **Wyczyść** — **nie** dostępne (brak strefy niebezpiecznej / 403 w przypadku wywołania API) | ☐ |
| 6 | **Symulator** — dostępny, jeśli polityka na to pozwala administratorowi najemcy; **PRZEJDŹ** tylko jeśli env na to pozwala | ☐ |
| 7 | **Podszywanie się** — **brak** interfejsu piaskownicy; `POST /api/users/impersonate/<id>/` zwraca **403** | ☐ |
| 8 | **Nawigacja** — Najemcy (własni), Użytkownicy, Działy, Działania; brak tras systemowych wyłącznie globalnych | ☐ |

**Podpisanie roli:** Tester ______________ Data ______________ ☐ WYJDŹ ☐ NIE WYJDŹ

---

## TENANT_MODERATOR

Zaloguj się jako `TENANT_MODERATOR`.

| # | Sprawdź | Przełęcz |
|---|--------|:----:|
| 1 | **Auth / login** — konto moderatora działa | ☐ |
| 2 | **Panel kontrolny** — widoczna lista robocza moderatora; akcje używają **poprawnego najemcy** (nie tylko `per_tenant[0]`) | ☐ |
| 3 | **Użytkownicy** — tylko do odczytu lub odrzuceni zgodnie z polityką (bez destrukcyjnego zbioru) | ☐ |
| 4 | **RBAC** — brak nawigacji lub zablokowany | ☐ |
| 5 | **Wyczyść** — niedostępne | ☐ |
| 6 | **Symulator** — **nie** w nawigacji (moderator nie powinien uruchamiać symulatora) | ☐ |
| 7 | **Aktywności / Anti-Cheat** — zatwierdź/odrzuć lub wyświetl według roli | ☐ |
| 8 | **Nawigacja** – Panel kontrolny, Aktywności, Ochrona przed oszustwami, Wydarzenia; nie Użytkownicy piszą / Ustawienia są usuwane | ☐ |

**Podpisanie roli:** Tester ______________ Data ______________ ☐ WYJDŹ ☐ NIE WYJDŹ

---

## SPONSOR

Zaloguj się jako `SPONSOR`.

| # | Sprawdź | Przełęcz |
|---|--------|:----:|
| 1 | **Autoryzacja / logowanie** — konto sponsora działa | ☐ |
| 2 | **Panel kontrolny** — Ładowanie panelu sponsora (statystyki lub stan pusty z kopią, a nie twardy błąd) | ☐ |
| 3 | **Nawigacja sponsora** — **Panel sponsora**, **Analiza sponsoringu**, **Vouchery** widoczne na pasku bocznym | ☐ |
| 4 | **Użytkownicy / RBAC / Wyczyść** — nie w nawigacji; bezpośredni adres URL zwraca strażnika lub 403 | ☐ |
| 5 | **Symulator** — niedostępny | ☐ |
| 6 | **Kupony** — ładuje się strona; stan pusty dopuszczalny | ☐ |
| 7 | **Analytics** — ładuje się strona ze statystykami sponsoringu | ☐ |
| 8 | **Podszywanie się** — niedostępne | ☐ |

**Podpisanie roli:** Tester ______________ Data ______________ ☐ WYJDŹ ☐ NIE WYJDŹ

---

## Szybkie kontrole wyrywkowe API (opcjonalnie)

Uruchom z tokenem administratora dzierżawy (powinno zakończyć się niepowodzeniem):```http
POST /api/users/impersonate/<athlete_id>/
→ 403 Forbidden
```---

## Po liście kontrolnej

| Wynik | Następny krok |
|------------|-----------|
| **GO** (wszystkie role) | Rozpocznij P1 według [UI_AUDIT_2026-06-02.md](../../admin/UI_AUDIT_2026-06-02.md) §5 P1 |
| **NIE PRZEJDŹ** | Wady kłody; naprawić regresje P0; wdróż ponownie i ponownie uruchom tę listę kontrolną |
