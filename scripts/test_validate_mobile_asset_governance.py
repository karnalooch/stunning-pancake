from __future__ import annotations

import copy
import tempfile
import unittest
from pathlib import Path

from scripts.validate_mobile_asset_governance import load_policy, validate_policy

ROOT = Path(__file__).resolve().parent.parent
POLICY_PATH = ROOT / "assets" / "ASSET_GOVERNANCE_V1.json"


class AssetGovernanceValidatorTests(unittest.TestCase):
    def setUp(self):
        self.policy = load_policy(POLICY_PATH)

    def test_repository_policy_passes(self):
        self.assertEqual(validate_policy(self.policy, ROOT), [])

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


if __name__ == "__main__":
    unittest.main()
