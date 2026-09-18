from __future__ import annotations

import unittest

from scripts.plan_affected_tests import plan_from_files


class AffectedTestPlannerTests(unittest.TestCase):
    def test_docs_only_skips_runtime_tests(self):
        plan = plan_from_files(["docs/backend/API.md"])
        self.assertEqual(plan["risk"], "R0")
        self.assertEqual(plan["mobile"]["mode"], "skip")
        self.assertEqual(plan["backend"]["mode"], "skip")

    def test_mobile_leaf_uses_related_tests(self):
        plan = plan_from_files(["mobile/src/components/MetricStrip.tsx"])
        self.assertEqual(plan["mobile"]["mode"], "related")
        self.assertIn("mobile/src/components/MetricStrip.tsx", plan["mobile"]["relatedFiles"])
        self.assertFalse(plan["fullFallback"])

    def test_mobile_navigation_is_full(self):
        plan = plan_from_files(["mobile/src/navigation/GameTabBar.tsx"])
        self.assertEqual(plan["mobile"]["mode"], "full")
        self.assertGreaterEqual(int(plan["risk"][1:]), 3)

    def test_gps_change_adds_mandatory_durability_and_ride_suites(self):
        plan = plan_from_files(["mobile/src/services/gpsActivityQueue.ts"])
        self.assertEqual(plan["mobile"]["mode"], "related")
        self.assertIn("gps_durability", plan["mobile"]["mandatorySuites"])
        self.assertIn("ride_safety", plan["mobile"]["mandatorySuites"])
        self.assertEqual(plan["risk"], "R4")

    def test_changed_mobile_test_runs_directly(self):
        path = "mobile/__tests__/services/gpsQualityFilter.test.ts"
        plan = plan_from_files([path])
        self.assertEqual(plan["mobile"]["mode"], "related")
        self.assertIn(path, plan["mobile"]["directTests"])

    def test_shared_tokens_force_full_mobile_and_admin_not_backend(self):
        plan = plan_from_files(["packages/tokens/src/colors.ts"])
        self.assertEqual(plan["mobile"]["mode"], "full")
        self.assertEqual(plan["admin"]["mode"], "full")
        self.assertEqual(plan["backend"]["mode"], "skip")

    def test_backend_gpx_change_uses_domain_suite(self):
        plan = plan_from_files(["backend/activities/gpx_export.py"])
        self.assertEqual(plan["backend"]["mode"], "domain")
        self.assertIn("gpx_data", plan["backend"]["mandatorySuites"])

    def test_backend_shared_services_change_is_full(self):
        plan = plan_from_files(["backend/activities/services.py"])
        self.assertEqual(plan["backend"]["mode"], "full")
        self.assertEqual(plan["risk"], "R4")

    def test_backend_migration_is_full(self):
        plan = plan_from_files(["backend/users/migrations/0024_example.py"])
        self.assertEqual(plan["backend"]["mode"], "full")

    def test_tenant_change_adds_rls(self):
        plan = plan_from_files(["backend/users/department_views.py"])
        self.assertEqual(plan["backend"]["mode"], "domain")
        self.assertIn("tenant_security", plan["backend"]["mandatorySuites"])
        self.assertIn("rls", plan["backend"]["mandatorySuites"])

    def test_auth_change_is_full_backend(self):
        plan = plan_from_files(["backend/users/jwt_auth.py"])
        self.assertEqual(plan["backend"]["mode"], "full")
        self.assertEqual(plan["risk"], "R4")

    def test_telemetry_is_always_full_component(self):
        plan = plan_from_files(["telemetry/app.py"])
        self.assertEqual(plan["telemetry"]["mode"], "full")
        self.assertEqual(plan["risk"], "R4")

    def test_visual_docs_require_visual_gate_without_runtime_tests(self):
        plan = plan_from_files(["docs/design/MOBILE_UI_DESIGN_CONTRACT_V1.md"])
        self.assertTrue(plan["visualContractRequired"])
        self.assertEqual(plan["mobile"]["mode"], "skip")

    def test_ci_core_change_fails_safe_repo_wide(self):
        plan = plan_from_files(["scripts/plan_affected_tests.py"])
        self.assertTrue(plan["fullFallback"])
        self.assertEqual(plan["risk"], "R5")
        for component in ("mobile", "backend", "telemetry", "admin"):
            self.assertEqual(plan[component]["mode"], "full")

    def test_unknown_runtime_path_fails_safe_full(self):
        plan = plan_from_files(["new-runtime-system/config.magic"])
        self.assertTrue(plan["fullFallback"])
        for component in ("mobile", "backend", "telemetry", "admin"):
            self.assertEqual(plan[component]["mode"], "full")

    def test_push_is_full_even_with_no_diff(self):
        plan = plan_from_files([], event_name="push")
        self.assertTrue(plan["fullFallback"])
        for component in ("mobile", "backend", "telemetry", "admin"):
            self.assertEqual(plan[component]["mode"], "full")

    def test_unsupported_event_is_full_not_skip(self):
        plan = plan_from_files([], event_name="workflow_dispatch")
        self.assertTrue(plan["fullFallback"])
        self.assertEqual(plan["risk"], "R5")


if __name__ == "__main__":
    unittest.main()
