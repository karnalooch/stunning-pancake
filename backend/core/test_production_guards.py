"""Tests for production guard helpers."""

from unittest.mock import patch

from django.test import SimpleTestCase

from core.production_guards import (
    DEV_SECRET_KEY,
    parse_allowed_hosts,
    resolve_secret_key,
    warn_insecure_allowed_hosts,
)


class ParseAllowedHostsTests(SimpleTestCase):
    def test_splits_and_strips(self):
        self.assertEqual(parse_allowed_hosts(" a.com , b.com "), ["a.com", "b.com"])

    def test_empty_defaults_wildcard(self):
        self.assertEqual(parse_allowed_hosts(""), ["*"])
        self.assertEqual(parse_allowed_hosts(None), ["*"])


class WarnInsecureAllowedHostsTests(SimpleTestCase):
    @patch("core.production_guards.is_production_runtime", return_value=True)
    def test_warns_on_wildcard_in_prod(self, _prod):
        with self.assertWarns(UserWarning) as ctx:
            warn_insecure_allowed_hosts(["*"], debug=False)
        self.assertIn("ALLOWED_HOSTS", str(ctx.warning))

    @patch("core.production_guards.is_production_runtime", return_value=False)
    def test_silent_when_not_production(self, _prod):
        with patch("warnings.warn") as mock_warn:
            warn_insecure_allowed_hosts(["*"], debug=True)
            mock_warn.assert_not_called()


class ResolveSecretKeyTests(SimpleTestCase):
    def test_debug_uses_dev_fallback_when_missing(self):
        self.assertEqual(resolve_secret_key(None, debug=True), DEV_SECRET_KEY)

    def test_debug_uses_explicit_key(self):
        self.assertEqual(resolve_secret_key("dev-explicit", debug=True), "dev-explicit")

    def test_production_rejects_missing_blank_or_dev_key(self):
        for value in (None, "", "   ", DEV_SECRET_KEY):
            with self.subTest(value=value), self.assertRaisesRegex(RuntimeError, "SECRET_KEY"):
                resolve_secret_key(value, debug=False)

    def test_production_accepts_explicit_stable_key(self):
        self.assertEqual(
            resolve_secret_key("prod-stable-signing-key", debug=False),
            "prod-stable-signing-key",
        )
