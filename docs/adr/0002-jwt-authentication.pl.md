# ADR-0002: Uwierzytelnianie JWT zamiast uwierzytelniania sesyjnego

**Status**: Zaakceptowany  
**Data**: 2026-04-24  
**Autor**: akarn  

---

## Kontekst

Platforma SPORT posiada trzech różnych klientów korzystających z API:
1. **Panel Administracyjny** (React SPA, przeglądarka)
2. **Aplikacja Mobilna** (Flutter, iOS + Android)
3. **Przyszłe webhooki B2B** (serwer-serwer)

Domyślne `SessionAuthentication` Django działa dobrze dla przepływów opartych na przeglądarce, ale jest nieodpowiednie dla klientów mobilnych — wymaga zarządzania ciasteczkami, tokenów CSRF i przechowywania sesji po stronie serwera, co nie skaluje się horyzontalnie.

## Decyzja

Przyjmujemy **JSON Web Tokens (JWT)** poprzez `djangorestframework-simplejwt` jako jedyny mechanizm uwierzytelniania dla wszystkich konsumentów API.

Kluczowe wybory konfiguracyjne:
- **Czas życia tokena dostępu (Access token)**: 60 minut (krótki, minimalizuje okno ekspozycji)
- **Czas życia tokena odświeżania (Refresh token)**: 30 dni (długi, unika częstego ponownego logowania na urządzeniach mobilnych)
- **Rotacja przy odświeżaniu**: Włączona (`ROTATE_REFRESH_TOKENS = True`)
- **Czarna lista po rotacji**: Włączona (`BLACKLIST_AFTER_ROTATION = True`) — unieważnia stare tokeny odświeżania po stronie serwera po każdym użyciu
- **Algorytm**: HS256 (akceptowalny dla backendu single-tenant; przejście na RS256, jeśli wymagane będzie SSO z wieloma wystawcami)

Autoryzacja społecznościowa (Google OAuth2) jest obsługiwana przez `django-allauth`, który wystawia sesję Django, natychmiast wymienianą na parę JWT poprzez dedykowany punkt końcowy wymiany.

## Konsekwencje

**Pozytywne:**
- Klienci mobilni bezpiecznie przechowują tokeny w `FlutterSecureStorage` (AES-256 na Androidzie, Keychain na iOS).
- API jest w pełni bezstanowe (stateless) — skalowanie horyzontalne bez konieczności stosowania lepkości sesji (sticky sessions).
- Ładunek tokena (payload) zawiera `user_id`, `role`, `tenant_id` — eliminuje dodatkowe zapytania do bazy danych dla podstawowych kontroli RBAC.

**Negatywne:**
- Tokeny dostępu nie mogą zostać unieważnione przed wygaśnięciem (okno 60 minut). Łagodzone przez krótki czas życia.
- Tabela czarnej listy tokenów odświeżania (`token_blacklist_*`) wymaga okresowego czyszczenia (zadanie celery beat).

## Rozważane Alternatywy

| Opcja | Dlaczego odrzucona |
|-------|--------------------|
| Uwierzytelnianie sesyjne | Nie nadaje się dla natywnych aplikacji mobilnych (złożoność obsługi ciasteczek) |
| Pełny serwer OAuth2 | Zbyt rozbudowany dla obecnej skali; dodaje złożoność `django-oauth-toolkit` |
| Klucze API | Odpowiednie dla B2B, ale nie dla przepływów mobilnych użytkownika końcowego |
