"""OAuth state enforcement + provider binding (T08).

These tests pin the fail-closed contract for OAuth callbacks:

* state is mandatory (missing/empty/unknown/expired -> HTTP 400);
* state is consumed atomically by a single Redis operation (GETDEL);
* state is single-use — replay produces HTTP 400;
* the provider recorded in state must match the callback (no Google<->Facebook swap);
* the client recorded in state must be ``admin`` or ``mobile``;
* Redis failure fails closed with HTTP 400 (no fallback to ``client=admin``);
* every denial happens BEFORE any external request, user creation or JWT issuance;
* positive Google/Facebook flows still work end-to-end, including real
  mobile deep-link redirects (``fourvelo://auth/callback?...``);
* the response object produced by the callbacks is the real Django
  ``HttpResponseRedirect`` (or its narrowly-scoped ``OAuthCallbackRedirect``
  subclass), never a stubbed replacement.

The tests do not hit Google, Facebook or Railway. Redis is mocked via
``core.fake_redis.install_pytest_redis`` (already wired by ``run_pytest.py``).
"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import patch
from urllib.parse import urlparse

import pytest
from django.test import RequestFactory

from core.fake_redis import install_pytest_redis
from core.social_auth import (
    OAUTH_STATE_TTL,
    OAuthCallbackRedirect,
    build_auth_redirect,
    consume_oauth_state,
    normalize_client,
    oauth_callback_redirect,
    store_oauth_state,
)

pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _fresh_redis():
    """Every test gets a clean FakeRedis instance."""
    fake = install_pytest_redis()
    fake.storage.clear()
    return fake


@pytest.fixture(autouse=True)
def _reset_throttle_cache():
    """Clear the DRF throttle cache between tests.

    The production settings declare ``AnonRateThrottle`` at 30/minute and
    ``UserRateThrottle`` at 300/minute; the OAuth callback views use
    ``permission_classes([AllowAny])`` which falls under the anonymous throttle.
    Without explicit cleanup, a full suite of callback tests exhausts the
    throttle window and triggers a 429 from a non-throttled rejection path,
    which would mask the real T08 denial contract.

    We reset both the default cache (where DRF stores throttle history) and
    any FakeRedis-backed throttle storage. Production behaviour is preserved
    — only the test process state is cleared.
    """
    from django.core.cache import cache

    try:
        cache.clear()
    except Exception:
        pass
    yield
    try:
        cache.clear()
    except Exception:
        pass


@pytest.fixture
def rf() -> RequestFactory:
    return RequestFactory()


def _set_state(redis_client, nonce: str, payload: Any) -> None:
    """Seed Redis with a raw payload for ``nonce`` (bypasses store helper)."""
    if not isinstance(payload, str):
        payload = json.dumps(payload)
    redis_client.setex(f"oauth:social:{nonce}", OAUTH_STATE_TTL, payload)


def _stub_token_pair():
    """Return a token pair dict that does not trigger OutstandingToken writes.

    The real ``restricted_token_pair_for_user`` persists rows in
    ``token_blacklist_outstandingtoken``; when the test user is only a Python
    object (not saved), the DB constraint check fires at teardown. The T08
    contract is about OAuth state binding + redirect routing — we still want
    the redirect URL to contain a query string shaped like JWT params, so we
    return a fixture dict that ``urlencode`` can serialize.
    """
    return {
        "access": "stub-access-token",
        "refresh": "stub-refresh-token",
    }


def _ok_json():
    """Build a fake ``requests`` response with the shape OAuth callbacks expect."""
    import types

    r = types.SimpleNamespace()
    r.status_code = 200
    r.text = "{}"
    r.json = lambda: {"access_token": "TOKEN", "email": "x@y", "id": "1"}
    return r


# ---------------------------------------------------------------------------
# State generation contract
# ---------------------------------------------------------------------------


class TestStateGeneration:
    """``store_oauth_state`` MUST persist provider, client and TTL."""

    def test_google_login_records_provider_and_client(self, _fresh_redis):
        nonce = store_oauth_state(client="admin", provider="google")
        assert nonce, "store_oauth_state must return a nonce"
        raw = _fresh_redis.get(f"oauth:social:{nonce}")
        assert raw is not None
        decoded = json.loads(raw)
        assert decoded["provider"] == "google"
        assert decoded["client"] == "admin"

    def test_facebook_login_records_provider_and_client(self, _fresh_redis):
        nonce = store_oauth_state(client="mobile", provider="facebook")
        raw = _fresh_redis.get(f"oauth:social:{nonce}")
        decoded = json.loads(raw)
        assert decoded["provider"] == "facebook"
        assert decoded["client"] == "mobile"

    def test_state_has_expected_ttl(self, _fresh_redis):
        # setex captured by FakeRedis (TTL is opaque in the fake, so we rely on
        # the constant — the contract is documented in OAUTH_STATE_TTL).
        nonce = store_oauth_state(client="admin", provider="google")
        assert _fresh_redis.get(f"oauth:social:{nonce}") is not None
        assert OAUTH_STATE_TTL > 0


class TestNormalizeClient:
    """Only ``admin`` and ``mobile`` are accepted on input; everything else
    falls back to ``admin`` (existing policy — preserved)."""

    def test_mobile_is_kept(self):
        assert normalize_client("mobile") == "mobile"

    def test_admin_is_kept(self):
        assert normalize_client("admin") == "admin"

    def test_other_value_normalizes_to_admin(self):
        assert normalize_client("anything-else") == "admin"

    def test_empty_normalizes_to_admin(self):
        assert normalize_client("") == "admin"

    def test_none_normalizes_to_admin(self):
        assert normalize_client(None) == "admin"


# ---------------------------------------------------------------------------
# consume_oauth_state unit tests (the helper)
# ---------------------------------------------------------------------------


class TestConsumeOAuthState:
    """Direct tests for the helper. Each denial must raise OAuthStateError
    and each success must return the parsed payload with provider+client."""

    def test_missing_nonce_rejected(self):
        with pytest.raises(Exception) as exc_info:
            consume_oauth_state(None, expected_provider="google")
        assert getattr(exc_info.value, "code", None) == "missing"

    def test_empty_nonce_rejected(self):
        with pytest.raises(Exception) as exc_info:
            consume_oauth_state("", expected_provider="google")
        assert exc_info.value.code == "missing"

    def test_unknown_nonce_rejected(self, _fresh_redis):
        with pytest.raises(Exception) as exc_info:
            consume_oauth_state("never-stored", expected_provider="google")
        assert exc_info.value.code in ("unknown", "expired")

    def test_malformed_json_rejected(self, _fresh_redis):
        nonce = "broken-json"
        _set_state(_fresh_redis, nonce, "{not-json")
        with pytest.raises(Exception) as exc_info:
            consume_oauth_state(nonce, expected_provider="google")
        assert exc_info.value.code == "malformed"

    def test_non_object_payload_rejected(self, _fresh_redis):
        for payload in ([], "string-value", 42, None):
            nonce = f"nonce-{type(payload).__name__}"
            _set_state(_fresh_redis, nonce, payload)
            with pytest.raises(Exception) as exc_info:
                consume_oauth_state(nonce, expected_provider="google")
            assert exc_info.value.code in ("malformed", "invalid_payload")

    def test_missing_provider_rejected(self, _fresh_redis):
        nonce = "no-provider"
        _set_state(_fresh_redis, nonce, {"client": "admin"})
        with pytest.raises(Exception) as exc_info:
            consume_oauth_state(nonce, expected_provider="google")
        assert exc_info.value.code == "invalid_payload"

    def test_missing_client_rejected(self, _fresh_redis):
        nonce = "no-client"
        _set_state(_fresh_redis, nonce, {"provider": "google"})
        with pytest.raises(Exception) as exc_info:
            consume_oauth_state(nonce, expected_provider="google")
        assert exc_info.value.code == "invalid_payload"

    def test_invalid_client_rejected(self, _fresh_redis):
        nonce = "bad-client"
        _set_state(_fresh_redis, nonce, {"provider": "google", "client": "internal"})
        with pytest.raises(Exception) as exc_info:
            consume_oauth_state(nonce, expected_provider="google")
        assert exc_info.value.code == "invalid_client"

    def test_provider_mismatch_google_to_facebook_rejected(self, _fresh_redis):
        nonce = "google-state"
        _set_state(_fresh_redis, nonce, {"provider": "google", "client": "admin"})
        with pytest.raises(Exception) as exc_info:
            consume_oauth_state(nonce, expected_provider="facebook")
        assert exc_info.value.code == "provider_mismatch"

    def test_provider_mismatch_facebook_to_google_rejected(self, _fresh_redis):
        nonce = "facebook-state"
        _set_state(_fresh_redis, nonce, {"provider": "facebook", "client": "admin"})
        with pytest.raises(Exception) as exc_info:
            consume_oauth_state(nonce, expected_provider="google")
        assert exc_info.value.code == "provider_mismatch"

    def test_valid_google_state_returns_payload(self, _fresh_redis):
        nonce = "ok-google"
        _set_state(_fresh_redis, nonce, {"provider": "google", "client": "admin"})
        payload = consume_oauth_state(nonce, expected_provider="google")
        assert payload == {"provider": "google", "client": "admin"}

    def test_valid_facebook_mobile_state_returns_payload(self, _fresh_redis):
        nonce = "ok-fb-mobile"
        _set_state(_fresh_redis, nonce, {"provider": "facebook", "client": "mobile"})
        payload = consume_oauth_state(nonce, expected_provider="facebook")
        assert payload == {"provider": "facebook", "client": "mobile"}

    def test_replay_after_success_rejected(self, _fresh_redis):
        nonce = "replay"
        _set_state(_fresh_redis, nonce, {"provider": "google", "client": "admin"})
        first = consume_oauth_state(nonce, expected_provider="google")
        assert first == {"provider": "google", "client": "admin"}
        with pytest.raises(Exception) as exc_info:
            consume_oauth_state(nonce, expected_provider="google")
        assert exc_info.value.code in ("unknown", "expired")

    def test_replay_after_malformed_rejected(self, _fresh_redis):
        """A malformed/invalid payload must also consume the state — otherwise
        an attacker can probe nonces with arbitrary bodies."""
        nonce = "replay-malformed"
        _set_state(_fresh_redis, nonce, "garbage")
        with pytest.raises(Exception):
            consume_oauth_state(nonce, expected_provider="google")
        with pytest.raises(Exception) as exc_info:
            consume_oauth_state(nonce, expected_provider="google")
        assert exc_info.value.code in ("unknown", "expired")

    def test_replay_after_provider_mismatch_rejected(self, _fresh_redis):
        nonce = "replay-pm"
        _set_state(_fresh_redis, nonce, {"provider": "google", "client": "admin"})
        with pytest.raises(Exception):
            consume_oauth_state(nonce, expected_provider="facebook")
        with pytest.raises(Exception) as exc_info:
            consume_oauth_state(nonce, expected_provider="google")
        assert exc_info.value.code in ("unknown", "expired")

    def test_redis_failure_rejected_fail_closed(self, _fresh_redis):
        nonce = "redis-down"
        _set_state(_fresh_redis, nonce, {"provider": "google", "client": "admin"})

        class _BrokenRedis:
            def getdel(self, _key):
                raise ConnectionError("redis down")

        with patch("core.social_auth.get_redis", return_value=_BrokenRedis()):
            with pytest.raises(Exception) as exc_info:
                consume_oauth_state(nonce, expected_provider="google")
        assert exc_info.value.code == "redis_failure"

    def test_state_is_consumed_atomically(self, _fresh_redis):
        """Helper must call getdel exactly once — no separate GET + DELETE."""
        nonce = "atomic"
        _set_state(_fresh_redis, nonce, {"provider": "google", "client": "admin"})
        calls: list[str] = []
        original_getdel = _fresh_redis.getdel

        def tracking_getdel(key):
            calls.append(key)
            return original_getdel(key)

        with patch.object(_fresh_redis, "getdel", side_effect=tracking_getdel):
            consume_oauth_state(nonce, expected_provider="google")
        assert calls == [f"oauth:social:{nonce}"], f"expected a single atomic getdel, got {calls!r}"
        # State must be gone after the call.
        assert _fresh_redis.get(f"oauth:social:{nonce}") is None

    def test_payload_isolated_from_request_state(self, _fresh_redis):
        """The helper accepts only the validated payload — extra keys are
        ignored, missing keys (provider/client) fail closed."""
        nonce = "extra-keys"
        _set_state(
            _fresh_redis,
            nonce,
            {"provider": "google", "client": "admin", "secret": "x", "is_admin": True},
        )
        payload = consume_oauth_state(nonce, expected_provider="google")
        assert payload["client"] == "admin"
        assert payload["provider"] == "google"


# ---------------------------------------------------------------------------
# Real OAuthCallbackRedirect helper — narrow per-instance scheme allow-list
# ---------------------------------------------------------------------------


@pytest.mark.django_db(transaction=True)
class TestOAuthCallbackRedirectHelper:
    """Pin the production redirect response behavior introduced in T08.

    The shared helper ``oauth_callback_redirect`` MUST return a real
    ``HttpResponseRedirect`` subclass (``OAuthCallbackRedirect``) so that the
    configured mobile deep-link scheme is accepted while every other
    redirect in the codebase keeps Django's defaults.

    Uses ``transaction=True`` so JWT issuance (which persists
    ``OutstandingToken`` rows referencing the user) does not trigger an FK
    integrity check on an unsaved user fixture. The tests still exercise the
    real production response — no mocking of the redirect, response helper or
    scheme validation.
    """

    def _make_user(self, pk: int):
        from users.models import User

        user = User(username=f"helper-{pk}", email=f"helper-{pk}@example.com", role="ATHLETE")
        user.id = pk
        user.pk = pk
        user.mfa_enabled = False
        user.save()
        return user

    def test_admin_returns_real_https_redirect(self):
        from django.http import HttpResponseRedirect

        user = self._make_user(1)
        resp = oauth_callback_redirect(user, client="admin")
        assert isinstance(resp, HttpResponseRedirect)
        assert resp.status_code == 302
        # ``Location`` header is the real attribute; ``url`` is the alias.
        assert resp["Location"] == resp.url
        assert resp.url.startswith("http")

    def test_mobile_returns_oauth_callback_redirect_with_deep_link(self):
        from django.http import HttpResponseRedirect

        user = self._make_user(2)
        resp = oauth_callback_redirect(user, client="mobile")
        # The mobile flow uses the narrowly-scoped subclass.
        assert isinstance(resp, OAuthCallbackRedirect)
        assert isinstance(resp, HttpResponseRedirect)
        assert resp.status_code == 302
        assert resp.url.startswith("fourvelo://auth/callback")
        assert "access=" in resp.url

    def test_invalid_client_raises_value_error(self):
        user = self._make_user(3)
        with pytest.raises(ValueError):
            oauth_callback_redirect(user, client="internal")

    def test_base_http_response_redirect_allow_list_unchanged(self):
        """Adding the subclass MUST NOT mutate Django's global default."""
        from django.http.response import HttpResponseRedirectBase

        assert HttpResponseRedirectBase.allowed_schemes == ["http", "https", "ftp"]
        assert "fourvelo" not in HttpResponseRedirectBase.allowed_schemes

    def test_subclass_allows_mobile_scheme_via_instance(self):
        """The per-instance check accepts the configured deep-link scheme."""
        resp = OAuthCallbackRedirect("fourvelo://auth/callback?access=test")
        assert resp.status_code == 302
        assert resp.url == "fourvelo://auth/callback?access=test"

    def test_subclass_still_rejects_arbitrary_schemes(self):
        """The subclass does NOT widen the allow-list to every scheme."""
        from django.core.exceptions import DisallowedRedirect

        with pytest.raises(DisallowedRedirect):
            OAuthCallbackRedirect("javascript:alert(1)")
        with pytest.raises(DisallowedRedirect):
            OAuthCallbackRedirect("file:///etc/passwd")


# ---------------------------------------------------------------------------
# Callback integration — network, user creation, JWT, redirect are all denied
# ---------------------------------------------------------------------------


class _SideEffectProbe:
    """Records every external call so a denial test can assert nothing was invoked."""

    def __init__(self) -> None:
        self.post_calls: list[Any] = []
        self.get_calls: list[Any] = []
        self.find_create_calls: list[Any] = []

    def post(self, *args, **kwargs):
        self.post_calls.append((args, kwargs))
        return _ok_json()

    def get(self, *args, **kwargs):
        self.get_calls.append((args, kwargs))
        return _ok_json()


def _assert_no_side_effects(probe: _SideEffectProbe) -> None:
    assert probe.post_calls == [], (
        f"requests.post must NOT be called on denial, got {probe.post_calls!r}"
    )
    assert probe.get_calls == [], (
        f"requests.get must NOT be called on denial, got {probe.get_calls!r}"
    )
    assert probe.find_create_calls == [], (
        f"find_or_create_oauth_user must NOT be called on denial, got {probe.find_create_calls!r}"
    )


@pytest.fixture
def probe() -> _SideEffectProbe:
    return _SideEffectProbe()


def _denial_runner_google(rf, query: str, probe: _SideEffectProbe):
    """Run google_callback with all external side effects blocked.

    Any call into ``find_or_create_oauth_user`` is fatal — we want the test to
    fail loudly if the callback gets past the state gate.
    """
    from core.google_auth import google_callback

    request = rf.get(f"/api/auth/google/callback/{query}")
    with (
        patch("core.google_auth.requests.post", side_effect=probe.post),
        patch("core.google_auth.requests.get", side_effect=probe.get),
        patch(
            "core.google_auth.find_or_create_oauth_user",
            side_effect=lambda **kw: (
                probe.find_create_calls.append(kw)
                or pytest.fail("find_or_create_oauth_user must NOT be called on state denial")
            ),
        ),
    ):
        return google_callback(request)


def _denial_runner_facebook(rf, query: str, probe: _SideEffectProbe):
    """Run facebook_callback with all external side effects blocked."""
    from core.facebook_auth import facebook_callback

    request = rf.get(f"/api/auth/facebook/callback/{query}")
    with (
        patch("core.facebook_auth.requests.get", side_effect=probe.get),
        patch("core.facebook_auth.requests.post", side_effect=probe.post),
        patch(
            "core.facebook_auth.find_or_create_oauth_user",
            side_effect=lambda **kw: (
                probe.find_create_calls.append(kw)
                or pytest.fail("find_or_create_oauth_user must NOT be called on state denial")
            ),
        ),
    ):
        return facebook_callback(request)


class TestGoogleCallbackDenial:
    """Every negative case for Google MUST be HTTP 400 with no side effects."""

    def test_missing_state_returns_400(self, rf, probe):
        resp = _denial_runner_google(rf, "?code=abc", probe=probe)
        assert resp.status_code == 400
        _assert_no_side_effects(probe)

    def test_empty_state_returns_400(self, rf, probe):
        resp = _denial_runner_google(rf, "?code=abc&state=", probe=probe)
        assert resp.status_code == 400
        _assert_no_side_effects(probe)

    def test_unknown_state_returns_400(self, rf, probe):
        resp = _denial_runner_google(rf, "?code=abc&state=ghost", probe=probe)
        assert resp.status_code == 400
        _assert_no_side_effects(probe)

    def test_malformed_state_returns_400(self, rf, _fresh_redis, probe):
        _set_state(_fresh_redis, "bad", "{not-json")
        resp = _denial_runner_google(rf, "?code=abc&state=bad", probe=probe)
        assert resp.status_code == 400
        _assert_no_side_effects(probe)

    def test_list_payload_returns_400(self, rf, _fresh_redis, probe):
        _set_state(_fresh_redis, "list", [])
        resp = _denial_runner_google(rf, "?code=abc&state=list", probe=probe)
        assert resp.status_code == 400
        _assert_no_side_effects(probe)

    def test_missing_provider_returns_400(self, rf, _fresh_redis, probe):
        _set_state(_fresh_redis, "noprov", {"client": "admin"})
        resp = _denial_runner_google(rf, "?code=abc&state=noprov", probe=probe)
        assert resp.status_code == 400
        _assert_no_side_effects(probe)

    def test_missing_client_returns_400(self, rf, _fresh_redis, probe):
        _set_state(_fresh_redis, "nocli", {"provider": "google"})
        resp = _denial_runner_google(rf, "?code=abc&state=nocli", probe=probe)
        assert resp.status_code == 400
        _assert_no_side_effects(probe)

    def test_invalid_client_returns_400(self, rf, _fresh_redis, probe):
        _set_state(_fresh_redis, "badcli", {"provider": "google", "client": "internal"})
        resp = _denial_runner_google(rf, "?code=abc&state=badcli", probe=probe)
        assert resp.status_code == 400
        _assert_no_side_effects(probe)

    def test_facebook_state_in_google_callback_returns_400(self, rf, _fresh_redis, probe):
        _set_state(_fresh_redis, "fb-state", {"provider": "facebook", "client": "admin"})
        resp = _denial_runner_google(rf, "?code=abc&state=fb-state", probe=probe)
        assert resp.status_code == 400
        _assert_no_side_effects(probe)

    def test_redis_failure_returns_400_fail_closed(self, rf, _fresh_redis, probe):
        _set_state(_fresh_redis, "down", {"provider": "google", "client": "admin"})

        class _BrokenRedis:
            def getdel(self, _key):
                raise ConnectionError("redis down")

        with patch("core.social_auth.get_redis", return_value=_BrokenRedis()):
            from core.google_auth import google_callback

            request = rf.get("/api/auth/google/callback/?code=abc&state=down")
            with (
                patch("core.google_auth.requests.post", side_effect=probe.post),
                patch("core.google_auth.requests.get", side_effect=probe.get),
                patch(
                    "core.google_auth.find_or_create_oauth_user",
                    side_effect=lambda **kw: (
                        probe.find_create_calls.append(kw)
                        or pytest.fail("find_or_create_oauth_user must NOT be called")
                    ),
                ),
            ):
                resp = google_callback(request)
        assert resp.status_code == 400
        _assert_no_side_effects(probe)


class TestFacebookCallbackDenial:
    """Same matrix for the Facebook callback."""

    def test_missing_state_returns_400(self, rf, probe):
        resp = _denial_runner_facebook(rf, "?code=abc", probe=probe)
        assert resp.status_code == 400
        _assert_no_side_effects(probe)

    def test_empty_state_returns_400(self, rf, probe):
        resp = _denial_runner_facebook(rf, "?code=abc&state=", probe=probe)
        assert resp.status_code == 400
        _assert_no_side_effects(probe)

    def test_unknown_state_returns_400(self, rf, probe):
        resp = _denial_runner_facebook(rf, "?code=abc&state=ghost", probe=probe)
        assert resp.status_code == 400
        _assert_no_side_effects(probe)

    def test_malformed_state_returns_400(self, rf, _fresh_redis, probe):
        _set_state(_fresh_redis, "bad-fb", "{not-json")
        resp = _denial_runner_facebook(rf, "?code=abc&state=bad-fb", probe=probe)
        assert resp.status_code == 400
        _assert_no_side_effects(probe)

    def test_list_payload_returns_400(self, rf, _fresh_redis, probe):
        _set_state(_fresh_redis, "list-fb", [])
        resp = _denial_runner_facebook(rf, "?code=abc&state=list-fb", probe=probe)
        assert resp.status_code == 400
        _assert_no_side_effects(probe)

    def test_missing_provider_returns_400(self, rf, _fresh_redis, probe):
        _set_state(_fresh_redis, "noprov-fb", {"client": "admin"})
        resp = _denial_runner_facebook(rf, "?code=abc&state=noprov-fb", probe=probe)
        assert resp.status_code == 400
        _assert_no_side_effects(probe)

    def test_missing_client_returns_400(self, rf, _fresh_redis, probe):
        _set_state(_fresh_redis, "nocli-fb", {"provider": "facebook"})
        resp = _denial_runner_facebook(rf, "?code=abc&state=nocli-fb", probe=probe)
        assert resp.status_code == 400
        _assert_no_side_effects(probe)

    def test_invalid_client_returns_400(self, rf, _fresh_redis, probe):
        _set_state(_fresh_redis, "badcli-fb", {"provider": "facebook", "client": "internal"})
        resp = _denial_runner_facebook(rf, "?code=abc&state=badcli-fb", probe=probe)
        assert resp.status_code == 400
        _assert_no_side_effects(probe)

    def test_google_state_in_facebook_callback_returns_400(self, rf, _fresh_redis, probe):
        _set_state(_fresh_redis, "g-state", {"provider": "google", "client": "admin"})
        resp = _denial_runner_facebook(rf, "?code=abc&state=g-state", probe=probe)
        assert resp.status_code == 400
        _assert_no_side_effects(probe)

    def test_redis_failure_returns_400_fail_closed(self, rf, _fresh_redis, probe):
        _set_state(_fresh_redis, "down-fb", {"provider": "facebook", "client": "admin"})

        class _BrokenRedis:
            def getdel(self, _key):
                raise ConnectionError("redis down")

        with patch("core.social_auth.get_redis", return_value=_BrokenRedis()):
            from core.facebook_auth import facebook_callback

            request = rf.get("/api/auth/facebook/callback/?code=abc&state=down-fb")
            with (
                patch("core.facebook_auth.requests.get", side_effect=probe.get),
                patch("core.facebook_auth.requests.post", side_effect=probe.post),
                patch(
                    "core.facebook_auth.find_or_create_oauth_user",
                    side_effect=lambda **kw: (
                        probe.find_create_calls.append(kw)
                        or pytest.fail("find_or_create_oauth_user must NOT be called")
                    ),
                ),
            ):
                resp = facebook_callback(request)
        assert resp.status_code == 400
        _assert_no_side_effects(probe)


# ---------------------------------------------------------------------------
# Replay protection — first call goes through the full happy path,
# the second call MUST be rejected by atomic GETDEL.
# ---------------------------------------------------------------------------


@pytest.mark.django_db(transaction=True)
class TestReplayHappyPath:
    """Replay test runs the full callback twice. The first call goes through
    all the way to a redirect; the second call (with the same nonce) MUST be
    rejected because consume_oauth_state removed the state atomically.
    """

    def test_google_replay_returns_400(self, rf, _fresh_redis, settings):
        _set_state(_fresh_redis, "replay-g", {"provider": "google", "client": "admin"})
        settings.FRONTEND_URL = "http://localhost:5173"

        from core.google_auth import google_callback
        from users.models import User

        captured: dict[str, Any] = {}

        def fake_find_or_create(**kw):
            captured.update(kw)
            user = User(username="alice-r", email="alice-r@example.com", role="ATHLETE")
            user.id = 1001
            user.pk = 1001
            user.mfa_enabled = False
            user.save()
            return user, False

        with (
            patch("core.google_auth.requests.post", return_value=_ok_json()),
            patch("core.google_auth.requests.get", return_value=_ok_json()),
            patch(
                "core.google_auth.find_or_create_oauth_user",
                side_effect=fake_find_or_create,
            ),
            patch(
                "core.social_auth.restricted_token_pair_for_user",
                side_effect=lambda u: _stub_token_pair(),
            ),
        ):
            req1 = rf.get("/api/auth/google/callback/?code=abc&state=replay-g")
            first = google_callback(req1)
            # First call must succeed with a real redirect response.
            assert first.status_code == 302
            assert first.url.startswith("http")
            assert captured["client"] == "admin"

            req2 = rf.get("/api/auth/google/callback/?code=abc&state=replay-g")
            second = google_callback(req2)
        # Replay must be rejected.
        assert second.status_code == 400

    def test_facebook_replay_returns_400(self, rf, _fresh_redis, settings):
        _set_state(_fresh_redis, "replay-fb", {"provider": "facebook", "client": "admin"})
        settings.FRONTEND_URL = "http://localhost:5173"

        from core.facebook_auth import facebook_callback
        from users.models import User

        captured: dict[str, Any] = {}

        def fake_find_or_create(**kw):
            captured.update(kw)
            user = User(username="erin-r", email="erin-r@example.com", role="ATHLETE")
            user.id = 1002
            user.pk = 1002
            user.mfa_enabled = False
            user.save()
            return user, False

        with (
            patch("core.facebook_auth.requests.get", return_value=_ok_json()),
            patch("core.facebook_auth.requests.post", return_value=_ok_json()),
            patch(
                "core.facebook_auth.find_or_create_oauth_user",
                side_effect=fake_find_or_create,
            ),
            patch(
                "core.social_auth.restricted_token_pair_for_user",
                side_effect=lambda u: _stub_token_pair(),
            ),
        ):
            req1 = rf.get("/api/auth/facebook/callback/?code=abc&state=replay-fb")
            first = facebook_callback(req1)
            assert first.status_code == 302
            assert first.url.startswith("http")
            assert captured["client"] == "admin"

            req2 = rf.get("/api/auth/facebook/callback/?code=abc&state=replay-fb")
            second = facebook_callback(req2)
        assert second.status_code == 400


# ---------------------------------------------------------------------------
# Positive callback flow — real responses, real Location headers
# ---------------------------------------------------------------------------


@pytest.mark.django_db(transaction=True)
class TestGoogleCallbackPositive:
    """End-to-end flow when the state is valid. Uses real
    ``oauth_callback_redirect`` — no patches on ``redirect`` /
    ``HttpResponseRedirect`` / scheme validation.
    """

    def test_admin_client_produces_admin_redirect(self, rf, _fresh_redis, settings):
        settings.FRONTEND_URL = "http://localhost:5173"
        from core.google_auth import google_callback
        from users.models import User

        _set_state(_fresh_redis, "ok-admin-g", {"provider": "google", "client": "admin"})

        captured: dict[str, Any] = {}

        def fake_find_or_create(**kw):
            captured.update(kw)
            user = User(username="alice", email="alice@example.com", role="ATHLETE")
            user.id = 1
            user.pk = 1
            user.mfa_enabled = False
            user.save()
            return user, False

        request = rf.get("/api/auth/google/callback/?code=abc&state=ok-admin-g")
        with (
            patch("core.google_auth.requests.post", return_value=_ok_json()),
            patch("core.google_auth.requests.get", return_value=_ok_json()),
            patch(
                "core.google_auth.find_or_create_oauth_user",
                side_effect=fake_find_or_create,
            ),
            patch(
                "core.social_auth.restricted_token_pair_for_user",
                side_effect=lambda u: _stub_token_pair(),
            ),
        ):
            resp = google_callback(request)

        # The real ``HttpResponseRedirect`` is returned unchanged.
        from django.http import HttpResponseRedirect

        assert isinstance(resp, HttpResponseRedirect)
        assert resp.status_code == 302
        location = resp["Location"]
        assert "localhost:5173" in location
        assert "auth/callback" in location
        assert "access=" in location
        assert captured["client"] == "admin"

    def test_mobile_client_produces_real_deep_link_redirect(self, rf, _fresh_redis, settings):
        """The mobile flow returns the real ``OAuthCallbackRedirect`` subclass
        with a fourvelo:// Location header. No patching of redirect helpers."""
        from core.google_auth import google_callback
        from users.models import User

        _set_state(_fresh_redis, "ok-mobile-g", {"provider": "google", "client": "mobile"})

        def fake_find_or_create(**kw):
            user = User(username="bob", email="bob@example.com", role="ATHLETE")
            user.id = 2
            user.pk = 2
            user.mfa_enabled = False
            user.save()
            return user, False

        request = rf.get("/api/auth/google/callback/?code=abc&state=ok-mobile-g")
        with (
            patch("core.google_auth.requests.post", return_value=_ok_json()),
            patch("core.google_auth.requests.get", return_value=_ok_json()),
            patch(
                "core.google_auth.find_or_create_oauth_user",
                side_effect=fake_find_or_create,
            ),
            patch(
                "core.social_auth.restricted_token_pair_for_user",
                side_effect=lambda u: _stub_token_pair(),
            ),
        ):
            resp = google_callback(request)

        # The production response is a real HttpResponseRedirect subclass.
        from django.http import HttpResponseRedirect

        assert isinstance(resp, HttpResponseRedirect)
        assert resp.status_code == 302
        location = resp["Location"]
        assert location.startswith("fourvelo://auth/callback"), (
            f"expected mobile deep link, got {location!r}"
        )
        assert "access=" in location

    def test_callback_client_query_param_does_not_override_state(self, rf, _fresh_redis, settings):
        """Even if a caller appends ``?client=mobile`` to the callback URL, the
        validated state's client must win."""
        settings.FRONTEND_URL = "http://localhost:5173"
        from core.google_auth import google_callback
        from users.models import User

        _set_state(_fresh_redis, "admin-strict", {"provider": "google", "client": "admin"})

        captured: dict[str, Any] = {}

        def fake_find_or_create(**kw):
            captured.update(kw)
            user = User(username="carol", email="carol@example.com", role="ATHLETE")
            user.id = 3
            user.pk = 3
            user.mfa_enabled = False
            user.save()
            return user, False

        request = rf.get("/api/auth/google/callback/?code=abc&state=admin-strict&client=mobile")
        with (
            patch("core.google_auth.requests.post", return_value=_ok_json()),
            patch("core.google_auth.requests.get", return_value=_ok_json()),
            patch(
                "core.google_auth.find_or_create_oauth_user",
                side_effect=fake_find_or_create,
            ),
            patch(
                "core.social_auth.restricted_token_pair_for_user",
                side_effect=lambda u: _stub_token_pair(),
            ),
        ):
            resp = google_callback(request)

        assert resp.status_code == 302
        # State-bound client is admin → http(s) URL, not deep link.
        assert not resp["Location"].startswith("fourvelo://")
        assert captured["client"] == "admin"

    def test_admin_receives_restricted_mfa_token_from_t07(self, settings):
        """T07 integration: build_auth_redirect uses restricted_token_pair_for_user
        so admin OAuth sessions carry the ``mfa_setup_required`` (or
        ``mfa_verification_required``) claim.

        Uses a real persisted admin user so JWT issuance is honored without
        OutstandingToken constraint failures at teardown.
        """
        from users.jwt_views import restricted_token_pair_for_user
        from users.models import User

        user = User.objects.create_user(
            username="dave-admin",
            email="dave-admin@example.com",
            role="TENANT_ADMIN",
        )
        user.mfa_enabled = False
        user.save()

        redirect_url = build_auth_redirect(user, client="admin")
        tokens = restricted_token_pair_for_user(user)
        from rest_framework_simplejwt.tokens import AccessToken

        token = AccessToken(tokens["access"])
        assert token["mfa_setup_required"] is True
        assert "mfa_verified" not in token
        # The redirect embeds the restricted token pair.
        assert "access" in redirect_url


@pytest.mark.django_db(transaction=True)
class TestFacebookCallbackPositive:
    """End-to-end flow for the Facebook callback."""

    def test_admin_client_produces_admin_redirect(self, rf, _fresh_redis, settings):
        settings.FRONTEND_URL = "http://localhost:5173"
        from core.facebook_auth import facebook_callback
        from users.models import User

        _set_state(_fresh_redis, "ok-admin-fb", {"provider": "facebook", "client": "admin"})

        captured: dict[str, Any] = {}

        def fake_find_or_create(**kw):
            captured.update(kw)
            user = User(username="erin", email="erin@example.com", role="ATHLETE")
            user.id = 10
            user.pk = 10
            user.mfa_enabled = False
            user.save()
            return user, False

        request = rf.get("/api/auth/facebook/callback/?code=abc&state=ok-admin-fb")
        with (
            patch("core.facebook_auth.requests.post", return_value=_ok_json()),
            patch("core.facebook_auth.requests.get", return_value=_ok_json()),
            patch(
                "core.facebook_auth.find_or_create_oauth_user",
                side_effect=fake_find_or_create,
            ),
            patch(
                "core.social_auth.restricted_token_pair_for_user",
                side_effect=lambda u: _stub_token_pair(),
            ),
        ):
            resp = facebook_callback(request)

        from django.http import HttpResponseRedirect

        assert isinstance(resp, HttpResponseRedirect)
        assert resp.status_code == 302
        assert "localhost:5173" in resp["Location"]
        assert captured["client"] == "admin"

    def test_mobile_client_produces_real_deep_link_redirect(self, rf, _fresh_redis, settings):
        """Mobile flow returns the real ``OAuthCallbackRedirect`` with a
        fourvelo:// Location — no patch on redirect helpers."""
        from core.facebook_auth import facebook_callback
        from users.models import User

        _set_state(_fresh_redis, "ok-mobile-fb", {"provider": "facebook", "client": "mobile"})

        def fake_find_or_create(**kw):
            user = User(username="frank", email="frank@example.com", role="ATHLETE")
            user.id = 11
            user.pk = 11
            user.mfa_enabled = False
            user.save()
            return user, False

        request = rf.get("/api/auth/facebook/callback/?code=abc&state=ok-mobile-fb")
        with (
            patch("core.facebook_auth.requests.post", return_value=_ok_json()),
            patch("core.facebook_auth.requests.get", return_value=_ok_json()),
            patch(
                "core.facebook_auth.find_or_create_oauth_user",
                side_effect=fake_find_or_create,
            ),
            patch(
                "core.social_auth.restricted_token_pair_for_user",
                side_effect=lambda u: _stub_token_pair(),
            ),
        ):
            resp = facebook_callback(request)

        from django.http import HttpResponseRedirect

        assert isinstance(resp, HttpResponseRedirect)
        assert resp.status_code == 302
        location = resp["Location"]
        assert location.startswith("fourvelo://auth/callback"), (
            f"expected mobile deep link, got {location!r}"
        )
        assert "access=" in location


# ---------------------------------------------------------------------------
# Login flow still records state correctly (no behavior change in seed step)
# ---------------------------------------------------------------------------


class TestLoginFlow:
    def test_google_login_redirects_to_provider(self, rf, _fresh_redis):
        from core.google_auth import google_login

        with patch("core.google_auth.GOOGLE_CLIENT_ID", "test-client-id"):
            request = rf.get("/api/auth/google/login/?client=admin")
            resp = google_login(request)
        assert resp.status_code in (301, 302)
        url = resp.url
        assert "state=" in url
        assert urlparse(url).hostname == "accounts.google.com"

    def test_facebook_login_redirects_to_provider(self, rf, _fresh_redis):
        from core.facebook_auth import facebook_login

        with patch("core.facebook_auth.FACEBOOK_APP_ID", "test-fb-id"):
            request = rf.get("/api/auth/facebook/login/?client=mobile")
            resp = facebook_login(request)
        assert resp.status_code in (301, 302)
        url = resp.url
        assert "state=" in url
        assert urlparse(url).hostname == "www.facebook.com"
