# CI/CD documentation

| | |
|--|--|
| **Status** | ✅ Active |
| **Document class** | REFERENCE |
| **Owner role** | Platform / CI maintainer |
| **Last reviewed** | 2026-09-28 |

Current CI/CD contracts and policies:

- [Affected test execution](AFFECTED_TEST_EXECUTION_V1.md)
- [Change classifier](CHANGE_CLASSIFIER_V1.md)
- [Full release lane](FULL_RELEASE_LANE_V1.md)
- [Auto-merge policy](AUTO_MERGE_POLICY_V1.md)
- [Auto-merge live proof](AUTO_MERGE_LIVE_PROOF_V1.md) — evidence, not policy
- [Project status automation](PROJECT_STATUS_AUTOMATION_V1.md)

Workflow YAML remains the executable source for job wiring. Documents explain the contract; when docs and workflow disagree, fix them in the same PR.