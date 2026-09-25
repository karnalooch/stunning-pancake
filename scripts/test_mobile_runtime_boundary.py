from __future__ import annotations

import unittest

from scripts.validate_mobile_runtime_boundary import (
    ZERO_SHA,
    _resolve_base,
    evaluate_boundary,
    is_native_runtime_dependency,
    native_dependency_changes,
)


class MobileRuntimeBoundaryTests(unittest.TestCase):

    def test_missing_or_zero_base_fails_closed(self):
        for base in ("", ZERO_SHA):
            with self.subTest(base=base), self.assertRaises(ValueError):
                _resolve_base(base, "a" * 40)

    def test_trusted_base_is_used_verbatim(self):
        base = "b" * 40
        self.assertEqual(_resolve_base(base, "a" * 40), base)

    def test_classifies_native_runtime_dependencies(self):
        for name in (
            "expo",
            "expo-location",
            "react-native",
            "react-native-mmkv",
            "@react-native/community-cli",
            "@react-native-community/netinfo",
            "@react-native-firebase/app",
            "@maplibre/maplibre-react-native",
            "@shopify/react-native-skia",
        ):
            with self.subTest(name=name):
                self.assertTrue(is_native_runtime_dependency(name))

        for name in ("axios", "zustand", "@babel/runtime", "@4velo/api-client"):
            with self.subTest(name=name):
                self.assertFalse(is_native_runtime_dependency(name))

    def test_detects_native_dependency_version_change(self):
        base = {"dependencies": {"expo-location": "~55.1.14", "axios": "^1.20.0"}}
        head = {"dependencies": {"expo-location": "~55.1.15", "axios": "^1.21.0"}}

        self.assertEqual(native_dependency_changes(base, head), ["expo-location"])

    def test_js_only_dependency_change_does_not_require_boundary_bump(self):
        result = evaluate_boundary(
            base_version="0.3.4",
            head_version="0.3.4",
            base_package={"dependencies": {"axios": "^1.20.0"}},
            head_package={"dependencies": {"axios": "^1.21.0"}},
            app_config_changed=False,
        )
        self.assertFalse(result.requires_bump)
        self.assertFalse(result.bumped)

    def test_native_dependency_change_requires_numeric_app_version_bump(self):
        base = {"dependencies": {"react-native-mmkv": "4.3.2"}}
        head = {"dependencies": {"react-native-mmkv": "4.3.3"}}

        unchanged = evaluate_boundary(
            base_version="0.3.4",
            head_version="0.3.4",
            base_package=base,
            head_package=head,
            app_config_changed=False,
        )
        self.assertTrue(unchanged.requires_bump)
        self.assertFalse(unchanged.bumped)

        bumped = evaluate_boundary(
            base_version="0.3.4",
            head_version="0.3.5",
            base_package=base,
            head_package=head,
            app_config_changed=False,
        )
        self.assertTrue(bumped.requires_bump)
        self.assertTrue(bumped.bumped)

    def test_app_config_change_requires_boundary_bump(self):
        result = evaluate_boundary(
            base_version="0.3.4",
            head_version="0.3.4",
            base_package={"dependencies": {}},
            head_package={"dependencies": {}},
            app_config_changed=True,
        )
        self.assertEqual(result.reasons, ("mobile/app.config.js changed",))
        self.assertFalse(result.bumped)

    def test_committed_native_or_plugin_path_requires_boundary_bump(self):
        result = evaluate_boundary(
            base_version="0.3.4",
            head_version="0.3.5",
            base_package={"dependencies": {}},
            head_package={"dependencies": {}},
            app_config_changed=False,
            native_paths_changed=("mobile/plugins/example.js",),
        )
        self.assertTrue(result.requires_bump)
        self.assertTrue(result.bumped)


if __name__ == "__main__":
    unittest.main()
