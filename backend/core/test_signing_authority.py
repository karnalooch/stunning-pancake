"""Signing configuration regressions; no database or secret material required."""

import os
import runpy
import sys
from pathlib import Path
from types import ModuleType
from unittest import TestCase
from unittest.mock import Mock, patch

from core.production_guards import resolve_secret_key


class SigningAuthorityTests(TestCase):
    tags = {"light"}

    def test_non_debug_rejects_missing_empty_whitespace_and_dev_default(self):
        for raw in (None, "", " \t\n", "default-unsafe-key-for-dev"):
            with self.subTest(raw=raw), self.assertRaisesRegex(RuntimeError, "SECRET_KEY"):
                resolve_secret_key(raw, debug=False)

    def test_paas_does_not_generate_or_bypass_signing_authority(self):
        for marker in ("RAILWAY_SERVICE_NAME", "DYNO", "RENDER"):
            with self.subTest(marker=marker), patch.dict(os.environ, {marker: "test"}):
                with patch("secrets.token_urlsafe") as generate:
                    with self.assertRaisesRegex(RuntimeError, "SECRET_KEY"):
                        resolve_secret_key(None, debug=False)
                    generate.assert_not_called()

    def test_explicit_key_is_stable_and_not_normalized(self):
        raw = "  non-production-test-key-" * 4
        self.assertEqual(resolve_secret_key(raw, debug=False), raw)
        self.assertEqual(resolve_secret_key(raw, debug=False), raw)

    def test_local_debug_keeps_existing_behavior(self):
        self.assertEqual(resolve_secret_key(None, debug=True), "default-unsafe-key-for-dev")
        for raw in ("", " ", "local-test-key"):
            with self.subTest(raw=raw):
                self.assertEqual(resolve_secret_key(raw, debug=True), raw)

    def test_error_never_echoes_supplied_value(self):
        with self.assertRaises(RuntimeError) as caught:
            resolve_secret_key("default-unsafe-key-for-dev", debug=False)
        self.assertNotIn("default-unsafe-key-for-dev", str(caught.exception))

    def test_actual_settings_rejects_before_observability_or_database(self):
        sentry = ModuleType("core.sentry")
        sentry.init_sentry = Mock()
        settings_path = Path(__file__).with_name("settings.py")
        for raw in (None, "", "   ", "default-unsafe-key-for-dev"):
            environment = {"DEBUG": "0", "RAILWAY_SERVICE_NAME": "test-backend"}
            if raw is not None:
                environment["SECRET_KEY"] = raw
            with self.subTest(raw=raw), patch.dict(os.environ, environment, clear=True):
                with patch.dict(sys.modules, {"core.sentry": sentry}):
                    with self.assertRaisesRegex(RuntimeError, "SECRET_KEY must be set"):
                        runpy.run_path(str(settings_path))
        sentry.init_sentry.assert_not_called()
