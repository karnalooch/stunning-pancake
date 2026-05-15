# 🔌 API Reference — Dokumentacja API

Kompletna referencja API platformy 4VELO — autoryzacja, endpointy, webhooks i odpowiedzi błędów.

---

## 📋 Przegląd

| Parametr | Wartość |
|----------|---------|
| Base URL | `https://<domena>/api/` |
| Format | JSON |
| Autoryzacja | JWT Bearer Token |
| Paginacja | PageNumberPagination (domyślnie 50) |
| Dokumentacja Swagger | `/api/docs/` |
| OpenAPI Schema | `/api/schema/` |

---

## 🔐 Autoryzacja (JWT)

### Uzyskanie tokena

```
POST /api/auth/token/
Content-Type: application/json

{
  "username": "global_owner",
  "password": "admin123"
}
```

**Odpowiedź:**
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

### Odświeżenie tokena

```
POST /api/auth/token/refresh/
Content-Type: application/json

{
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

**Odpowiedź:**
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

### Weryfikacja tokena

```
POST /api/auth/token/verify/
Content-Type: application/json

{
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

**Odpowiedź (200 OK):**
```json
{}
```

**Odpowiedź (401 Unauthorized):**
```json
{
  "detail": "Token is invalid or expired",
  "code": "token_not_valid"
}
```

### Użycie tokena w requestach

```bash
curl -H "Authorization: Bearer <access_token>" \
  https://<domena>/api/users/profile/
```

---

## 👤 User Endpoints

### Base URL: `/api/users/`

| Endpoint | Metoda | Opis | Wymagana rola |
|----------|--------|------|---------------|
| `/register/` | POST | Rejestracja nowego użytkownika | Public |
| `/profile/` | GET | Profil zalogowanego użytkownika | Authenticated |
| `/profile/` | PUT/PATCH | Aktualizacja profilu | Authenticated |
| `/password/change/` | POST | Zmiana hasła | Authenticated |
| `/password/reset/` | POST | Żądanie resetu hasła | Public |
| `/password/reset/confirm/` | POST | Potwierdzenie resetu hasła | Public |
| `/all/` | GET | Lista wszystkich użytkowników | GLOBAL_OWNER, TENANT_ADMIN |
| `/create/` | POST | Utworzenie użytkownika | GLOBAL_OWNER, TENANT_ADMIN |
| `/<id>/delete/` | DELETE | Usunięcie użytkownika | GLOBAL_OWNER, TENANT_ADMIN |
| `/impersonate/<id>/` | POST | Impersonacja użytkownika | GLOBAL_OWNER |
| `/tenants/all/` | GET | Lista tenantów | Authenticated |
| `/audit-log/` | GET | Logi audytowe | GLOBAL_OWNER |
| `/invitation/` | POST | Wysłanie zaproszenia | GLOBAL_OWNER, TENANT_ADMIN |
| `/branding/<tenant_id>/` | GET | Branding tenantu | Public |
| `/branding/<id>/update/` | PUT/PATCH | Aktualizacja brandingu | GLOBAL_OWNER, TENANT_ADMIN |

### Rejestracja

```
POST /api/users/register/
Content-Type: application/json

{
  "username": "new_user",
  "email": "user@example.com",
  "password": "secure_password",
  "tenant_id": "uuid-tenant-id"
}
```

### Profil użytkownika

```
GET /api/users/profile/
Authorization: Bearer <token>
```

**Odpowiedź:**
```json
{
  "id": 1,
  "username": "global_owner",
  "email": "admin@4velo.app",
  "role": "GLOBAL_OWNER",
  "tenant_id": null,
  "is_premium": false,
  "avatar": "https://<domena>/media/avatars/avatar.jpg",
  "bio": "Administrator platformy"
}
```

### Impersonacja

```
POST /api/users/impersonate/<target_user_id>/
Authorization: Bearer <token>
```

**Odpowiedź:**
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "impersonated": true,
  "impersonator_id": 1
}
```

---

## 🏃 Activity Endpoints

### Base URL: `/api/activities/`

| Endpoint | Metoda | Opis | Wymagana rola |
|----------|--------|------|---------------|
| `/sessions/` | GET | Lista aktywności użytkownika | Authenticated |
| `/sessions/` | POST | Utworzenie aktywności | Authenticated |
| `/sessions/<id>/` | GET | Szczegóły aktywności | Authenticated |
| `/sessions/<id>/` | PUT/PATCH | Aktualizacja aktywności | Owner, Admin |
| `/sessions/<id>/` | DELETE | Usunięcie aktywności | Owner, Admin |
| `/privacy-zones/` | GET | Lista stref prywatności | Authenticated |
| `/privacy-zones/` | POST | Utworzenie strefy prywatności | Authenticated |
| `/pois/` | GET | Lista punktów POI | Authenticated |
| `/pois/` | POST | Utworzenie POI | TENANT_ADMIN, SPONSOR |
| `/vouchers/redeem/<code>/` | POST | Redeem vouchera | Authenticated |
| `/telemetry/live/` | GET | Live telemetry (WebSocket) | Authenticated |
| `/telemetry/anomalies/` | GET | Lista anomalii | Authenticated |
| `/telemetry/config/` | GET | Konfiguracja telemetrii | Authenticated |
| `/telemetry/config/` | POST | Aktualizacja konfiguracji | Authenticated |

### Wearables

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/wearables/strava/auth/` | GET | URL autoryzacji Strava |
| `/wearables/strava/callback/` | GET | Callback Strava OAuth |
| `/wearables/garmin/auth/` | GET | URL autoryzacji Garmin |
| `/wearables/garmin/callback/` | GET | Callback Garmin OAuth |
| `/wearables/sync/` | POST | Manualna synchronizacja |

### Admin Activities

| Endpoint | Metoda | Opis | Wymagana rola |
|----------|--------|------|---------------|
| `/admin/all/` | GET | Wszystkie aktywności (global) | GLOBAL_OWNER |
| `/admin/tenant/` | GET | Aktywności tenantu | TENANT_ADMIN, TENANT_MODERATOR |
| `/admin/stats/` | GET | Statystyki dashboardu | TENANT_ADMIN+ |
| `/admin/approve/<id>/` | POST | Zatwierdzenie aktywności | TENANT_ADMIN, TENANT_MODERATOR |
| `/admin/reject/<id>/` | POST | Odrzucenie aktywności | TENANT_ADMIN, TENANT_MODERATOR |

### Leaderboard

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/leaderboard/<city_id>/` | GET | Ranking miasta |
| `/leaderboard/<city_id>/me/` | GET | Moja pozycja w rankingu |

### Analytics

| Endpoint | Metoda | Opis | Wymagana rola |
|----------|--------|------|---------------|
| `/heatmap/` | GET | Heatmap aktywności | Authenticated |
| `/analytics/` | GET | Podsumowanie analityki | Premium users |

### Beta Feedback

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/beta-feedback/` | POST | Utworzenie feedbacku |
| `/beta-feedback/list/` | GET | Lista feedbacków |
| `/beta-feedback/<id>/resolve/` | POST | Rozwiązanie feedbacku |

---

## 🏢 Tenant Endpoints

### Base URL: `/api/users/tenants/`

| Endpoint | Metoda | Opis | Wymagana rola |
|----------|--------|------|---------------|
| `/all/` | GET | Lista wszystkich tenantów | Authenticated |

### Model Tenant

```json
{
  "id": "uuid",
  "name": "Warsaw",
  "logo": "https://<domena>/media/tenants/logo.png",
  "primary_color": "#00d2ff",
  "secondary_color": "#92fe9d",
  "is_active": true,
  "max_users": 1000,
  "has_heatmap_analytics": true,
  "white_label_domain": "warsaw.4velo.app",
  "config_json": {},
  "created_at": "2026-01-01T00:00:00Z"
}
```

---

## 🛡️ RBAC Endpoints

### Base URL: `/api/users/rbac/`

| Endpoint | Metoda | Opis | Wymagana rola |
|----------|--------|------|---------------|
| `/permissions/` | GET | Lista uprawnień | Authenticated |
| `/permissions/by_resource/` | GET | Uprawnienia po zasobie | Authenticated |
| `/roles/` | GET | Lista ról | GLOBAL_OWNER |
| `/roles/` | POST | Utworzenie roli | GLOBAL_OWNER |
| `/roles/<id>/` | GET | Szczegóły roli | GLOBAL_OWNER |
| `/roles/<id>/` | PUT/PATCH | Edycja roli | GLOBAL_OWNER |
| `/roles/<id>/` | DELETE | Usunięcie roli | GLOBAL_OWNER |
| `/user-roles/` | GET | Lista przypisań ról | TENANT_ADMIN+ |
| `/user-roles/` | POST | Przypisanie roli | TENANT_ADMIN+ |
| `/user-roles/<id>/` | DELETE | Usunięcie przypisania | TENANT_ADMIN+ |
| `/user-roles/<id>/revoke/` | POST | Cofnięcie roli | TENANT_ADMIN+ |
| `/user-roles/my_roles/` | GET | Moje role | Authenticated |

---

## 🏛️ Department Endpoints

### Base URL: `/api/users/departments/`

| Method | Endpoint | Permission |
|--------|----------|------------|
| GET | `/api/users/departments/` | `departments.view` |
| POST | `/api/users/departments/` | `departments.create` |
| PUT | `/api/users/departments/{id}/` | `departments.edit` |
| DELETE | `/api/users/departments/{id}/` | `departments.delete` |
| GET | `/api/users/departments/tree/` | `departments.view` |
| GET | `/api/users/departments/my/` | Authenticated |
| GET | `/api/users/departments/{id}/users/` | `departments.view_users` |
| POST | `/api/users/departments/{id}/assign/` | `departments.assign_users` |
| POST | `/api/users/departments/{id}/remove/` | `departments.remove_users` |

---

## 🏆 Leaderboard Endpoints

### Base URL: `/api/activities/leaderboard/`

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/<city_id>/` | GET | Ranking miasta (TOP 100) |
| `/<city_id>/me/` | GET | Pozycja zalogowanego użytkownika |

**Odpowiedź — ranking miasta:**
```json
{
  "city_id": "warsaw",
  "leaderboard": [
    {"rank": 1, "user_id": 42, "username": "cyclist_pro", "distance_km": 1250.5},
    {"rank": 2, "user_id": 15, "username": "runner_fast", "distance_km": 980.2}
  ]
}
```

---

## 🪝 Webhook Endpoints

### Stripe Webhook

```
POST /api/activities/payments/webhook/
Content-Type: application/json
Stripe-Signature: whsec_...
```

**Obsługiwane eventy:**
- `checkout.session.completed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

### Stripe Checkout

```
POST /api/activities/payments/checkout/
Authorization: Bearer <token>
Content-Type: application/json

{
  "price_id": "price_xxx",
  "success_url": "https://<domena>/success",
  "cancel_url": "https://<domena>/cancel"
}
```

**Odpowiedź:**
```json
{
  "session_id": "cs_test_xxx",
  "url": "https://checkout.stripe.com/pay/cs_test_xxx"
}
```

---

## 📡 Infrastructure Health

| Endpoint | Metoda | Opis | Wymagana rola |
|----------|--------|------|---------------|
| `/api/infra/health/` | GET | Ogólny health check | Authenticated |
| `/api/infra/health/redis/` | GET | Health Redis | Authenticated |
| `/api/infra/health/citus/` | GET | Health Citus | Authenticated |

**Odpowiedź:**
```json
{
  "status": "healthy",
  "services": {
    "database": "ok",
    "redis": "ok",
    "celery": "ok"
  }
}
```

---

## 🔗 Matrix E2EE Verification

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/matrix/verify/initiate/` | POST | Inicjacja weryfikacji |
| `/api/matrix/verify/accept/` | POST | Akceptacja weryfikacji |
| `/api/matrix/verify/confirm/` | POST | Potwierdzenie weryfikacji |
| `/api/matrix/verify/status/` | GET | Status weryfikacji |

---

## 🤖 LLM Proxy

```
POST /api/llm/proxy/
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "Jak poprawić mój wynik?",
  "context": {"distance_km": 50, "avg_speed": 25}
}
```

---

## ❌ Odpowiedzi błędów

### Standardowy format błędu

```json
{
  "detail": "Opis błędu",
  "code": "error_code"
}
```

### Kody błędów

| Kod HTTP | Opis | Przykład |
|----------|------|----------|
| `400` | Bad Request — niepoprawne dane | Błędne dane w formularzu |
| `401` | Unauthorized — brak autoryzacji | Brak tokena, wygasły token |
| `403` | Forbidden — brak uprawnień | Użytkownik nie ma uprawnień |
| `404` | Not Found — zasób nie istnieje | Nieznany ID użytkownika |
| `409` | Conflict — konflikt | Duplicate entry |
| `500` | Internal Server Error | Błąd serwera |

### Przykłady

**401 Unauthorized:**
```json
{
  "detail": "Authentication credentials were not provided.",
  "code": "not_authenticated"
}
```

**403 Forbidden:**
```json
{
  "detail": "You do not have permission to perform this action.",
  "code": "permission_denied"
}
```

**400 Bad Request:**
```json
{
  "username": ["This field is required."],
  "email": ["Enter a valid email address."]
}
```

---

## 📄 Paginacja

Wszystkie listy używają paginacji:

```json
{
  "count": 150,
  "next": "https://<domena>/api/activities/sessions/?page=2",
  "previous": null,
  "results": [...]
}
```

### Parametry paginacji

| Parametr | Opis | Domyślna | Max |
|----------|------|----------|-----|
| `page` | Numer strony | 1 | — |
| `page_size` | Liczba wyników na stronę | 50 | 500 |

---

> **Zobacz także:** [🛡️ RBAC Guide](./RBAC.md) — system uprawnień  
> **Zobacz także:** [📡 Swagger Docs](http://localhost:8000/api/docs/) — interaktywna dokumentacja
