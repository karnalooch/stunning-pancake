from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

REPO = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("versioning", REPO / "scripts" / "versioning.py")
assert SPEC and SPEC.loader
versioning = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(versioning)


class VersioningContractTests(unittest.TestCase):
    def test_repository_version_contract_is_consistent(self):
        self.assertEqual(versioning.check_contract(), [])

    def test_semver_label_formats_prerelease_and_stable_versions(self):
        self.assertEqual(
            versioning.semver_label({"version": "1.2.3", "prerelease": "dev"}),
            "1.2.3-dev",
        )
        self.assertEqual(
            versioning.semver_label({"version": "1.2.3", "prerelease": ""}),
            "1.2.3",
        )

    def test_stable_tag_is_rejected_during_prerelease_cycle(self):
        release = versioning.load_release()
        self.assertTrue(release["prerelease"])
        errors = versioning.check_contract(tag=f'v{release["version"]}')
        self.assertTrue(any("forbidden while prerelease" in error for error in errors))

    def test_bad_tag_is_rejected(self):
        release = versioning.load_release()
        major, minor, patch = (int(part) for part in release["version"].split("."))
        wrong_tag = f"v{major}.{minor}.{patch + 1}"
        expected_tag = f'v{release["version"]}'

        errors = versioning.check_contract(tag=wrong_tag)

        self.assertTrue(any(f"expected {expected_tag!r}" in error for error in errors))

    def test_set_version_validates_all_package_json_before_mutating(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            version_file = root / "version.json"
            package_a = root / "package-a.json"
            package_b = root / "package-b.json"
            version_file.write_text(
                json.dumps({"schemaVersion": 1, "version": "1.2.3", "prerelease": "dev"}),
                encoding="utf-8",
            )
            package_a.write_text(
                json.dumps({"name": "a", "version": "1.2.3-dev"}),
                encoding="utf-8",
            )
            package_b.write_text("{not-json", encoding="utf-8")
            before_version = version_file.read_bytes()
            before_a = package_a.read_bytes()

            with (
                patch.object(versioning, "VERSION_FILE", version_file),
                patch.object(versioning, "PACKAGE_FILES", (package_a, package_b)),
            ):
                with self.assertRaises(json.JSONDecodeError):
                    versioning.set_version("1.2.4", "rc.1")

            self.assertEqual(version_file.read_bytes(), before_version)
            self.assertEqual(package_a.read_bytes(), before_a)

    def test_set_version_rolls_back_if_atomic_replace_fails(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            version_file = root / "version.json"
            package_a = root / "package-a.json"
            package_b = root / "package-b.json"
            version_file.write_text(
                json.dumps({"schemaVersion": 1, "version": "1.2.3", "prerelease": "dev"}),
                encoding="utf-8",
            )
            package_a.write_text(
                json.dumps({"name": "a", "version": "1.2.3-dev"}),
                encoding="utf-8",
            )
            package_b.write_text(
                json.dumps({"name": "b", "version": "1.2.3-dev"}),
                encoding="utf-8",
            )
            before = {
                path: path.read_bytes()
                for path in (version_file, package_a, package_b)
            }

            real_replace = versioning.os.replace
            calls = {"count": 0}

            def fail_second_replace(src, dst):
                calls["count"] += 1
                if calls["count"] == 2:
                    raise OSError("simulated replace failure")
                return real_replace(src, dst)

            with (
                patch.object(versioning, "VERSION_FILE", version_file),
                patch.object(versioning, "PACKAGE_FILES", (package_a, package_b)),
                patch.object(versioning.os, "replace", side_effect=fail_second_replace),
            ):
                with self.assertRaises(OSError):
                    versioning.set_version("1.2.4", "")

            for path, payload in before.items():
                self.assertEqual(path.read_bytes(), payload)


if __name__ == "__main__":
    unittest.main()
