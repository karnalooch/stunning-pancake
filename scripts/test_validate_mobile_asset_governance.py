from __future__ import annotations

import copy
import hashlib
import struct
import tempfile
import unittest
import zlib
from pathlib import Path

from scripts.validate_mobile_asset_governance import load_policy, validate_policy

ROOT = Path(__file__).resolve().parent.parent
POLICY_PATH = ROOT / "assets" / "ASSET_GOVERNANCE_V1.json"


class AssetGovernanceValidatorTests(unittest.TestCase):
    def setUp(self):
        self.policy = load_policy(POLICY_PATH)

    def test_repository_policy_passes(self):
        self.assertEqual(validate_policy(self.policy, ROOT), [])


    def test_ride_marker_png_is_valid_rgba_and_matches_governance_digest(self):
        path = ROOT / "mobile" / "assets" / "approved" / "v1" / "ride_marker_rider_v1.png"
        data = path.read_bytes()

        target = next(
            target
            for target in self.policy["productionTargets"]
            if target["id"] == "ride_marker_rider_v1"
        )
        self.assertEqual(
            hashlib.sha256(data).hexdigest(),
            target["provenance"]["sha256"],
            "ride marker bytes must match the governed immutable digest",
        )

        signature = b"\x89PNG\r\n\x1a\n"
        self.assertTrue(data.startswith(signature))

        offset = len(signature)
        chunks: list[tuple[bytes, bytes]] = []
        while offset < len(data):
            self.assertGreaterEqual(
                len(data) - offset,
                12,
                "truncated PNG chunk header",
            )
            length = struct.unpack(">I", data[offset : offset + 4])[0]
            kind = data[offset + 4 : offset + 8]
            payload_start = offset + 8
            payload_end = payload_start + length
            crc_end = payload_end + 4
            self.assertLessEqual(crc_end, len(data), f"truncated PNG chunk {kind!r}")

            payload = data[payload_start:payload_end]
            expected_crc = struct.unpack(">I", data[payload_end:crc_end])[0]
            actual_crc = zlib.crc32(kind + payload) & 0xFFFFFFFF
            self.assertEqual(expected_crc, actual_crc, f"CRC mismatch in PNG chunk {kind!r}")
            chunks.append((kind, payload))
            offset = crc_end

            if kind == b"IEND":
                break

        self.assertEqual(offset, len(data), "unexpected bytes after IEND")
        self.assertTrue(chunks)
        self.assertEqual(chunks[0][0], b"IHDR")
        self.assertEqual(chunks[-1][0], b"IEND")
        self.assertEqual(chunks[-1][1], b"")

        ihdr = chunks[0][1]
        self.assertEqual(len(ihdr), 13)
        width, height, bit_depth, color_type, compression, filter_method, interlace = struct.unpack(
            ">IIBBBBB", ihdr
        )
        self.assertEqual((width, height), (64, 64))
        self.assertEqual((bit_depth, color_type, compression, filter_method, interlace), (8, 6, 0, 0, 0))

        idat = b"".join(payload for kind, payload in chunks if kind == b"IDAT")
        self.assertTrue(idat, "PNG must contain IDAT data")
        decoded = zlib.decompress(idat)
        self.assertEqual(len(decoded), height * (1 + width * 4))


    def test_duplicate_target_id_fails(self):
        policy = copy.deepcopy(self.policy)
        policy["productionTargets"].append(copy.deepcopy(policy["productionTargets"][0]))
        errors = validate_policy(policy, ROOT)
        self.assertTrue(any("duplicate production target id" in error for error in errors))

    def test_generated_official_crest_policy_fails(self):
        policy = copy.deepcopy(self.policy)
        policy["placeIdentity"]["officialCrestMayBeAiGenerated"] = True
        errors = validate_policy(policy, ROOT)
        self.assertIn("official crests must never be AI-generated", errors)

    def test_missing_place_fallback_fails(self):
        policy = copy.deepcopy(self.policy)
        policy["placeIdentity"]["fallbackRequired"] = False
        errors = validate_policy(policy, ROOT)
        self.assertIn("place identity fallback must be mandatory", errors)

    def test_approved_asset_requires_provenance_and_digest(self):
        policy = copy.deepcopy(self.policy)
        policy["productionTargets"][0]["status"] = "approved"
        policy["productionTargets"][0].pop("provenance", None)
        errors = validate_policy(policy, ROOT)
        self.assertTrue(any("approved asset requires provenance" in error for error in errors))

        policy["productionTargets"][0]["provenance"] = {
            "sourceType": "human_authored",
            "sourceReference": "asset-ticket-1",
            "rightsStatus": "owned",
            "sha256": "not-a-digest",
            "createdAt": "2026-09-25",
        }
        errors = validate_policy(policy, ROOT)
        self.assertTrue(any("sha256 must be 64 lowercase hex chars" in error for error in errors))

    def test_legacy_inventory_drift_fails(self):
        policy = copy.deepcopy(self.policy)
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            generated = root / "assets" / "generated"
            generated.mkdir(parents=True)
            (generated / "one.png").write_bytes(b"x")
            policy["legacyGeneratedPolicy"]["expectedVisualFileCount"] = 0
            errors = validate_policy(policy, root)
        self.assertTrue(any("legacy visual inventory drift" in error for error in errors))

    def test_legacy_runtime_use_must_be_forbidden(self):
        policy = copy.deepcopy(self.policy)
        policy["legacyGeneratedPolicy"]["temporaryRuntimeUseAllowed"] = True
        errors = validate_policy(policy, ROOT)
        self.assertIn("legacy generated assets must not be allowed at runtime", errors)

    def test_screen_coverage_unknown_target_fails(self):
        policy = copy.deepcopy(self.policy)
        policy["screenAssetCoverage"]["profile"]["requiredTargets"].append("missing_asset_v1")
        errors = validate_policy(policy, ROOT)
        self.assertTrue(any("unknown target missing_asset_v1" in error for error in errors))

    def test_covered_screen_requires_approved_targets(self):
        policy = copy.deepcopy(self.policy)
        home = next(target for target in policy["productionTargets"] if target["id"] == "home_hero_day_v1")
        home["status"] = "planned"
        home.pop("provenance", None)
        errors = validate_policy(policy, ROOT)
        self.assertTrue(
            any(
                "covered surface requires approved target home_hero_day_v1" in error
                for error in errors
            )
        )

    def test_data_first_screen_cannot_require_decorative_target(self):
        policy = copy.deepcopy(self.policy)
        policy["screenAssetCoverage"]["activity_detail"]["requiredTargets"] = ["summary_finish_v1"]
        errors = validate_policy(policy, ROOT)
        self.assertTrue(
            any("data_first surfaces must not require decorative asset targets" in error for error in errors)
        )


if __name__ == "__main__":
    unittest.main()
