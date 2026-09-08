"""Tests for production guard helpers."""

from unittest.mock import patch

from django.test import SimpleTestCase

from core.production_guards import parse_allowed_hosts, warn_insecure_allowed_hosts


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
