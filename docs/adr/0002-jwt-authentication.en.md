# ADR-0002: JWT Authentication over Session-Based Auth

**Status**: Accepted  
**Date**: 2026-04-24  
**Author**: akarn  

---

## Context

The SPORT platform has three distinct clients consuming the API:
1. **Admin Dashboard** (React SPA, browser)
2. **Mobile App** (Flutter, iOS + Android)
3. **Future B2B webhooks** (server-to-server)

Django's default `SessionAuthentication` works well for browser-based flows but is unsuitable for mobile clients — it requires cookie management, CSRF tokens, and server-side session storage that does not scale horizontally.

## Decision

We adopt **JSON Web Tokens (JWT)** via `djangorestframework-simplejwt` as the sole authentication mechanism for all API consumers.

Key configuration choices:
- **Access token lifetime**: 60 minutes (short, minimises exposure window)
- **Refresh token lifetime**: 30 days (long, avoids frequent re-logins on mobile)
- **Rotation on refresh**: Enabled (`ROTATE_REFRESH_TOKENS = True`)
- **Blacklist on rotation**: Enabled (`BLACKLIST_AFTER_ROTATION = True`) — invalidates old refresh tokens server-side after each use
- **Algorithm**: HS256 (acceptable for single-tenant backend; upgrade to RS256 if multi-issuer SSO required)

Social auth (Google OAuth2) is handled by `django-allauth` which issues a Django session that is immediately exchanged for a JWT pair via a dedicated exchange endpoint.

## Consequences

**Positive:**
- Mobile clients store tokens securely in `FlutterSecureStorage` (AES-256 on Android, Keychain on iOS).
- API is fully stateless — horizontal scaling without sticky sessions.
- Token payload carries `user_id`, `role`, `tenant_id` — eliminates DB round-trips for basic RBAC checks.

**Negative:**
- Access tokens cannot be invalidated before expiry (60 min window). Mitigated by short lifetime.
- Refresh token blacklist table (`token_blacklist_*`) requires periodic cleanup (celery beat task to add).

## Alternatives Considered

| Option | Why Rejected |
|--------|-------------|
| Session auth | Not viable for native mobile (cookie handling complexity) |
| OAuth2 full server | Overkill for current scale; adds `django-oauth-toolkit` complexity |
| API keys | Suitable for B2B but not end-user mobile flows |
