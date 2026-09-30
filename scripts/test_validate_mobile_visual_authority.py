from __future__ import annotations

import copy
import unittest
from pathlib import Path

from scripts.validate_mobile_visual_authority import load_policy, validate

ROOT = Path(__file__).resolve().parent.parent
POLICY = ROOT / "docs" / "design" / "MOBILE_UI_VISUAL_AUTHORITY_V1.json"


class MobileVisualAuthorityTests(unittest.TestCase):
    def setUp(self):
        self.policy = load_policy(POLICY)

    def test_repository_policy_passes(self):
        self.assertEqual(validate(self.policy, ROOT), [])

    def test_green_generic_selection_cannot_be_reenabled(self):
        policy = copy.deepcopy(self.policy)
        policy["frozenAssertions"]["genericGreenSelectionAllowed"] = True
        errors = validate(policy, ROOT)
        self.assertTrue(any("genericGreenSelectionAllowed" in error for error in errors))

    def test_takeover_boundary_cannot_move_silently(self):
        policy = copy.deepcopy(self.policy)
        policy["supersessionBoundary"]["t00PullRequest"] = 59
        errors = validate(policy, ROOT)
        self.assertTrue(any("T00 / PR #60" in error for error in errors))

    def test_legacy_sources_require_marker(self):
        policy = copy.deepcopy(self.policy)
        policy["legacyMarker"] = "marker-that-does-not-exist"
        errors = validate(policy, ROOT)
        self.assertTrue(any("lacks superseded marker" in error for error in errors))

    def test_visual_tooling_must_keep_github_as_system_of_record(self):
        policy = copy.deepcopy(self.policy)
        policy["toolingGate"]["githubSystemOfRecord"] = False
        errors = validate(policy, ROOT)
        self.assertTrue(any("githubSystemOfRecord" in error for error in errors))

    def test_saas_only_visual_authority_cannot_be_enabled(self):
        policy = copy.deepcopy(self.policy)
        policy["toolingGate"]["saasOnlyAuthorityAllowed"] = True
        errors = validate(policy, ROOT)
        self.assertTrue(any("saasOnlyAuthorityAllowed" in error for error in errors))

    def test_visual_tooling_requires_license_and_provenance(self):
        policy = copy.deepcopy(self.policy)
        policy["toolingGate"]["licenseAndProvenanceRequired"] = False
        errors = validate(policy, ROOT)
        self.assertTrue(any("licenseAndProvenanceRequired" in error for error in errors))

    def test_required_github_integration_modes_cannot_disappear(self):
        policy = copy.deepcopy(self.policy)
        policy["toolingGate"]["acceptedIntegrationModes"] = []
        errors = validate(policy, ROOT)
        self.assertTrue(any("acceptedIntegrationModes" in error for error in errors))

    def test_old_green_contract_phrase_is_forbidden(self):
        contract = (ROOT / "docs" / "design" / "MOBILE_UI_DESIGN_CONTRACT_V1.md").read_text(encoding="utf-8").lower()
        self.assertNotIn("deep/dark green as the principal brand field", contract)
        self.assertNotIn("gold or strong green depending on context", contract)


if __name__ == "__main__":
    unittest.main()
