"""MMKV v4 migration contract for 4VELO mobile."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MOBILE = ROOT / "mobile"
SRC = MOBILE / "src"
ADAPTER = SRC / "services" / "mmkvStorage.ts"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


class MobileMmkvV4ContractTests(unittest.TestCase):
    def test_supported_mmkv_and_nitro_versions_are_pinned(self):
        package = json.loads(read(MOBILE / "package.json"))
        deps = package["dependencies"]
        self.assertEqual(deps.get("react-native-mmkv"), "4.3.2")
        self.assertEqual(deps.get("react-native-nitro-modules"), "0.35.9")

    def test_native_mmkv_import_is_centralized(self):
        offenders: list[str] = []
        for path in SRC.rglob("*"):
            if path.suffix not in {".ts", ".tsx"}:
                continue
            if path == ADAPTER:
                continue
            if "react-native-mmkv" in read(path):
                offenders.append(str(path.relative_to(ROOT)))
        self.assertEqual(
            offenders,
            [],
            f"production code must access react-native-mmkv only through {ADAPTER.relative_to(ROOT)}",
        )

    def test_no_legacy_mmkv_constructor_remains_in_production_code(self):
        offenders: list[str] = []
        for path in SRC.rglob("*"):
            if path.suffix not in {".ts", ".tsx"}:
                continue
            if "new MMKV(" in read(path):
                offenders.append(str(path.relative_to(ROOT)))
        self.assertEqual(offenders, [])

    def test_adapter_translates_stable_delete_to_v4_remove(self):
        source = read(ADAPTER)
        self.assertIn("createMMKV", source)
        self.assertIn("native.remove(key)", source)
        self.assertNotIn("new MMKV", source)

    def test_encrypted_gps_storage_identity_is_preserved(self):
        source = read(SRC / "services" / "gpsEncryptedStorage.ts")
        for literal in (
            "4velo.gps.mmkv.encryption-key-v1",
            "gps-buffer-encrypted-v1",
            "gps-buffer",
            "gps-storage-bootstrap",
            "encryption-key-provisioned-v1",
        ):
            with self.subTest(literal=literal):
                self.assertIn(literal, source)
        self.assertIn("SecureStore.AFTER_FIRST_UNLOCK", source)
        self.assertIn("createAppMmkv({", source)

    def test_native_runtime_version_boundary_is_bumped(self):
        release = json.loads(read(ROOT / "version.json"))
        version = tuple(int(part) for part in release["version"].split("."))
        self.assertGreaterEqual(version, (0, 3, 4))
        app_config = read(MOBILE / "app.config.js")
        self.assertIn('"policy": "appVersion"', app_config)


if __name__ == "__main__":
    unittest.main()
