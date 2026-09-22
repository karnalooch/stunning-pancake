from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from scripts.validate_mobile_native_provenance import inspect_native_provenance


class MobileNativeProvenanceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.expo_config = self.root / "expo-public.json"
        self.version_file = self.root / "version.json"
        self.android_dir = self.root / "android"
        self.gradle = self.android_dir / "app" / "build.gradle"
        self.strings = (
            self.android_dir
            / "app"
            / "src"
            / "main"
            / "res"
            / "values"
            / "strings.xml"
        )
        self.gradle.parent.mkdir(parents=True)
        self.strings.parent.mkdir(parents=True)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def write_fixture(
        self,
        *,
        expo_package: str = "com.sport.athlete",
        expo_version: str = "0.3.4",
        release_version: str = "0.3.4",
        namespace: str = "com.sport.athlete",
        application_id: str = "com.sport.athlete",
        version_name: str = "0.3.4",
        runtime_version: str | None = "0.3.4",
    ) -> None:
        self.expo_config.write_text(
            json.dumps(
                {
                    "version": expo_version,
                    "runtimeVersion": {"policy": "appVersion"},
                    "android": {"package": expo_package},
                }
            ),
            encoding="utf-8",
        )
        self.version_file.write_text(
            json.dumps({"schemaVersion": 1, "version": release_version, "prerelease": "dev"}),
            encoding="utf-8",
        )
        self.gradle.write_text(
            f"""
android {{
    namespace '{namespace}'
    defaultConfig {{
        applicationId "{application_id}"
        versionCode 1
        versionName "{version_name}"
    }}
}}
""".strip(),
            encoding="utf-8",
        )
        runtime_line = (
            f'<string name="expo_runtime_version">{runtime_version}</string>'
            if runtime_version is not None
            else ""
        )
        self.strings.write_text(
            f"""<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">4VELO</string>
    {runtime_line}
</resources>
""",
            encoding="utf-8",
        )

    def validate(self):
        return inspect_native_provenance(
            expo_config=self.expo_config,
            version_file=self.version_file,
            android_dir=self.android_dir,
            git_sha="a" * 40,
        )

    def test_accepts_generated_tree_matching_resolved_expo_and_version_ssot(self):
        self.write_fixture()
        provenance, errors = self.validate()
        self.assertEqual(errors, [])
        self.assertIsNotNone(provenance)
        assert provenance is not None
        self.assertEqual(provenance.generated_application_id, "com.sport.athlete")
        self.assertEqual(provenance.generated_version_name, "0.3.4")
        self.assertEqual(provenance.generated_runtime_version, "0.3.4")

    def test_rejects_wrong_generated_package_identity(self):
        self.write_fixture(namespace="com.wrong.app", application_id="com.wrong.app")
        _, errors = self.validate()
        self.assertTrue(any("namespace" in error for error in errors))
        self.assertTrue(any("applicationId" in error for error in errors))

    def test_rejects_wrong_generated_version_name(self):
        self.write_fixture(version_name="1.0")
        _, errors = self.validate()
        self.assertTrue(any("versionName" in error for error in errors))

    def test_rejects_missing_runtime_version_resource(self):
        self.write_fixture(runtime_version=None)
        provenance, errors = self.validate()
        self.assertIsNone(provenance)
        self.assertTrue(any("expo_runtime_version" in error for error in errors))

    def test_rejects_resolved_expo_version_drift_from_version_json(self):
        self.write_fixture(expo_version="1.0")
        _, errors = self.validate()
        self.assertTrue(any("resolved Expo version" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
