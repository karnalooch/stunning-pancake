# Plan T00 — publikacja „4VELO — Master Cleanup Plan"

## Goal

Jeden śledzony plik (`docs/TAKEOVER_CLEANUP_PLAN.md`), jeden commit,
jedna gałąź `docs/takeover-cleanup-plan`, jeden Draft PR do `main`.
Statusy T00/T01/T21 korygowane względem faktów PR #47 i PR #59;
T21 przed T22 w `ordered execution`.

## Current state (odczyt 2026-09-10, bez `git fetch`)

- **Branch:** `security/remove-committed-signing-key` (HEAD lokalnie `71d13de`).
- **Working tree:** czysty w plikach śledzonych; jedyny nieśledzony wpis
  `?? .kilo/plans/1789063741873-takeover-cleanup-plan.md` (źródło treści,
  **nietknięte**, niezatwierdzane do commita).
- **`origin/main`:** `df2f5fe59d3858ab415f3d48c4900c30ee464e67` (bazowy HEAD T00).
- **PR #47 HEAD (`refs/pull/47/head` = `refs/heads/security/remove-committed-signing-key`):** `c01c9b40a6a5ef57a2ca0734efd2c45e4e8ad406`.
- **PR #47 merge candidate (`refs/pull/47/merge`):** `e86e79faa64005ed16da3903e2ce1fc9da16d552`.
- **PR #59 HEAD (`refs/pull/59/head`):** `d5bb992138d6456399b36751b9af06ba55432fcb`.
- **Gałąź `docs/takeover-cleanup-plan`:**
  - lokalna **istnieje** (`fedf3d79d92fa58fd69401d377ddcbc2c6ec31ba`, starsza treść);
  - zdalna **nie istnieje** (`git ls-remote origin refs/heads/docs/takeover-cleanup-plan` → puste);
  - **brak otwartego PR** dla tej gałęzi.

Lokalny cached `git rev-parse origin/security/remove-committed-signing-key` =
`71d13de` jest **nieaktualny** (środowisko blokuje `git fetch`); SHA
`c01c9b40` z `git ls-remote` jest rozstrzygające.

## Sprzeczności w master planie (do korekty w T00)

| # | Gdzie | Obecny stan | Korekta |
|---|---|---|---|
| 1 | Tabela `STATUS`, T00 | `PLANNED` (lokalny) / `ACTIVE` (zdalny `fedf3d7`) | `ACTIVE` przez cały czas T00 |
| 2 | Tabela, T01 | `PLANNED`, `security/signing-key-removal` | `BLOCKED`, `security/remove-committed-signing-key`, dep. „kontynuacja #47 (Draft, APPROVE, BLOCKED — OWNER ACTION REQUIRED)" |
| 3 | Tabela, T21 | `PLANNED`, `ci/mobile-filter-and-tests` | `ACTIVE`, `ci/mobile-path-filter-integrity` |
| 4 | `Master plan – ordered execution` | T22 przed T21 | zamiana: T21 przed T22 |
| 5 | `Transza referencyjna – T01` → Acceptance criteria | „placeholder akceptowany" | placeholder/empty/null **odrzucane** |
| 6 | `Transza referencyjna – T01` → Scope/Code Mode | ścieżki Windows `D:\gem\…`, gałąź `security/signing-key-removal` | ścieżki repo-relative, gałąź `security/remove-committed-signing-key` |
| 7 | Decyzje właściciela | brak rozróżnienia status PR vs bloker | dodać decyzję: „`APPROVE` ≠ gotowość do merge przy blokerze właścicielskim/środowiskowym" |
| 8 | Tabela | brak kolumny PR | dodać 7. kolumnę: T00=`ten PR`, T01=`#47`, T21=`#59`, reszta=`—` |

## Scope T00

### Włączone (minimalne)
1. Utworzenie/aktualizacja wyłącznie `docs/TAKEOVER_CLEANUP_PLAN.md`.
2. Pełna lista T00–T59 (dokładnie 60 wierszy).
3. Korekta kolejności T21 przed T22.
4. Korekta statusów i gałęzi T00/T01/T21 + nowa kolumna PR.
5. Korekta opisu testów w `Transza referencyjna – T01`.
6. Ścieżki repo-relative w `Transza referencyjna – T01`.
7. Jedna nowa decyzja właściciela (rozróżnienie PR vs bloker).
8. Zachowanie wszystkich pozostałych sekcji bez zmian merytorycznych.

### Poza zakresem (zakaz)
- Kod produktu; workflow CI; zależności i lockfile; `railway.json`; `Dockerfile*`; `infrastructure/k8s/*`; `mobile/app.config.js`; `mobile/eas.json`; Firebase.
- Merge #47/#59.
- Porządkowanie `PROJECT_TAKEOVER.md`, `TAKEOVER_WORK_QUEUE.md`, `docs/reports/*`.
- Modyfikacja `.kilo/plans/*.md` (nietknięte, nie w commicie).
- `git reset --hard`, `git push --force`, `git push --force-with-lease` (push ma być zwykły; non-fast-forward = STOP).
- Ujawnianie wartości `SECRET_KEY` gdziekolwiek.
- Umieszczanie w opublikowanej `docs/TAKEOVER_CLEANUP_PLAN.md` jakiegokolwiek wyjątku dla `--force-with-lease` (kwestia czysto operacyjna publikacji T00, nie reguła programu).

### Obsługa istniejącej gałęzi
- Lokalna gałąź `docs/takeover-cleanup-plan` istnieje ze starszą treścią → **zmiana nazwy** na `docs/takeover-cleanup-plan-stale-fedf3d7` (zachowanie historii, brak overwrite, brak force-push).
- Zdalna gałąź nie istnieje → zwykły `git push -u origin docs/takeover-cleanup-plan` powinien przejść bez non-fast-forward. Gdyby mimo to wystąpił non-fast-forward, executor **zatrzymuje się** i raportuje diagnostykę (lokalny SHA, zdalny SHA, merge-base, diff stat, lista PR na gałęzi). Tylko właściciel może osobno zatwierdzić `--force-with-lease`.

## Files

| Plik | Rola w PR |
|---|---|
| `docs/TAKEOVER_CLEANUP_PLAN.md` | **jedyny śledzony plik w PR** (nowy) |
| `.kilo/plans/1789063741873-takeover-cleanup-plan.md` | źródło treści, odczytywany, **nietknięty** |
| `docs/PROJECT_TAKEOVER.md`, `docs/TAKEOVER_WORK_QUEUE.md`, `docs/reports/*` | kontekst, odczytywane |
| `scripts/check_config_secrets.py`, `scripts/test_check_config_secrets.py` | potwierdzenie zachowania T01 |
| `docs/locales/i18n_manifest.json` | potwierdzenie braku wymagań i18n dla T00 |

## Struktura `docs/TAKEOVER_CLEANUP_PLAN.md`

Bazuje na `.kilo/plans/1789063741873-takeover-cleanup-plan.md` (341 linii) z korektami:

1. Nagłówek: zachowany; `Aktualny main HEAD: df2f5fe`.
2. `Decyzje właściciela`: 25 istniejących + **1 nowa**:
   > Status techniczny PR (`APPROVE`/`Draft`/`green CI`) i blokery właścicielskie/środowiskowe są rozróżnione: `STATUS` opisuje stan techniczny transzy; ewentualny bloker jest wypisany w `Zależności` jako `BLOCKED — OWNER ACTION REQUIRED` lub `BLOCKED — ENVIRONMENT REQUIRED`. `APPROVE` w Code Review ≠ gotowość do merge, gdy istnieje bloker właścicielski/środowiskowy.
3. `Stan planu` (tabela): nowa 7. kolumna `PR` (`—`/`ten PR`/`#47`/`#59`). Wiersze T00/T01/T21 zgodnie z tabelą statusów poniżej; reszta bez zmian treści.
4. `Out of scope`: zachowane.
5. `Master plan – ordered execution`: pozycja 3 = T21, pozycja 4 = T22.
6. `Transza referencyjna – T01`: ścieżki repo-relative, branch `security/remove-committed-signing-key`, testy opisane jako
   > (1) `SECRET_KEY` odrzucane dla placeholder/empty/null,
   > (2) konfiguracja bez kluczy akceptowana,
   > (3) `JWT_SIGNING_KEY` odrzucane niezależnie od wartości,
   > (4) niepoprawny JSON zgłasza błąd;
   oraz w `Risks` zakaz ujawniania commitowanej wartości.
7. `Acceptance criteria dla całego programu`, `Verification`, `Risks and rollback`, `Executor handoff`: zachowane.

## Statusy T00 / T01 / T21

| ID | Transza | P | Status | Gałąź | Zależności | PR |
|----|---------|---|--------|-------|------------|----|
| T00 | Publikacja master planu | P0 | **ACTIVE** | docs/takeover-cleanup-plan | — | **ten PR** |
| T01 | Signing key removal + ci guard | P0 | **BLOCKED** | **security/remove-committed-signing-key** | **kontynuacja #47 (Draft, APPROVE, BLOCKED — OWNER ACTION REQUIRED)** | **#47** |
| T21 | Mobile CI filter + test integrity | P0 | **ACTIVE** | **ci/mobile-path-filter-integrity** | — | **#59** |

Pozostałe 57 wierszy: w nowej kolumnie `PR` wpis `—`, treść bez zmian.

## Walidacja logiczna T00–T59

Wykonywana przez executor jednolinijkowo (komendy w sekcji Verification):
1. Dokładnie 60 unikalnych wierszy `T00…T59` w tabeli `Stan planu`.
2. `T21` przed `T22` w `Master plan – ordered execution`.
3. Zależności spójne topologicznie (T22→T21, T04→T03, T06→T05, T11→T10,
   T14→T13, T15→T06, T16→T05, T18→T17, T19→T11,T17, T20→T14,T18,
   T23/T24→T22, T25→T19,T20, T26→T22,T23, T29→T19,T27,T28, T30→T27,T28,
   T32→T27, T34→T33, T37/T39→T21, T40→T03,T12, T44→T08, T45→T19,
   T48→T01,T17, T49 zależy od #51/#57, T55→T46,T48,T49, T57→T49,
   T58 kontynuacja #57, T59→T58,T57,T19,T20,T46).

## Acceptance criteria

T00 jest gotowy do Code Review, gdy:
1. `docs/TAKEOVER_CLEANUP_PLAN.md` istnieje; tabela `Stan planu` ma dokładnie 60 unikalnych wierszy T00…T59.
2. Kolumna `PR` ma wartości: T00=`ten PR`, T01=`#47`, T21=`#59`, reszta=`—`.
3. T00 `ACTIVE`; T01 `BLOCKED` + jawny opis blokera; T21 `ACTIVE`.
4. `ordered execution`: T21 przed T22.
5. `Transza referencyjna – T01`: ścieżki repo-relative; gałąź `security/remove-committed-signing-key`; placeholder/empty/null **odrzucane**.
6. PR: Draft, base=`main`, head=`docs/takeover-cleanup-plan`, 1 commit, **1 plik w diff**.
7. `git diff --check` czyste.
8. `python scripts/check_docs_links.py` bez nowych błędów.
9. Walidacja T00–T59 (sekcja wyżej) przechodzi.
10. W PR nie pojawia się wartość `SECRET_KEY`; w opisie PR jawne potwierdzenie.
11. Nowa decyzja właściciela o rozróżnieniu status PR vs bloker jest obecna.
12. Working tree w plikach śledzonych: czysty poza `A docs/TAKEOVER_CLEANUP_PLAN.md`. Raport końcowy rozróżnia ten stan od istniejącego wcześniej nieśledzonego `.kilo/plans/*.md` (który **pozostaje nietknięty i niezatwierdzony do commita**).

## Verification (komendy gotowe do wklejenia w PowerShell)

### Git (bez `git fetch`)
```powershell
git status --short
git rev-parse origin/main
git ls-remote origin refs/heads/main refs/pull/47/head refs/pull/47/merge refs/pull/59/head
git branch --list docs/takeover-cleanup-plan
git ls-remote origin refs/heads/docs/takeover-cleanup-plan
git rev-parse --abbrev-ref HEAD
git diff --check
git diff origin/main...HEAD --stat
git log -1 --format="%H %s"
```

### Walidacja tabeli (Python — każda linia gotowa do wklejenia)

Wyrażenia regularne używają `r'...'` (raw string), dzięki czemu `\|` wewnątrz
nie wymaga dodatkowego escapowania w powłoce. Separator instrukcji
to `;` (wewnątrz `"..."` PowerShell traktuje `;` jako literal).

**V1 — kompletność (dokładnie 60 unikalnych wierszy T00–T59):**
```powershell
python -c "import re; t=open('docs/TAKEOVER_CLEANUP_PLAN.md',encoding='utf-8').read(); block=t.split('## Stan planu',1)[1].split('## Out of scope',1)[0]; ids=re.findall(r'^\|\s*(T\d{2})\s*\|', block, re.M); assert len(ids)==60, f'rows={len(ids)}'; assert len(set(ids))==60, 'duplicates present'; print('V1 OK rows=', len(ids))"
```

**V2 — `T21` przed `T22` w `ordered execution`:**
```powershell
python -c "import re; t=open('docs/TAKEOVER_CLEANUP_PLAN.md',encoding='utf-8').read(); m=re.search(r'## Master plan . ordered execution(.+?)(?=^## )', t, re.S|re.M); lines=[l.strip() for l in m.group(1).splitlines() if re.match(r'^\d+\.\s+T\d{2}', l.strip())]; pos={l.split()[1]:int(l.split('.')[0]) for l in lines}; assert pos.get('T21') and pos.get('T22'), f'missing ids pos={pos}'; assert pos['T21'] < pos['T22'], pos; print('V2 OK T21=', pos['T21'], '< T22=', pos['T22'])"
```

**V3 — wiersze T01/T21 w `Stan planu` mają poprawne gałęzie i nie mają starych:**
```powershell
python -c "import re; t=open('docs/TAKEOVER_CLEANUP_PLAN.md',encoding='utf-8').read(); block=t.split('## Stan planu',1)[1].split('## Out of scope',1)[0]; rows=[r for r in block.splitlines() if r.startswith('| T')]; t01=next((r for r in rows if r.startswith('| T01 |')),''); t21=next((r for r in rows if r.startswith('| T21 |')),''); assert 'security/remove-committed-signing-key' in t01 and 'security/signing-key-removal' not in t01, ('T01 row', t01); assert 'ci/mobile-path-filter-integrity' in t21 and 'ci/mobile-filter-and-tests' not in t21, ('T21 row', t21); print('V3 OK')"
```

**V4 — brak `placeholder akceptowany`, obecność `odrzucane` w `Transza referencyjna`:**
```powershell
python -c "t=open('docs/TAKEOVER_CLEANUP_PLAN.md',encoding='utf-8').read(); ref=t.split('Transza referencyjna',1)[1]; assert 'placeholder akceptowany' not in ref, 'stale placeholder language'; assert 'odrzucane' in ref, 'expected odrzucane'; print('V4 OK')"
```

### Walidacja dokumentacji i PR
```powershell
python scripts/check_docs_links.py
gh pr view --json number,url,isDraft,baseRefName,headRefName,files
```
Oczekiwane `gh pr view`: `isDraft=true`, `baseRefName=main`,
`headRefName=docs/takeover-cleanup-plan`, `files` zawiera wyłącznie
`docs/TAKEOVER_CLEANUP_PLAN.md`.

### Nie wymagane dla T00
- `python scripts/check_docs_i18n.py` (dokumentu nie ma w `i18n_manifest.json`; kontrola pomija).
- `python scripts/check_openapi_drift.py`, `ruff`, `pnpm` (brak zmian w kodzie).

## Risks and rollback

- **Nadpisanie istniejącej lokalnej gałęzi T00:** blokowane przez procedurę zmiany nazwy (nie overwrite, nie force-push).
- **Non-fast-forward przy push:** aktualnie nie wystąpi (zdalny ref nie istnieje); gdyby wystąpił, executor zatrzymuje się i raportuje diagnostykę. Tylko właściciel zatwierdza `--force-with-lease`.
- **Wyciek `SECRET_KEY`:** blokowane przez brak `backend/railway.json` w PR, `git diff --check`, Code Review, regułę „nie kopiuj w diff/opisie/logach".
- **Rozbieżność statusów:** blokowane przez `git ls-remote refs/pull/59/head`, webfetch, `gh pr view`, Code Review.
- **Pominięcie zależności:** blokowane przez V2.
- **Naruszenie niezmienności `.kilo/plans/*.md`:** blokowane przez regułę + końcowe `git status --short`.

### Rollback T00
Wyłącznie: pojedynczy `git revert -m 1 <merge-sha>` (po merge) lub `git revert <commit-sha>` dla pojedynczego commita. Żadne inne operacje (usuwanie gałęzi, force-push, `git reset --hard`) nie wchodzą w zakres rollbacku T00 — wymagają osobnej decyzji właściciela.

## Implementation steps (Code Mode)

Każdy krok jest mały i bez samodzielnych decyzji architektonicznych.

1. **Weryfikacja środowiska (bez `git fetch`):**
   ```powershell
   git status --short
   git rev-parse origin/main
   git ls-remote origin refs/heads/main refs/pull/47/head refs/pull/47/merge refs/pull/59/head
   git branch --list docs/takeover-cleanup-plan
   git ls-remote origin refs/heads/docs/takeover-cleanup-plan
   ```
   Oczekiwane: working tree czysty w tracked (poza `?? .kilo/plans/…`); `main=df2f5fe`; `pull/47/head=c01c9b40`; `pull/59/head=d5bb992138d6456399b36751b9af06ba55432fcb`.

2. **Obsługa istniejącej gałęzi T00:**
   - Jeśli `git branch --list docs/takeover-cleanup-plan` niepuste:
     `git switch security/remove-committed-signing-key` (lub `main`),
     następnie `git branch -m docs/takeover-cleanup-plan docs/takeover-cleanup-plan-stale-fedf3d7`.
     Stara historia zachowana pod nową nazwą; bez `git reset --hard`, bez force-push.
   - Jeśli `git ls-remote origin refs/heads/docs/takeover-cleanup-plan` niepuste (niespodziewane):
     **STOP**, brak push. Zwróć: `git rev-parse HEAD`,
     `git ls-remote origin refs/heads/docs/takeover-cleanup-plan`,
     `git merge-base origin/main docs/takeover-cleanup-plan`,
     `git diff origin/docs/takeover-cleanup-plan...HEAD --stat`,
     `gh pr list --head docs/takeover-cleanup-plan --state all`.

3. **Utworzenie świeżej gałęzi:**
   ```powershell
   git switch -c docs/takeover-cleanup-plan origin/main
   git rev-parse --abbrev-ref HEAD
   ```

4. **Wczytanie źródła:**
   Otwórz `.kilo/plans/1789063741873-takeover-cleanup-plan.md`; potwierdź 341 linii i nietknięcie (`git status` nie powinien wskazywać zmian w `.kilo/`).

5. **Przygotowanie `docs/TAKEOVER_CLEANUP_PLAN.md`:**
   - skopiuj treść źródłową do bufora;
   - zastosuj korekty 1–8 ze struktury dokumentu;
   - zapisz do `docs/TAKEOVER_CLEANUP_PLAN.md`.

6. **Kontrola lokalna:**
   ```powershell
   git diff --check
   python scripts/check_docs_links.py
   python -c "..."     # V1
   python -c "..."     # V2
   python -c "..."     # V3
   python -c "..."     # V4
   git status --short
   ```
   Oczekiwane: `A  docs/TAKEOVER_CLEANUP_PLAN.md` + `?? .kilo/plans/1789063741873-takeover-cleanup-plan.md` (nietknięte).

7. **Commit:**
   ```powershell
   git add docs/TAKEOVER_CLEANUP_PLAN.md
   git commit -m "docs: publish master takeover cleanup plan (T00)"
   git log -1 --format="%H %s"
   ```

8. **Push — pierwsza próba zwykła (bez `--force`):**
   ```powershell
   git push -u origin docs/takeover-cleanup-plan
   ```
   - Sukces → kontynuuj.
   - Odmowa (non-fast-forward lub inny błąd) → **STOP**, brak `--force`.
     Zwróć diagnostykę:
     ```powershell
     git rev-parse HEAD
     git ls-remote origin refs/heads/docs/takeover-cleanup-plan
     git merge-base origin/main docs/takeover-cleanup-plan
     git diff origin/docs/takeover-cleanup-plan...HEAD --stat
     gh pr list --head docs/takeover-cleanup-plan --state all
     ```
     Tylko właściciel może osobno zatwierdzić `--force-with-lease`.

9. **Otwarcie PR (Draft) — treść przez `--body` (bez `--body-file`, bez placeholdera):**
   ```powershell
   gh pr create --base main --head docs/takeover-cleanup-plan --title "docs: publish master takeover cleanup plan (T00)" --body @PR_BODY.md --draft
   ```
   Plik `PR_BODY.md` z treścią opisu znajduje się **poza repo** (np.
   `C:\Users\akarn\AppData\Local\Temp\kilo\t00-pr-body.md`) — tworzony
   przez executor z poniższą treścią i usuwany po otwarciu PR. Treść
   dosłowna:
   ```
   ## T00 — publikacja master takeover cleanup plan

   Publikacja obowiązującego „4VELO — Master Cleanup Plan"
   (docs/TAKEOVER_CLEANUP_PLAN.md) na gałęzi docs/takeover-cleanup-plan
   opartej o origin/main (df2f5fe).

   ### Zakres PR
   - Jedyny śledzony plik w diff: docs/TAKEOVER_CLEANUP_PLAN.md.
   - Pełna lista transz T00–T59 (60 wierszy; brak skracania).
   - Korekta kolejności T21 przed T22 w sekcji
     „Master plan – ordered execution" (T22 zależy od T21).
   - Statusy: T00 = ACTIVE (ten PR), T01 = BLOCKED
     (PR #47, kontynuacja), T21 = ACTIVE (PR #59).
   - Nowa kolumna PR w tabeli stanu.

   ### Powiązane PR
   - #47 (T01, security/remove-committed-signing-key): Draft,
     APPROVE w Code Review, BLOCKED — OWNER ACTION REQUIRED
     (wymaga potwierdzenia/rotacji SECRET_KEY w Railway PRZED merge).
     Wartość commitowana NIE jest ujawniana w tym PR, w diff,
     w opisach ani w logach.
   - #59 (T21, ci/mobile-path-filter-integrity): Draft, mergeable,
     1 commit, 2 pliki, pełne zielone CI (19 checks).

   ### Poza zakresem
   - Kod produktu, workflow CI, zależności, lockfile,
     railway.json, Dockerfile*, infrastructure/k8s/*,
     mobile/app.config.js, mobile/eas.json, Firebase.
   - Merge #47 i #59.
   - Lokalne pliki .kilo/plans/*.md (pozostają nieśledzone i nietknięte).

   ### Weryfikacja wykonana przez executor
   - git diff --check: czyste.
   - python scripts/check_docs_links.py: bez nowych błędów.
   - V1–V4: 60 unikalnych ID T00–T59, T21 przed T22,
     nazwy gałęzi zgodne, opis testów zgodny z implementacją.
   - Working tree w plikach śledzonych: czysty poza dodanym
     docs/TAKEOVER_CLEANUP_PLAN.md. Nieśledzony .kilo/plans/*.md
     pozostaje nietknięty (nie w commicie).
   - Wartość SECRET_KEY: nie pojawia się w diff ani w opisie PR.

   ### Plan referencyjny
   .kilo/plans/1789069397861-t00-takeover-cleanup-plan.md
   ```
   Następnie:
   ```powershell
   gh pr view --json number,url,isDraft,baseRefName,headRefName,files
   ```

10. **Końcowa kontrola i raport:**
    ```powershell
    git diff origin/main...HEAD --stat
    git diff origin/main...HEAD -- docs/TAKEOVER_CLEANUP_PLAN.md | Select-Object -First 40
    git status --short
    ```
    Oczekiwane `git status --short`:
    ```
    ?? .kilo/plans/1789063741873-takeover-cleanup-plan.md
    ```
    (zero wpisów tracked; rozróżnienie: brak zmian w śledzonych vs istniejący
    wcześniej nieśledzony artefakt Kilo).
    Raport końcowy zawiera: gałąź, commit SHA, adres PR, wyniki V1–V4,
    `check_docs_links.py`, `gh pr view`, jawne „wartość `SECRET_KEY` nie
    pojawiła się w diff ani w opisie PR", jawne „`.kilo/plans/*.md`
    nietknięte (nieśledzone)".

## Executor handoff

Cel: opublikować `docs/TAKEOVER_CLEANUP_PLAN.md` jako T00, w jednym commicie, na gałęzi `docs/takeover-cleanup-plan`, jako Draft PR do `main`. **Bez** modyfikacji innych plików śledzonych i bez naruszania nieśledzonych `.kilo/plans/*.md`.

Zatwierdzony scope: tylko `docs/TAKEOVER_CLEANUP_PLAN.md`. Dozwolone lokalnie: `git branch -m` (zmiana nazwy istniejącej lokalnej gałęzi T00 na `docs/takeover-cleanup-plan-stale-fedf3d7` — nie overwrite, nie force-push). Niedozwolone: `git reset --hard`, `git push --force`, `git push --force-with-lease`, usuwanie gałęzi zdalnych, modyfikacja `.kilo/plans/*.md`, merge PR #47/#59.

Acceptance criteria: 12 punktów z sekcji „Acceptance criteria".
Verification: komendy z sekcji „Verification".
Wymagania (skrót): bez ujawniania wartości `SECRET_KEY`; bez modyfikacji plików wymienionych w „Poza zakresem"; przy non-fast-forward STOP i raport diagnostyczny (bez force); raport końcowy rozróżnia tracked vs nieśledzony Kilo.

Pełny prompt Code Mode (przeznaczony do przekazania executorowi) znajduje się w sekcji „Code Mode prompt" poniżej.

## Code Mode prompt

```
Jesteś agentem implementacyjnym w trybie Code Mode. Wykonaj jedną
małą transzę T00 planu docs/TAKEOVER_CLEANUP_PLAN.md (który publikujesz
właśnie w tym PR) i nic więcej.

Wejście:
- Katalog roboczy: D:\gem\stunning-pancake
- Gałąź bazowa: origin/main (df2f5fe)
- Źródło treści master planu (nie modyfikuj):
  D:\gem\stunning-pancake\.kilo\plans\1789063741873-takeover-cleanup-plan.md
- Docelowa gałąź: docs/takeover-cleanup-plan
- Docelowy plik (jedyny w PR): docs/TAKEOVER_CLEANUP_PLAN.md

Wymagane korekty względem źródła:
1. Dodaj kolumnę „PR" w tabeli stanu (7. kolumna). Wartości:
   T00 = „ten PR", T01 = „#47", T21 = „#59", pozostałe = „—".
2. T00: STATUS=ACTIVE, gałąź docs/takeover-cleanup-plan.
3. T01: STATUS=BLOCKED, gałąź security/remove-committed-signing-key,
   Zależności: „kontynuacja #47 (Draft, APPROVE, BLOCKED — OWNER ACTION REQUIRED)".
4. T21: STATUS=ACTIVE, gałąź ci/mobile-path-filter-integrity.
5. Sekcja „Master plan – ordered execution": zamień pozycje 3 i 4
   (T21 mobile filter + test integrity przed T22 CI path routing
   + aggregate check).
6. Sekcja „Decyzje właściciela": dodaj jedną decyzję o rozróżnieniu
   statusu technicznego PR (APPROVE/Draft/green CI) od blokera
   właścicielskiego/środowiskowego.
7. Sekcja „Transza referencyjna – T01":
   - ścieżki repo-relative (bez „D:\gem\stunning-pancake\");
   - gałąź security/remove-committed-signing-key (nie
     security/signing-key-removal);
   - opis testów: (1) SECRET_KEY odrzucane dla placeholder/empty/null,
     (2) konfiguracja bez kluczy akceptowana,
     (3) JWT_SIGNING_KEY odrzucane niezależnie od wartości,
     (4) niepoprawny JSON zgłasza błąd;
   - w Risks: jawne „commitowana wartość nie może być ujawniona
     w diff/logach/PR".
8. Sekcje Out of scope, Acceptance criteria dla całego programu,
   Verification, Risks and rollback, Executor handoff: zachowaj
   bez zmian. NIE dodawaj do opublikowanego dokumentu żadnego
   wyjątku dotyczącego --force-with-lease (kwestia czysto operacyjna
   publikacji T00; nie wchodzi do dokumentu).

Kroki (każda komenda gotowa do wklejenia w PowerShell):

1. Weryfikacja środowiska (BEZ git fetch):
   git status --short
   git rev-parse origin/main
   git ls-remote origin refs/heads/main refs/pull/47/head refs/pull/47/merge refs/pull/59/head
   git branch --list docs/takeover-cleanup-plan
   git ls-remote origin refs/heads/docs/takeover-cleanup-plan

2. Obsługa istniejącej gałęzi T00:
   - Jeśli `git branch --list docs/takeover-cleanup-plan` zwraca niepuste:
     przełącz się na inny branch (np. security/remove-committed-signing-key)
     i wykonaj
     `git branch -m docs/takeover-cleanup-plan docs/takeover-cleanup-plan-stale-fedf3d7`.
     NIE używaj git reset --hard, git push --force, usuwania gałęzi.
   - Jeśli `git ls-remote origin refs/heads/docs/takeover-cleanup-plan`
     zwraca niepuste: ZATRZYMAJ SIĘ i zwróć diagnostykę
     (git rev-parse HEAD; git ls-remote origin refs/heads/docs/takeover-cleanup-plan;
      git merge-base origin/main docs/takeover-cleanup-plan;
      git diff origin/docs/takeover-cleanup-plan...HEAD --stat;
      gh pr list --head docs/takeover-cleanup-plan --state all).

3. `git switch -c docs/takeover-cleanup-plan origin/main`

4. Otwórz .kilo/plans/1789063741873-takeover-cleanup-plan.md,
   skopiuj treść, zastosuj korekty 1–8 i zapisz jako
   docs/TAKEOVER_CLEANUP_PLAN.md. NIE modyfikuj pliku źródłowego
   .kilo/plans/*.

5. Kontrola lokalna:
   git diff --check
   python scripts/check_docs_links.py
   python -c "import re; t=open('docs/TAKEOVER_CLEANUP_PLAN.md',encoding='utf-8').read(); block=t.split('## Stan planu',1)[1].split('## Out of scope',1)[0]; ids=re.findall(r'^\|\s*(T\d{2})\s*\|', block, re.M); assert len(ids)==60, f'rows={len(ids)}'; assert len(set(ids))==60, 'duplicates present'; print('V1 OK rows=', len(ids))"
   python -c "import re; t=open('docs/TAKEOVER_CLEANUP_PLAN.md',encoding='utf-8').read(); m=re.search(r'## Master plan . ordered execution(.+?)(?=^## )', t, re.S|re.M); lines=[l.strip() for l in m.group(1).splitlines() if re.match(r'^\d+\.\s+T\d{2}', l.strip())]; pos={l.split()[1]:int(l.split('.')[0]) for l in lines}; assert pos.get('T21') and pos.get('T22'), f'missing ids pos={pos}'; assert pos['T21'] < pos['T22'], pos; print('V2 OK T21=', pos['T21'], '< T22=', pos['T22'])"
   python -c "import re; t=open('docs/TAKEOVER_CLEANUP_PLAN.md',encoding='utf-8').read(); block=t.split('## Stan planu',1)[1].split('## Out of scope',1)[0]; rows=[r for r in block.splitlines() if r.startswith('| T')]; t01=next((r for r in rows if r.startswith('| T01 |')),''); t21=next((r for r in rows if r.startswith('| T21 |')),''); assert 'security/remove-committed-signing-key' in t01 and 'security/signing-key-removal' not in t01, ('T01 row', t01); assert 'ci/mobile-path-filter-integrity' in t21 and 'ci/mobile-filter-and-tests' not in t21, ('T21 row', t21); print('V3 OK')"
   python -c "t=open('docs/TAKEOVER_CLEANUP_PLAN.md',encoding='utf-8').read(); ref=t.split('Transza referencyjna',1)[1]; assert 'placeholder akceptowany' not in ref, 'stale placeholder language'; assert 'odrzucane' in ref, 'expected odrzucane'; print('V4 OK')"
   git status --short

6. git add docs/TAKEOVER_CLEANUP_PLAN.md
   git commit -m "docs: publish master takeover cleanup plan (T00)"
   git log -1 --format="%H %s"

7. PIERWSZA PRÓBA push = zwykła (BEZ --force, BEZ --force-with-lease):
   git push -u origin docs/takeover-cleanup-plan
   - Jeśli push się powiedzie: kontynuuj.
   - Jeśli push odmówi (non-fast-forward lub inny błąd):
     ZATRZYMAJ SIĘ. Zwróć diagnostykę:
       git rev-parse HEAD
       git ls-remote origin refs/heads/docs/takeover-cleanup-plan
       git merge-base origin/main docs/takeover-cleanup-plan
       git diff origin/docs/takeover-cleanup-plan...HEAD --stat
       gh pr list --head docs/takeover-cleanup-plan --state all
     NIE wykonuj --force, --force-with-lease, usuwania gałęzi,
     git reset --hard. Tylko właściciel może osobno zatwierdzić
     --force-with-lease po przejrzeniu diagnostyki.

8. Otwarcie PR (Draft):
   - Utwórz plik z opisem PR POZA repozytorium:
     sciezka: C:\Users\akarn\AppData\Local\Temp\kilo\t00-pr-body.md
     tresc (dosłownie, bez commitowanej wartości sekretu):

     ## T00 — publikacja master takeover cleanup plan

     Publikacja obowiązującego „4VELO — Master Cleanup Plan"
     (docs/TAKEOVER_CLEANUP_PLAN.md) na gałęzi docs/takeover-cleanup-plan
     opartej o origin/main (df2f5fe).

     ### Zakres PR
     - Jedyny śledzony plik w diff: docs/TAKEOVER_CLEANUP_PLAN.md.
     - Pełna lista transz T00–T59 (60 wierszy; brak skracania).
     - Korekta kolejności T21 przed T22 w sekcji
       „Master plan – ordered execution" (T22 zależy od T21).
     - Statusy: T00 = ACTIVE (ten PR), T01 = BLOCKED
       (PR #47, kontynuacja), T21 = ACTIVE (PR #59).
     - Nowa kolumna PR w tabeli stanu.

     ### Powiązane PR
     - #47 (T01, security/remove-committed-signing-key): Draft,
       APPROVE w Code Review, BLOCKED — OWNER ACTION REQUIRED
       (wymaga potwierdzenia/rotacji SECRET_KEY w Railway PRZED merge).
       Wartość commitowana NIE jest ujawniana w tym PR, w diff,
       w opisach ani w logach.
     - #59 (T21, ci/mobile-path-filter-integrity): Draft, mergeable,
       1 commit, 2 pliki, pełne zielone CI (19 checks).

     ### Poza zakresem
     - Kod produktu, workflow CI, zależności, lockfile,
       railway.json, Dockerfile*, infrastructure/k8s/*,
       mobile/app.config.js, mobile/eas.json, Firebase.
     - Merge #47 i #59.
     - Lokalne pliki .kilo/plans/*.md (pozostają nieśledzone
       i nietknięte).

     ### Weryfikacja wykonana przez executor
     - git diff --check: czyste.
     - python scripts/check_docs_links.py: bez nowych błędów.
     - V1–V4: 60 unikalnych ID T00–T59, T21 przed T22,
       nazwy gałęzi zgodne, opis testów zgodny z implementacją.
     - Working tree w plikach śledzonych: czysty poza dodanym
       docs/TAKEOVER_CLEANUP_PLAN.md. Nieśledzony .kilo/plans/*.md
       pozostaje nietknięty (nie w commicie).
     - Wartość SECRET_KEY: nie pojawia się w diff ani w opisie PR.

     ### Plan referencyjny
     .kilo/plans/1789069397861-t00-takeover-cleanup-plan.md

   - Komenda PR (Draft, z pliku tymczasowego):
     gh pr create --base main --head docs/takeover-cleanup-plan ^
       --title "docs: publish master takeover cleanup plan (T00)" ^
       --body-file "C:\Users\akarn\AppData\Local\Temp\kilo\t00-pr-body.md" ^
       --draft
   - Weryfikacja:
     gh pr view --json number,url,isDraft,baseRefName,headRefName,files
   - Po udanym otwarciu PR: usuń plik tymczasowy (rm / Remove-Item).

9. Raport końcowy:
   git diff origin/main...HEAD --stat
   git diff origin/main...HEAD -- docs/TAKEOVER_CLEANUP_PLAN.md | Select-Object -First 40
   git status --short
   Zwróć: gałąź, commit SHA, adres PR, wyniki V1–V4,
   wynik check_docs_links.py, wynik gh pr view,
   jawne potwierdzenie „wartość SECRET_KEY nie pojawiła się w diff
   ani w opisie PR", jawne potwierdzenie „.kilo/plans/*.md nietknięte
   (nieśledzone)", rozróżnienie tracked/untracked.

Zasady:
- BEZ git reset --hard, git commit --amend po push, git push --force,
  git push --force-with-lease (push ma być zwykły; non-ff = STOP).
- BEZ ujawniania wartości SECRET_KEY w diff, opisie PR, logach CI,
  commit message ani raporcie.
- BEZ modyfikacji .kilo/plans/*.md, docs/PROJECT_TAKEOVER.md,
  docs/TAKEOVER_WORK_QUEUE.md, docs/reports/*, backend/railway.json,
  scripts/check_config_secrets.py, scripts/test_check_config_secrets.py,
  .github/workflows/*, package.json, pnpm-lock.yaml, mobile/app.config.js,
  mobile/eas.json, infrastructure/k8s/*, Dockerfile*.
- BEZ merge PR #47 ani PR #59.
- BEZ rozszerzania scope; w razie rozbieżności — zatrzymaj się,
  opisz dowody i zapytaj.
```

## Open decisions

Brak istotnych nierozstrzygniętych decyzji; wszystkie blokujące kwestie
zidentyfikowane w poprzednich iteracjach zostały zaadresowane:

- HEAD PR #47 rozstrzygnięty (zdalny ref `c01c9b40`; lokalny cache
  `71d13de` nieaktualny).
- Rollback ograniczony do pojedynczego `git revert`.
- Wyjątek `--force-with-lease` usunięty z opublikowanego dokumentu.
- Pierwsza próba push = zwykła; non-fast-forward = STOP + diagnostyka.
- Komendy walidacyjne V1–V4 są PowerShell-ready (raw string `r'...'`,
  `;` literalny wewnątrz `"..."`, bez problematycznych metaznaków).
- Working tree: jawne rozróżnienie tracked clean vs nieśledzony Kilo.
- Gałąź: istniejąca lokalna → `git branch -m`; zdalna nie istnieje;
  brak overwrite, brak force-push.
- PR body: pełna treść w pliku tymczasowym poza repo, przekazana
  przez `--body-file` z bezpieczną ścieżką.
- Scope T00: dokładnie jeden śledzony plik w diff; bez zmian w kodzie,
  CI, zależnościach, dokumentach, `.kilo/plans/`.
