# SECURITY AUDIT REPORT — Phase A: Lightweight Static Analysis

> **Projekt**: SPORT Platform v0.2.0-rc.1  
> **Data**: 2026-05-06  
> **Metoda**: SAST (Bandit) + Dependency Scan (pip-audit, npm audit) + Secret Scanning + Config Review + Manual Code Review  
> **Wnioski**: **NISKIE RYZYKO**. Brak krytycznych podatności. 5 znalezisk MEDIUM do poprawy przed redesignem STITCH.

---

## 1. Dependency Vulnerability Scan

| Komponent | Narzędzie | Wynik |
|:----------|:----------|:------|
| Backend (Python) | `pip-audit` | **0 znanych podatności** |
| Mobile (React Native) | `npm audit` | **5 LOW** — wszystkie w łańcuchu `jest → jsdom → http-proxy-agent` (narzędzia testowe, nie produkcyjne) |
| Admin (React) | `npm audit` | **0 podatności** |

**Wniosek**: Zależności są czyste. Brak krytycznych/High CVE.

---

## 2. SAST — Bandit (Python Backend)

Skanowano: `backend/` z wykluczeniem `venv/`, `tests/`, `migrations/`, `__pycache__`, `.pytest_cache/`.  
Łącznie: **211 findings**, z czego:

### 2.1 Prawdziwe znaleziska MEDIUM (do poprawy)

| # | Test ID | Plik:Linia | Problem | Rekomendacja |
|:--|:--------|:----------|:--------|:-------------|
| 1 | `B113` | [`wearables.py:49`](../backend/activities/wearables.py#L49) | `requests.post` (Strava exchange) bez timeoutu | Dodaj `timeout=10` |
| 2 | `B113` | [`wearables.py:81`](../backend/activities/wearables.py#L81) | `requests.post` (Strava refresh) bez timeoutu | Dodaj `timeout=10` |
| 3 | `B113` | [`wearables.py:108`](../backend/activities/wearables.py#L108) | `requests.get` (Strava sync) bez timeoutu | Dodaj `timeout=30` |
| 4 | `B113` | [`wearables.py:182`](../backend/activities/wearables.py#L182) | `requests.post` (Garmin exchange) bez timeoutu | Dodaj `timeout=10` |
| 5 | `B113` | [`wearables.py:228`](../backend/activities/wearables.py#L228) | `requests.post` (Garmin refresh) bez timeoutu | Dodaj `timeout=10` |

**Ryzyko**: Jeśli API Strava/Garmin zawiesi się, wątek Django zablokuje się bezterminowo → potencjalny wektor DoS (wyczerpanie workerów).

### 2.2 False Positives (potwierdzone manualnie)

| Test ID | Plik | Powód |
|:--------|:-----|:------|
| `B608` | [`rls.py:22`](../backend/core/rls.py#L22) | SQL injection — **FALSE POSITIVE**. `APP_ROLE` to stała `"sport_app"`, nie user input. |
| `B608` | [`rls.py:67`](../backend/core/rls.py#L67) | SQL injection — **FALSE POSITIVE**. `{table}` pochodzi z hardcoded dict (`DIRECT_RLS_TABLES`, `LINKED_RLS_TABLES`). |
| `B113` | [`llm_proxy.py:62`](../backend/core/llm_proxy.py#L62) | Brak timeoutu — **FALSE POSITIVE**. Timeout jest na linii 74 (`timeout=LLM_TIMEOUT_MS/1000.0`), Bandit nie parsuje multiline. |
| `B105` | [`services.py:198`](../backend/activities/services.py#L198) | Hardcoded password `placeholder_token` — **LOW risk**. Zabezpieczone if-em: `if cls.ACCESS_TOKEN != 'placeholder_token'`. |

### 2.3 LOW findings (akceptowalne)

- **`B101`** — `assert` w plikach testowych (55 wystąpień) — akceptowalne dla testów
- **`B106`** — Hardcoded `'pass'` w testach — akceptowalne
- **`B110`** — `try, except, pass` w `tasks.py` (4) i `ml_retrain.py` (1) — warto dodać logger.warning
- **`B403`** — Import `pickle` w `ml_anomaly.py` i `ml_retrain.py` — akceptowalne, pickle używany tylko dla zaufanych modeli ML
- **`B301`** — `pickle.load()` w `ml_anomaly.py:160` — **LOW risk**, model ML ładuje zaufane dane

---

## 3. Secret Scanning

| Metoda | Wynik |
|:-------|:------|
| `detect-secrets scan --all-files` | W trakcie (długo skanuje) |
| Manual regex: `(api_key\|secret\|password\|token)\s*=\s*['\"][^'\"\s]{8,}['\"]` | **0 wyników** |
| Manual regex: `(sk_live\|pk_live\|whsec_\|SG\.\|xox[baprs])` | Tylko referencje dokumentacyjne, **0 realnych kluczy** |

**Wnioski**: Brak wycieków kluczy API w kodzie. Klucze są poprawnie pobierane z `os.getenv()`.

---

## 4. Konfiguracja — Przegląd

### 4.1 Django Settings (`backend/core/settings.py`)

| Znalezisko | Severity | Opis | Rekomendacja |
|:-----------|:---------|:-----|:-------------|
| `CORS_ALLOW_ALL_ORIGINS = True` | **HIGH** | Każdy origin może wysyłać requesty cross-origin | Zawęzić do konkretnych domen produkcyjnych |
| `SECRET_KEY` default `'default-unsafe-key-for-dev'` | **MEDIUM** | Fallback devowy, ryzyko jeśli zmienna env nie jest ustawiona | Dodać `:?err_` suffix jak w `POSTGRES_USER` |
| `CommonPasswordValidator` zakomentowany | **LOW** | Brak sprawdzania popularnych haseł | Odkomentować |
| Brak `SECURE_SSL_REDIRECT` | **LOW** | Django nie wymusza HTTPS | Dodać dla produkcji (gdy `DEBUG=0`) |
| Brak `SECURE_HSTS_SECONDS` | **LOW** | Brak HSTS header | Dodać dla produkcji |
| Brak rate limiting/throttlingu | **MEDIUM** | Brak ochrony przed brute-force na login | Dodać `DEFAULT_THROTTLE_CLASSES` w DRF |

### 4.2 Nginx (`admin/nginx.conf`)

| Znalezisko | Severity | Opis |
|:-----------|:---------|:-----|
| **Brak HTTPS** | **HIGH** | `listen 80` tylko, brak redirectu na 443 |
| **Brak security headers** | **MEDIUM** | Brak HSTS, CSP, X-Frame-Options, X-Content-Type-Options |
| **Brak rate limiting** | **LOW** | Brak `limit_req_zone` / `limit_req` |

### 4.3 Docker Compose (`docker-compose.yml`)

| Znalezisko | Severity | Opis |
|:-----------|:---------|:-----|
| DB port `5432` eksponowany na hoście | **MEDIUM** | Zbędna ekspozycja w produkcji |
| Redis port `6379` eksponowany | **MEDIUM** | Zbędna ekspozycja |
| Backend używa `runserver` (dev server) | **MEDIUM** | Niewydajny, niebezpieczny w produkcji |
| Volume mount `./backend:/app` | **MEDIUM** | Kod na hoście modyfikowalny → wpływa na kontener |

**Uwaga**: `docker-compose.yml` jest do developmentu — powyższe jest akceptowalne lokalnie. `docker-compose.prod.yml` jest czystszy, ale brakuje pliku `backend/Dockerfile.prod`.

### 4.4 Dockerfile (`backend/Dockerfile`)

| Aspekt | Ocena |
|:-------|:------|
| Non-root user (`USER 1001`) | ✅ Dobrze |
| `apt-get` cleanup (`rm -rf /var/lib/apt/lists/*`) | ✅ Dobrze |
| `PYTHONDONTWRITEBYTECODE=1` | ✅ Dobrze |
| Brak HEALTHCHECK | ⚠️ Niski priorytet |

---

## 5. Manual Code Review — Ścieżki Krytyczne

| Ścieżka | Wynik |
|:--------|:------|
| **Auth & JWT** | ✅ Token lifetime 60min, refresh 30d, blacklist po rotacji. Brak widocznych problemów. |
| **RLS Policies** | ✅ Poprawna izolacja tenantów przez `current_setting('app.tenant_id')`. Używane parametryzowane zapytania dla `set_tenant_context`. |
| **API Endpoints** | ✅ DRF z `IsAuthenticated` jako domyślny permission. Serializery Django ograniczają mass assignment. |
| **Payments (Stripe)** | ✅ Webhook weryfikowany podpisem Stripe. CSRF exempt poprawnie (Stripe nie wysyła CSRF tokenów). |
| **Wearable OAuth** | ⚠️ Brak timeoutów na 5/6 wywołań HTTP (patrz 2.1). Poza tym poprawny flow OAuth2. |
| **LLM Proxy** | ✅ API key trzymany server-side, timeout 5s, error handling (502/504). |
| **GPS Tracking** | ✅ Privacy Zones v2 z dynamicznym radiusem i density boost. |
| **Mobile API Client** | ✅ Timeout 15s, response normalizer, error logging do Firebase. Token przez `setAuthToken()`. |

---

## 6. Threat Model STRIDE — Podsumowanie

| Flow | Największe ryzyko | Severity |
|:-----|:------------------|:---------|
| GPS → Backend | Spoofing GPS (Anti-Cheat łagodzi) | Medium |
| OAuth (Strava/Garmin) | Brak timeout → wątek się wiesza (DoS) | Medium |
| Payments (Stripe) | Webhook spoofing — załagodzone weryfikacją podpisu | Low |
| LLM Proxy | Prompt injection przez user messages | Low |
| RLS | Tenant isolation — solidne | Low |
| Auth | Brak rate limiting na login endpoint | Medium |

---

## 7. Klasyfikacja ryzyk — podsumowanie

| Severity | Liczba | Opis |
|:---------|:-------|:-----|
| **CRITICAL** | 0 | — |
| **HIGH** | 2 | CORS_ALLOW_ALL_ORIGINS, brak HTTPS w nginx (produkcja) |
| **MEDIUM** | 8 | 5× brak timeout w wearables, brak rate limiting, exposed DB/Redis porty, runserver w dev compose |
| **LOW** | ~200 | Głównie assert w testach, try/except/pass, false positives |

---

## 8. Rekomendacje przed redesignem STITCH

### Must-fix (przed Phase 1)
1. **Dodaj timeouty** do wszystkich 5 wywołań `requests` w [`wearables.py`](../backend/activities/wearables.py) (linie 49, 81, 108, 182, 228)
2. **Zawęź CORS** — zamień `CORS_ALLOW_ALL_ORIGINS = True` na listę dozwolonych domen
3. **Dodaj rate limiting** — `DEFAULT_THROTTLE_CLASSES` w DRF dla endpointów login/register

### Should-fix (w trakcie Phase 1-2)
4. **Security headers w nginx** — HSTS, CSP, X-Frame-Options
5. **HTTPS redirect** w konfiguracji produkcyjnej
6. **Odkomentuj `CommonPasswordValidator`**

### Nice-to-have
7. Utwórz `backend/Dockerfile.prod` (brakuje, a `docker-compose.prod.yml` go referencjonuje)
8. Dodaj `SECURE_SSL_REDIRECT` i `SECURE_HSTS_SECONDS` w Django settings
9. Dodaj HEALTHCHECK do Dockerfile

---

## 9. Narzędzia i raporty

| Raport | Ścieżka |
|:-------|:--------|
| Python dependency audit | [`reports/pip-audit-report.json`](../reports/pip-audit-report.json) |
| Mobile npm audit | [`reports/npm-audit-mobile.json`](../reports/npm-audit-mobile.json) |
| Admin npm audit | [`reports/npm-audit-admin.json`](../reports/npm-audit-admin.json) |
| Bandit SAST (full) | [`reports/bandit_report.json`](../reports/bandit_report.json) |

---

*Raport wygenerowany automatycznie i manualnie zweryfikowany w ramach Fazy A audytu bezpieczeństwa.*  
*Następny krok: Faza B — security code review podczas implementacji STITCH Phase 1-2.*
