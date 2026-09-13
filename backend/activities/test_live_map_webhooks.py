"""Tests for Live Map alert webhooks (RBAC, tenant isolation, SSRF)."""

import uuid
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework import serializers

from activities.models_webhooks import MAX_DELIVERY_LOG, LiveMapAlertWebhook, append_delivery_log
from activities.ssrf import UnsafeWebhookURL, validate_outbound_url
from users.models import Tenant


def _make_user(role, tenant=None, username=None):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    # The default username must be unique across consecutive calls even when
    # the role and tenant repeat (and even when ``tenant is None``) so the
    # helper is safe to call from ``setUp`` of multiple test classes without
    # surfacing ``IntegrityError`` on the ``users_user.username`` UNIQUE
    # constraint.
    if username is None:
        username = f"{role.lower()}_{tenant.id if tenant else 'x'}_{uuid.uuid4().hex[:8]}"
    return User.objects.create_user(
        username=username,
        password="x",
        role=role,
        tenant=tenant,
    )


def _post(url, user, data=None):
    from rest_framework.test import APIRequestFactory, force_authenticate

    factory = APIRequestFactory()
    request = factory.post(url, data=data or {}, format="json")
    force_authenticate(request, user=user)
    return request


def _patch(url, user, data=None):
    from rest_framework.test import APIRequestFactory, force_authenticate

    factory = APIRequestFactory()
    request = factory.patch(url, data=data or {}, format="json")
    force_authenticate(request, user=user)
    return request


def _put(url, user, data=None):
    from rest_framework.test import APIRequestFactory, force_authenticate

    factory = APIRequestFactory()
    request = factory.put(url, data=data or {}, format="json")
    force_authenticate(request, user=user)
    return request


def _get(url, user):
    from rest_framework.test import APIRequestFactory, force_authenticate

    factory = APIRequestFactory()
    request = factory.get(url)
    force_authenticate(request, user=user)
    return request


def _delete(url, user):
    from rest_framework.test import APIRequestFactory, force_authenticate

    factory = APIRequestFactory()
    request = factory.delete(url)
    force_authenticate(request, user=user)
    return request


class LiveMapWebhookDeliveryLogTest(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(name="T1")
        self.wh = LiveMapAlertWebhook.objects.create(
            tenant=self.tenant,
            url="https://example.com/hook",
            secret="s",
            events=["test_ping"],
        )

    def test_append_delivery_log_prepends_and_caps(self):
        for i in range(MAX_DELIVERY_LOG + 3):
            append_delivery_log(
                self.wh.id,
                {"event_id": f"e{i}", "status": "ok", "at": timezone.now().isoformat()},
            )
        self.wh.refresh_from_db()
        self.assertEqual(len(self.wh.delivery_log), MAX_DELIVERY_LOG)
        self.assertEqual(self.wh.delivery_log[0]["event_id"], f"e{MAX_DELIVERY_LOG + 2}")

    @patch("activities.tasks.deliver_live_map_webhook.delay")
    def test_test_ping_records_queued_entry(self, mock_delay):
        from activities.views import LiveMapWebhookTestView

        user = _make_user("GLOBAL_OWNER", username="owner_t1")
        request = _post(f"/api/activities/telemetry/live/webhooks/{self.wh.id}/test/", user)
        response = LiveMapWebhookTestView.as_view()(request, pk=self.wh.id)
        self.assertEqual(response.status_code, 202)
        self.wh.refresh_from_db()
        self.assertEqual(self.wh.delivery_log[0]["status"], "queued")
        self.assertEqual(self.wh.delivery_log[0]["event"], "test_ping")
        mock_delay.assert_called_once()


# ---------------------------------------------------------------------------
# RBAC and tenant isolation
# ---------------------------------------------------------------------------


class LiveMapWebhookRBACTests(TestCase):
    def setUp(self):
        self.tenant_a = Tenant.objects.create(name="TenantA")
        self.tenant_b = Tenant.objects.create(name="TenantB")
        self.wh_a = LiveMapAlertWebhook.objects.create(
            tenant=self.tenant_a,
            url="https://example.com/a",
            secret="sa",
            events=["test_ping"],
        )
        self.wh_b = LiveMapAlertWebhook.objects.create(
            tenant=self.tenant_b,
            url="https://example.com/b",
            secret="sb",
            events=["test_ping"],
        )
        self.admin_a = _make_user("TENANT_ADMIN", tenant=self.tenant_a, username="admin_a")
        self.admin_b = _make_user("TENANT_ADMIN", tenant=self.tenant_b, username="admin_b")
        self.admin_orphan = _make_user("TENANT_ADMIN", username="admin_orphan")
        self.moderator = _make_user("TENANT_MODERATOR", tenant=self.tenant_a, username="mod")
        self.sponsor = _make_user("SPONSOR", username="sponsor1")
        self.athlete = _make_user("ATHLETE", username="athlete1")
        self.owner = _make_user("GLOBAL_OWNER", username="globalowner")

    # ----- unauthenticated / non-admin roles

    def test_unauthenticated_cannot_list(self):
        from rest_framework.test import APIRequestFactory

        from activities.views import LiveMapWebhookListCreateView

        req = APIRequestFactory().get("/api/activities/telemetry/live/webhooks/")
        resp = LiveMapWebhookListCreateView.as_view()(req)
        self.assertIn(resp.status_code, (401, 403))

    def test_athlete_cannot_list(self):
        from activities.views import LiveMapWebhookListCreateView

        req = _get("/api/activities/telemetry/live/webhooks/", self.athlete)
        resp = LiveMapWebhookListCreateView.as_view()(req)
        self.assertEqual(resp.status_code, 403)

    def test_sponsor_cannot_list(self):
        from activities.views import LiveMapWebhookListCreateView

        req = _get("/api/activities/telemetry/live/webhooks/", self.sponsor)
        resp = LiveMapWebhookListCreateView.as_view()(req)
        self.assertEqual(resp.status_code, 403)

    def test_tenant_moderator_cannot_list(self):
        from activities.views import LiveMapWebhookListCreateView

        req = _get("/api/activities/telemetry/live/webhooks/", self.moderator)
        resp = LiveMapWebhookListCreateView.as_view()(req)
        self.assertEqual(resp.status_code, 403)

    # ----- tenant admin happy path

    def test_tenant_admin_can_list_own(self):
        from activities.views import LiveMapWebhookListCreateView

        req = _get("/api/activities/telemetry/live/webhooks/", self.admin_a)
        resp = LiveMapWebhookListCreateView.as_view()(req)
        self.assertEqual(resp.status_code, 200)
        ids = [item["id"] for item in resp.data]
        self.assertIn(self.wh_a.id, ids)
        self.assertNotIn(self.wh_b.id, ids)

    def test_tenant_admin_can_create_without_tenant_field(self):
        from activities.views import LiveMapWebhookListCreateView

        req = _post(
            "/api/activities/telemetry/live/webhooks/",
            self.admin_a,
            data={"url": "https://example.com/created", "secret": "kk", "events": ["test_ping"]},
        )
        resp = LiveMapWebhookListCreateView.as_view()(req)
        self.assertEqual(resp.status_code, 201, resp.data)
        new = LiveMapAlertWebhook.objects.get(id=resp.data["id"])
        self.assertEqual(new.tenant_id, self.tenant_a.id)

    def test_tenant_admin_create_with_foreign_tenant_rejected(self):
        from activities.views import LiveMapWebhookListCreateView

        req = _post(
            "/api/activities/telemetry/live/webhooks/",
            self.admin_a,
            data={
                "url": "https://example.com/foreign",
                "secret": "kk",
                "events": ["test_ping"],
                "tenant": self.tenant_b.id,
            },
        )
        resp = LiveMapWebhookListCreateView.as_view()(req)
        self.assertEqual(resp.status_code, 400, resp.data)

    def test_tenant_admin_can_read_own(self):
        from activities.views import LiveMapWebhookDetailView

        req = _get(f"/api/activities/telemetry/live/webhooks/{self.wh_a.id}/", self.admin_a)
        resp = LiveMapWebhookDetailView.as_view()(req, pk=self.wh_a.id)
        self.assertEqual(resp.status_code, 200)

    def test_tenant_admin_can_update_own(self):
        from activities.views import LiveMapWebhookDetailView

        req = _patch(
            f"/api/activities/telemetry/live/webhooks/{self.wh_a.id}/",
            self.admin_a,
            data={"enabled": False},
        )
        resp = LiveMapWebhookDetailView.as_view()(req, pk=self.wh_a.id)
        self.assertEqual(resp.status_code, 200, resp.data)
        self.wh_a.refresh_from_db()
        self.assertFalse(self.wh_a.enabled)

    def test_tenant_admin_update_with_cross_tenant_rejected(self):
        from activities.views import LiveMapWebhookDetailView

        req = _patch(
            f"/api/activities/telemetry/live/webhooks/{self.wh_a.id}/",
            self.admin_a,
            data={"tenant": self.tenant_b.id},
        )
        resp = LiveMapWebhookDetailView.as_view()(req, pk=self.wh_a.id)
        self.assertEqual(resp.status_code, 400, resp.data)
        self.wh_a.refresh_from_db()
        self.assertEqual(self.wh_a.tenant_id, self.tenant_a.id)

    def test_tenant_admin_can_delete_own(self):
        from activities.views import LiveMapWebhookDetailView

        req = _delete(f"/api/activities/telemetry/live/webhooks/{self.wh_a.id}/", self.admin_a)
        resp = LiveMapWebhookDetailView.as_view()(req, pk=self.wh_a.id)
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(LiveMapAlertWebhook.objects.filter(pk=self.wh_a.id).exists())

    def test_tenant_admin_can_test_own(self):
        from activities.views import LiveMapWebhookTestView

        with patch("activities.tasks.deliver_live_map_webhook.delay") as mock_delay:
            req = _post(
                f"/api/activities/telemetry/live/webhooks/{self.wh_a.id}/test/",
                self.admin_a,
            )
            resp = LiveMapWebhookTestView.as_view()(req, pk=self.wh_a.id)
        self.assertEqual(resp.status_code, 202)
        mock_delay.assert_called_once()

    # ----- cross-tenant isolation

    def test_tenant_admin_read_foreign_is_404(self):
        from activities.views import LiveMapWebhookDetailView

        req = _get(f"/api/activities/telemetry/live/webhooks/{self.wh_b.id}/", self.admin_a)
        resp = LiveMapWebhookDetailView.as_view()(req, pk=self.wh_b.id)
        self.assertEqual(resp.status_code, 404)

    def test_tenant_admin_update_foreign_is_404(self):
        from activities.views import LiveMapWebhookDetailView

        req = _patch(
            f"/api/activities/telemetry/live/webhooks/{self.wh_b.id}/",
            self.admin_a,
            data={"enabled": False},
        )
        resp = LiveMapWebhookDetailView.as_view()(req, pk=self.wh_b.id)
        self.assertEqual(resp.status_code, 404)

    def test_tenant_admin_delete_foreign_is_404(self):
        from activities.views import LiveMapWebhookDetailView

        req = _delete(f"/api/activities/telemetry/live/webhooks/{self.wh_b.id}/", self.admin_a)
        resp = LiveMapWebhookDetailView.as_view()(req, pk=self.wh_b.id)
        self.assertEqual(resp.status_code, 404)

    def test_tenant_admin_test_foreign_is_404(self):
        from activities.views import LiveMapWebhookTestView

        req = _post(
            f"/api/activities/telemetry/live/webhooks/{self.wh_b.id}/test/",
            self.admin_a,
        )
        resp = LiveMapWebhookTestView.as_view()(req, pk=self.wh_b.id)
        self.assertEqual(resp.status_code, 404)

    # ----- orphan tenant admin

    def test_tenant_admin_without_tenant_is_forbidden(self):
        from activities.views import (
            LiveMapWebhookDetailView,
            LiveMapWebhookListCreateView,
            LiveMapWebhookTestView,
        )

        # list
        req = _get("/api/activities/telemetry/live/webhooks/", self.admin_orphan)
        resp = LiveMapWebhookListCreateView.as_view()(req)
        self.assertEqual(resp.status_code, 403)
        # create
        req = _post(
            "/api/activities/telemetry/live/webhooks/",
            self.admin_orphan,
            data={"url": "https://example.com/x", "secret": "k", "events": ["test_ping"]},
        )
        resp = LiveMapWebhookListCreateView.as_view()(req)
        self.assertEqual(resp.status_code, 403)
        # detail
        req = _get(f"/api/activities/telemetry/live/webhooks/{self.wh_a.id}/", self.admin_orphan)
        resp = LiveMapWebhookDetailView.as_view()(req, pk=self.wh_a.id)
        self.assertEqual(resp.status_code, 403)
        # test
        req = _post(
            f"/api/activities/telemetry/live/webhooks/{self.wh_a.id}/test/",
            self.admin_orphan,
        )
        resp = LiveMapWebhookTestView.as_view()(req, pk=self.wh_a.id)
        self.assertEqual(resp.status_code, 403)

    # ----- global owner

    def test_global_owner_can_list_all_with_tenant_filter(self):
        from activities.views import LiveMapWebhookListCreateView

        req = _get(
            f"/api/activities/telemetry/live/webhooks/?tenant_id={self.tenant_b.id}",
            self.owner,
        )
        resp = LiveMapWebhookListCreateView.as_view()(req)
        self.assertEqual(resp.status_code, 200)
        ids = [item["id"] for item in resp.data]
        self.assertIn(self.wh_b.id, ids)
        self.assertNotIn(self.wh_a.id, ids)

    def test_global_owner_can_create_with_valid_tenant(self):
        from activities.views import LiveMapWebhookListCreateView

        req = _post(
            "/api/activities/telemetry/live/webhooks/",
            self.owner,
            data={
                "url": "https://example.com/owner",
                "secret": "kk",
                "events": ["test_ping"],
                "tenant": self.tenant_a.id,
            },
        )
        resp = LiveMapWebhookListCreateView.as_view()(req)
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["tenant"], self.tenant_a.id)

    def test_global_owner_create_without_tenant_is_400(self):
        from activities.views import LiveMapWebhookListCreateView

        req = _post(
            "/api/activities/telemetry/live/webhooks/",
            self.owner,
            data={"url": "https://example.com/noone", "secret": "kk", "events": ["test_ping"]},
        )
        resp = LiveMapWebhookListCreateView.as_view()(req)
        self.assertEqual(resp.status_code, 400, resp.data)

    def test_global_owner_create_with_unknown_tenant_is_400(self):
        from activities.views import LiveMapWebhookListCreateView

        req = _post(
            "/api/activities/telemetry/live/webhooks/",
            self.owner,
            data={
                "url": "https://example.com/ghost",
                "secret": "kk",
                "events": ["test_ping"],
                "tenant": 999999,
            },
        )
        resp = LiveMapWebhookListCreateView.as_view()(req)
        self.assertEqual(resp.status_code, 400, resp.data)

    def test_global_owner_can_access_cross_tenant_detail(self):
        from activities.views import LiveMapWebhookDetailView

        req = _get(f"/api/activities/telemetry/live/webhooks/{self.wh_b.id}/", self.owner)
        resp = LiveMapWebhookDetailView.as_view()(req, pk=self.wh_b.id)
        self.assertEqual(resp.status_code, 200)

    # ----- secret write-only

    def test_secret_not_in_list_response(self):
        from activities.views import LiveMapWebhookListCreateView

        req = _get("/api/activities/telemetry/live/webhooks/", self.admin_a)
        resp = LiveMapWebhookListCreateView.as_view()(req)
        self.assertEqual(resp.status_code, 200)
        for item in resp.data:
            self.assertNotIn("secret", item)

    def test_secret_not_in_detail_response(self):
        from activities.views import LiveMapWebhookDetailView

        req = _get(f"/api/activities/telemetry/live/webhooks/{self.wh_a.id}/", self.admin_a)
        resp = LiveMapWebhookDetailView.as_view()(req, pk=self.wh_a.id)
        self.assertEqual(resp.status_code, 200)
        self.assertNotIn("secret", resp.data)


# ---------------------------------------------------------------------------
# F-7 — _make_user helper stability
# ---------------------------------------------------------------------------


class MakeUserHelperStabilityTests(TestCase):
    def test_default_username_is_unique_across_calls(self):
        # Same role, same tenant — collisions on the default username must
        # not raise. The helper appends a short uuid suffix by default.
        a = _make_user("ATHLETE", username=None)
        b = _make_user("ATHLETE", username=None)
        self.assertNotEqual(a.username, b.username)

    def test_default_username_is_unique_with_none_tenant(self):
        a = _make_user("SPONSOR", tenant=None, username=None)
        b = _make_user("SPONSOR", tenant=None, username=None)
        self.assertNotEqual(a.username, b.username)
        self.assertTrue(a.username)
        self.assertTrue(b.username)

    def test_explicit_username_is_respected(self):
        u = _make_user("ATHLETE", username="explicit-athlete")
        self.assertEqual(u.username, "explicit-athlete")


# ---------------------------------------------------------------------------
# SSRF helper unit tests
# ---------------------------------------------------------------------------


class _FakeAddrInfo:
    """Minimal stand-in for getaddrinfo entries."""

    def __init__(self, sockaddr):
        self._sockaddr = sockaddr

    def __getitem__(self, idx):
        if idx == 4:
            return self._sockaddr
        raise IndexError(idx)

    def __len__(self):
        return 5


def _mock_getaddrinfo(map_):
    """map_ = { hostname: [sockaddr, ...] }
    Returns a getaddrinfo-compatible factory. Each sockaddr is a 2-tuple
    ``(host, port)`` like the real ``getaddrinfo`` entry.
    """

    def _fake(host, *args, **kwargs):
        entries = map_.get(host)
        if entries is None:
            import socket

            raise socket.gaierror(-2, "Name or service not known")
        return [_FakeAddrInfo(sa) for sa in entries]

    return _fake


class SSRFHelperTests(TestCase):
    def test_accepts_https_public_hostname(self):
        with patch(
            "activities.ssrf.socket.getaddrinfo",
            new=_mock_getaddrinfo({"example.com": [("93.184.216.34", 0)]}),
        ):
            self.assertEqual(
                validate_outbound_url("https://example.com/hook"),
                "https://example.com/hook",
            )

    def test_rejects_http(self):
        with self.assertRaises(UnsafeWebhookURL):
            validate_outbound_url("http://example.com/hook")

    def test_rejects_userinfo(self):
        with self.assertRaises(UnsafeWebhookURL):
            validate_outbound_url("https://user:pass@example.com/hook")

    def test_rejects_missing_host(self):
        with self.assertRaises(UnsafeWebhookURL):
            validate_outbound_url("https:///hook")

    def test_rejects_malformed_url(self):
        with self.assertRaises(UnsafeWebhookURL):
            validate_outbound_url("https://exa mple.com/hook")

    def test_rejects_localhost(self):
        with self.assertRaises(UnsafeWebhookURL):
            validate_outbound_url("https://localhost/hook")

    def test_rejects_loopback_literal(self):
        with self.assertRaises(UnsafeWebhookURL):
            validate_outbound_url("https://127.0.0.1/hook")

    def test_rejects_private_ipv4_literal(self):
        with self.assertRaises(UnsafeWebhookURL):
            validate_outbound_url("https://10.0.0.1/hook")

    def test_rejects_link_local_literal(self):
        with self.assertRaises(UnsafeWebhookURL):
            validate_outbound_url("https://169.254.169.254/hook")

    def test_rejects_nonpublic_ipv6_literal(self):
        with self.assertRaises(UnsafeWebhookURL):
            validate_outbound_url("https://[fe80::1]/hook")

    def test_rejects_ipv4_mapped_private_ipv6(self):
        with self.assertRaises(UnsafeWebhookURL):
            validate_outbound_url("https://[::ffff:10.0.0.1]/hook")

    def test_rejects_unresolvable_host(self):
        # Default mock raises gaierror -> UnsafeWebhookURL
        with self.assertRaises(UnsafeWebhookURL):
            validate_outbound_url("https://nonexistent.invalid/hook")

    def test_rejects_empty_getaddrinfo_result(self):
        def _fake(host, *args, **kwargs):
            return []  # resolves but no addresses

        with patch("activities.ssrf.socket.getaddrinfo", new=_fake):
            with self.assertRaises(UnsafeWebhookURL):
                validate_outbound_url("https://empty.invalid/hook")

    def test_rejects_mixed_public_and_private_addresses(self):
        with patch(
            "activities.ssrf.socket.getaddrinfo",
            new=_mock_getaddrinfo(
                {
                    "mixed.invalid": [
                        ("93.184.216.34", 0),
                        ("10.0.0.5", 0),
                    ]
                }
            ),
        ):
            with self.assertRaises(UnsafeWebhookURL):
                validate_outbound_url("https://mixed.invalid/hook")

    def test_does_not_call_outbound_connection(self):
        # The helper must not import or call requests anywhere.
        from activities import ssrf

        self.assertFalse(hasattr(ssrf, "requests"))
        self.assertFalse(hasattr(ssrf, "urlopen"))


# ---------------------------------------------------------------------------
# SSRF integration through serializer (write time)
# ---------------------------------------------------------------------------


class WebhookSerializerSSRFTests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(name="T")
        self.admin = _make_user("TENANT_ADMIN", tenant=self.tenant, username="admin_s")

    def test_create_rejects_http(self):
        from activities.serializers_webhooks import LiveMapAlertWebhookSerializer

        s = LiveMapAlertWebhookSerializer(
            data={"url": "http://example.com/x", "secret": "s", "events": ["test_ping"]}
        )
        self.assertFalse(s.is_valid())
        self.assertIn("url", s.errors)

    def test_create_rejects_private_ip_literal(self):
        from activities.serializers_webhooks import LiveMapAlertWebhookSerializer

        s = LiveMapAlertWebhookSerializer(
            data={"url": "https://10.0.0.1/x", "secret": "s", "events": ["test_ping"]}
        )
        self.assertFalse(s.is_valid())
        self.assertIn("url", s.errors)

    def test_update_revalidates_url(self):
        from activities.serializers_webhooks import LiveMapAlertWebhookSerializer

        wh = LiveMapAlertWebhook.objects.create(
            tenant=self.tenant,
            url="https://example.com/hook",
            secret="s",
            events=["test_ping"],
        )
        s = LiveMapAlertWebhookSerializer(
            wh,
            data={
                "url": "https://10.0.0.1/bad",
                "secret": "s",
                "events": ["test_ping"],
            },
            partial=True,
        )
        self.assertFalse(s.is_valid())
        self.assertIn("url", s.errors)

    def test_serializer_error_shape_is_flat_field_level(self):
        # F-3: the field-level error must be a list of strings under the
        # ``url`` key, not a nested dict that repeats the field name. The
        # helper must not raise ``ValidationError({"url": {"url": [...]}})``.
        from activities.serializers_webhooks import _validate_outbound_url

        with self.assertRaises(serializers.ValidationError) as cm:
            _validate_outbound_url("https://10.0.0.1/leak")
        # DRF raises ``ValidationError([...])`` which serialises to a flat
        # list of strings. Normalise via the serializer's own ``errors``.
        from activities.serializers_webhooks import LiveMapAlertWebhookSerializer

        s = LiveMapAlertWebhookSerializer(
            data={"url": "https://10.0.0.1/leak", "secret": "s", "events": ["test_ping"]}
        )
        self.assertFalse(s.is_valid())
        url_errors = s.errors.get("url")
        self.assertIsInstance(url_errors, list)
        self.assertTrue(url_errors, "url errors must be a non-empty list")
        for item in url_errors:
            self.assertIsInstance(item, str)
            self.assertNotIn("leak", item)
        # Defence in depth: the raised ValidationError detail must not itself
        # be a dict (which would render as ``{"url": {"url": [...]}}``).
        self.assertNotIsInstance(cm.exception.detail, dict)

    def test_exception_message_does_not_leak_full_url(self):
        # The raw helper exception reason must not include the full URL path,
        # the host, the resolved IP, userinfo, or query string. All reasons
        # are fixed strings — we assert on the stable reason code instead.
        try:
            validate_outbound_url("https://10.0.0.1/very-secret-path?token=abc")
        except UnsafeWebhookURL as exc:
            msg = str(exc)
            self.assertNotIn("very-secret-path", msg)
            self.assertNotIn("token=abc", msg)
            self.assertNotIn("10.0.0.1", msg)
            self.assertEqual(msg, UnsafeWebhookURL.REASON_NON_PUBLIC)

    def test_rejects_invalid_port_alpha(self):
        with self.assertRaises(UnsafeWebhookURL) as cm:
            validate_outbound_url("https://example.com:abc/hook")
        self.assertEqual(str(cm.exception), UnsafeWebhookURL.REASON_INVALID_PORT)

    def test_rejects_invalid_port_out_of_range_high(self):
        with self.assertRaises(UnsafeWebhookURL) as cm:
            validate_outbound_url("https://example.com:99999/hook")
        self.assertEqual(str(cm.exception), UnsafeWebhookURL.REASON_INVALID_PORT)

    def test_rejects_invalid_port_zero(self):
        with self.assertRaises(UnsafeWebhookURL) as cm:
            validate_outbound_url("https://example.com:0/hook")
        self.assertEqual(str(cm.exception), UnsafeWebhookURL.REASON_INVALID_PORT)

    def test_accepts_valid_port(self):
        with patch(
            "activities.ssrf.socket.getaddrinfo",
            new=_mock_getaddrinfo({"example.com": [("93.184.216.34", 0)]}),
        ):
            self.assertEqual(
                validate_outbound_url("https://example.com:8443/hook"),
                "https://example.com:8443/hook",
            )

    def test_invalid_port_message_does_not_echo_port_value_or_host(self):
        # The fixed reason must not leak the user-supplied port value, the
        # hostname, or any URL fragment. Only the stable reason string is OK.
        try:
            validate_outbound_url("https://attacker.example:99999/leak?token=abc")
        except UnsafeWebhookURL as exc:
            msg = str(exc)
            self.assertEqual(msg, UnsafeWebhookURL.REASON_INVALID_PORT)
            self.assertNotIn("99999", msg)
            self.assertNotIn("attacker", msg)
            self.assertNotIn("leak", msg)
            self.assertNotIn("token", msg)


# ---------------------------------------------------------------------------
# DNS lookup counting (single source of validation)
# ---------------------------------------------------------------------------


class SerializerDNSLookupCountTests(TestCase):
    """F-4: serializer must call ``socket.getaddrinfo`` exactly once on create
    and only when the payload actually contains ``url``. Partial updates that
    omit ``url`` must not trigger the resolver at all.
    """

    def setUp(self):
        self.tenant = Tenant.objects.create(name="DNS")
        self.admin = _make_user("TENANT_ADMIN", tenant=self.tenant, username="admin_dns")

    def _counting_getaddrinfo(self):
        counter = {"n": 0}

        def _fake(host, *args, **kwargs):
            counter["n"] += 1
            # Public IPv4 response so the URL is accepted by the guard.
            return [_FakeAddrInfo(("93.184.216.34", 0))]

        return _fake, counter

    def test_create_calls_getaddrinfo_exactly_once(self):
        from activities.serializers_webhooks import LiveMapAlertWebhookSerializer

        fake, counter = self._counting_getaddrinfo()
        with patch("activities.ssrf.socket.getaddrinfo", new=fake):
            s = LiveMapAlertWebhookSerializer(
                data={
                    "url": "https://example.com/hook",
                    "secret": "s",
                    "events": ["test_ping"],
                }
            )
            self.assertTrue(s.is_valid(), s.errors)
            wh = s.save(tenant=self.tenant)
        self.assertEqual(counter["n"], 1)

    def test_partial_update_with_url_validates_once(self):
        from activities.serializers_webhooks import LiveMapAlertWebhookSerializer

        wh = LiveMapAlertWebhook.objects.create(
            tenant=self.tenant,
            url="https://example.com/hook",
            secret="s",
            events=["test_ping"],
        )
        fake, counter = self._counting_getaddrinfo()
        with patch("activities.ssrf.socket.getaddrinfo", new=fake):
            s = LiveMapAlertWebhookSerializer(
                wh,
                data={"url": "https://other.example/hook2"},
                partial=True,
            )
            self.assertTrue(s.is_valid(), s.errors)
            s.save()
        self.assertEqual(counter["n"], 1)

    def test_partial_update_without_url_skips_dns(self):
        from activities.serializers_webhooks import LiveMapAlertWebhookSerializer

        wh = LiveMapAlertWebhook.objects.create(
            tenant=self.tenant,
            url="https://example.com/hook",
            secret="s",
            events=["test_ping"],
        )
        fake, counter = self._counting_getaddrinfo()
        with patch("activities.ssrf.socket.getaddrinfo", new=fake):
            s = LiveMapAlertWebhookSerializer(
                wh,
                data={"enabled": False},
                partial=True,
            )
            self.assertTrue(s.is_valid(), s.errors)
            s.save()
        self.assertEqual(counter["n"], 0)


# ---------------------------------------------------------------------------
# Worker SSRF guard
# ---------------------------------------------------------------------------


class WorkerSSRFGuardTests(TestCase):
    # Unique canary tokens — short single letters would collide with
    # legitimate field names (status, unsafe_url) used in the delivery log.
    CANARY_SECRET = "super-secret-canary-t09"
    CANARY_URL = "http://10.0.0.5/canary-path?token=canary"

    def setUp(self):
        self.tenant = Tenant.objects.create(name="WT")
        # Webhook record points at an unsafe URL — simulating an out-of-band
        # record edit that bypassed serializer validation.
        self.wh = LiveMapAlertWebhook.objects.create(
            tenant=self.tenant,
            url=self.CANARY_URL,
            secret=self.CANARY_SECRET,
            events=["test_ping"],
        )

    def _run(self):
        from activities.tasks import deliver_live_map_webhook

        result = deliver_live_map_webhook(self.wh.id, "evt-1", {"event": "test_ping"})
        return result

    def test_requests_post_not_called_for_unsafe_url(self):
        with patch("activities.tasks.requests.post") as mock_post:
            result = self._run()
        mock_post.assert_not_called()
        self.wh.refresh_from_db()
        self.assertEqual(self.wh.delivery_log[0]["status"], "blocked")
        self.assertEqual(result["status"], "blocked")
        self.assertEqual(result["reason"], "unsafe_url")

    def test_failure_count_incremented(self):
        with patch("activities.tasks.requests.post") as mock_post:
            self._run()
        mock_post.assert_not_called()
        self.wh.refresh_from_db()
        self.assertEqual(self.wh.failure_count, 1)

    def test_blocked_log_does_not_leak_url_or_secret(self):
        with patch("activities.tasks.requests.post") as mock_post:
            self._run()
        mock_post.assert_not_called()
        self.wh.refresh_from_db()
        entry = self.wh.delivery_log[0]
        payload = json_dumps(entry)
        # Canary values must not appear anywhere in the persisted log.
        self.assertNotIn(self.CANARY_SECRET, payload)
        self.assertNotIn(self.CANARY_URL, payload)
        # ``secret`` is not exposed as a delivery-log field name.
        self.assertNotIn("secret", entry)
        # Status / reason are stable codes, not a re-raised exception text.
        self.assertEqual(entry["status"], "blocked")
        self.assertEqual(entry["reason"], "unsafe_url")

    def test_blocked_not_retried(self):
        with patch("activities.tasks.requests.post") as mock_post:
            with patch("activities.tasks.deliver_live_map_webhook.retry") as mock_retry:
                result = self._run()
        mock_post.assert_not_called()
        mock_retry.assert_not_called()
        self.assertEqual(result["status"], "blocked")

    def test_blocked_99999_port_short_circuits_before_requests(self):
        # F-1: an out-of-band port value must never reach ``requests.post``.
        # ``validate_outbound_url`` rejects it via the fixed
        # ``URL contains an invalid port.`` reason; the worker must not
        # retry and must record ``status=blocked``.
        from activities.tasks import deliver_live_map_webhook

        wh = LiveMapAlertWebhook.objects.create(
            tenant=self.tenant,
            url="https://example.com:99999/hook",
            secret=self.CANARY_SECRET,
            events=["test_ping"],
        )
        with patch("activities.tasks.requests.post") as mock_post:
            with patch("activities.tasks.deliver_live_map_webhook.retry") as mock_retry:
                result = deliver_live_map_webhook(wh.id, "evt-2", {"event": "test_ping"})
        mock_post.assert_not_called()
        mock_retry.assert_not_called()
        self.assertEqual(result["status"], "blocked")
        self.assertEqual(result["reason"], "unsafe_url")
        wh.refresh_from_db()
        entry = wh.delivery_log[0]
        self.assertEqual(entry["status"], "blocked")
        self.assertEqual(entry["reason"], "unsafe_url")
        # No part of the configured URL (port value, host, path, query) may
        # leak into the persisted log.
        payload = json_dumps(entry)
        self.assertNotIn("99999", payload)
        self.assertNotIn("example.com", payload)
        self.assertNotIn(self.CANARY_SECRET, payload)

    def test_blocked_logger_does_not_leak_url_host_ip_or_canary(self):
        # F-2: even when the helper is exercised with mixed public/private
        # DNS, the application logger must contain only the stable blocked
        # reason — never the URL, hostname, resolved IP, canary secret or
        # canary token.
        import logging as _logging

        from activities.tasks import deliver_live_map_webhook

        # Public + private mix — exercises the "non-public" branch without
        # having to depend on the worker's saved ``wh.url``.
        fake = _mock_getaddrinfo(
            {
                "mixed.example": [
                    ("93.184.216.34", 0),
                    ("10.0.0.5", 0),
                ]
            }
        )
        wh = LiveMapAlertWebhook.objects.create(
            tenant=self.tenant,
            url="https://mixed.example/canary-path?token=canary",
            secret=self.CANARY_SECRET,
            events=["test_ping"],
        )
        records = []

        class _CaptureHandler(_logging.Handler):
            def emit(self, record):
                records.append(record)

        capture = _CaptureHandler(level=_logging.WARNING)
        logger_under_test = _logging.getLogger("activities.tasks")
        logger_under_test.addHandler(capture)
        try:
            with patch("activities.tasks.requests.post") as mock_post:
                with patch("activities.tasks.deliver_live_map_webhook.retry") as mock_retry:
                    with patch("activities.ssrf.socket.getaddrinfo", new=fake):
                        result = deliver_live_map_webhook(wh.id, "evt-mix", {"event": "test_ping"})
        finally:
            logger_under_test.removeHandler(capture)
        mock_post.assert_not_called()
        mock_retry.assert_not_called()
        self.assertEqual(result["status"], "blocked")
        self.assertTrue(records, "expected at least one captured log record")
        for record in records:
            # ``getMessage`` is what Celery / Logstash / Sentry actually see.
            rendered = record.getMessage()
            formatted = rendered  # ``LogRecord`` has no ``format(record)``; ``getMessage`` is the canonical final string.
            self.assertNotIn("mixed.example", rendered)
            self.assertNotIn("canary-path", rendered)
            self.assertNotIn("token=canary", rendered)
            self.assertNotIn(self.CANARY_SECRET, rendered)
            self.assertNotIn("10.0.0.5", rendered)
            self.assertNotIn("mixed.example", formatted)
            self.assertNotIn("10.0.0.5", formatted)


class WorkerSafeDeliveryTests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(name="WS")
        self.wh = LiveMapAlertWebhook.objects.create(
            tenant=self.tenant,
            url="https://example.com/hook",
            secret="s",
            events=["test_ping"],
        )

    def _run(self, mock_response):
        from activities.tasks import deliver_live_map_webhook

        with patch("activities.tasks.requests.post", return_value=mock_response) as mock_post:
            result = deliver_live_map_webhook(self.wh.id, "evt-1", {"event": "test_ping"})
        return mock_post, result

    def test_safe_delivery_uses_timeout_and_no_redirects(self):
        resp = _Resp(200)
        mock_post, result = self._run(resp)
        kwargs = mock_post.call_args.kwargs
        self.assertEqual(kwargs.get("timeout"), 10)
        self.assertEqual(kwargs.get("allow_redirects"), False)
        self.assertEqual(result["status"], "ok")

    def test_redirect_is_not_success_and_does_not_retry(self):
        from activities.tasks import deliver_live_map_webhook

        resp = _Resp(302)
        with patch("activities.tasks.requests.post", return_value=resp) as mock_post:
            with patch("activities.tasks.deliver_live_map_webhook.retry") as mock_retry:
                result = deliver_live_map_webhook(self.wh.id, "evt-1", {"event": "test_ping"})
        mock_post.assert_called_once()
        mock_retry.assert_not_called()
        self.assertEqual(result["status"], "redirect_blocked")
        self.wh.refresh_from_db()
        entry = self.wh.delivery_log[0]
        self.assertEqual(entry["status"], "redirect_blocked")
        self.assertEqual(self.wh.failure_count, 1)


class WorkerRequestExceptionRedactionTests(TestCase):
    """General outbound HTTP exception path must not leak URL or canary."""

    CANARY_URL = "https://canary.example.invalid/leak?token=canary-tok-9"
    CANARY_SECRET = "super-secret-canary-t09-req"

    def setUp(self):
        self.tenant = Tenant.objects.create(name="RE")
        self.wh = LiveMapAlertWebhook.objects.create(
            tenant=self.tenant,
            url=self.CANARY_URL,
            secret=self.CANARY_SECRET,
            events=["test_ping"],
        )

    def test_connection_error_does_not_leak_url_or_canary(self):
        import logging as _logging

        import requests as _requests

        from activities.tasks import deliver_live_map_webhook

        # ``requests.ConnectionError`` constructed with a URL-bearing message
        # is what urllib3 raises in the wild — the message echoes the full
        # URL. We assert that path is fully redacted.
        boom = _requests.ConnectionError(f"Could not connect to {self.CANARY_URL}")

        records = []

        class _CaptureHandler(_logging.Handler):
            def emit(self, record):
                records.append(record)

        capture = _CaptureHandler(level=_logging.WARNING)
        logger_under_test = _logging.getLogger("activities.tasks")
        logger_under_test.addHandler(capture)
        retry_calls = []

        class _StopRetry(Exception):
            """Sentinel raised by the mocked ``retry`` to stop the task."""

        def _fake_retry(*args, **kwargs):
            retry_calls.append((args, kwargs))
            # ``deliver_live_map_webhook`` wraps the call as
            # ``raise self.retry(...)``, so a real Celery ``retry`` raises.
            # Mirror that with a sentinel we can catch in the test.
            raise _StopRetry()

        # The URL must pass the SSRF guard before we can exercise the
        # ``requests.post`` failure branch. The canary hostname is in the
        # *message* of the exception, not in any DNS answer.
        fake_dns = _mock_getaddrinfo({"canary.example.invalid": [("93.184.216.34", 0)]})

        try:
            with patch(
                "activities.tasks.requests.post",
                side_effect=boom,
            ):
                with patch(
                    "activities.tasks.deliver_live_map_webhook.retry",
                    side_effect=_fake_retry,
                ):
                    with patch("activities.ssrf.socket.getaddrinfo", new=fake_dns):
                        with self.assertRaises(_StopRetry):
                            deliver_live_map_webhook(self.wh.id, "evt-x", {"event": "test_ping"})
        finally:
            logger_under_test.removeHandler(capture)

        # ``requests.post`` was called once — the failure happens after.
        # The blocked path is not taken (the URL passes the SSRF guard because
        # ``socket.getaddrinfo`` is mocked at the module level). Retry must
        # have been invoked exactly once with a sanitised exception.
        self.assertEqual(len(retry_calls), 1, retry_calls)
        args, kwargs = retry_calls[0]
        passed_exc = kwargs.get("exc") or (args[0] if args else None)
        self.assertIsNotNone(passed_exc)
        # The exception passed to retry must be the safe wrapper, never the
        # original ``requests.ConnectionError`` whose message contains the URL.
        from activities.tasks import WebhookDeliveryError

        self.assertIsInstance(passed_exc, WebhookDeliveryError)
        self.assertEqual(passed_exc.error_type, "ConnectionError")
        self.assertNotIn(self.CANARY_URL, str(passed_exc))
        self.assertNotIn(self.CANARY_SECRET, str(passed_exc))

        # Delivery log: ``error`` is replaced by ``error_type`` + stable reason.
        self.wh.refresh_from_db()
        entry = self.wh.delivery_log[0]
        self.assertEqual(entry["status"], "retry")
        self.assertEqual(entry["reason"], "delivery_error")
        self.assertEqual(entry["error_type"], "ConnectionError")
        self.assertNotIn("error", entry)  # old, leaking field is gone
        payload = json_dumps(entry)
        self.assertNotIn(self.CANARY_URL, payload)
        self.assertNotIn(self.CANARY_SECRET, payload)
        self.assertNotIn("canary.example.invalid", payload)
        self.assertNotIn("canary-tok-9", payload)

        # Logger: must contain only the stable error_type, never the URL or
        # canary values. ``getMessage()`` is the canonical rendered string.
        self.assertTrue(records)
        for record in records:
            rendered = record.getMessage()
            for forbidden in (
                self.CANARY_URL,
                self.CANARY_SECRET,
                "canary.example.invalid",
                "canary-tok-9",
            ):
                self.assertNotIn(forbidden, rendered)


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


class _Resp:
    def __init__(self, status_code):
        self.status_code = status_code
        self.text = ""


def json_dumps(obj):
    import json

    return json.dumps(obj, default=str)
