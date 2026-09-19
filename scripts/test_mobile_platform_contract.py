"""Fail closed on 4VELO mobile platform configuration drift."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MOBILE = ROOT / "mobile"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


class MobilePlatformContractTests(unittest.TestCase):
    def test_mobile_is_the_only_eas_root(self):
        self.assertFalse((ROOT / "eas.json").exists(), "root eas.json is forbidden")
        self.assertFalse((ROOT / ".easignore").exists(), "root .easignore is forbidden")
        self.assertTrue((MOBILE / "eas.json").is_file())
        self.assertTrue((MOBILE / ".easignore").is_file())

    def test_eas_profiles_have_explicit_environment_and_release_provenance(self):
        eas = json.loads(read(MOBILE / "eas.json"))
        cli = eas.get("cli", {})
        self.assertIs(cli.get("requireCommit"), True)
        self.assertEqual(cli.get("appVersionSource"), "remote")

        build = eas.get("build", {})
        expected_env = {
            "pilot-local": "development",
            "development": "development",
            "preview": "preview",
            "production": "production",
        }
        for profile, environment in expected_env.items():
            with self.subTest(profile=profile):
                self.assertIn(profile, build)
                self.assertEqual(build[profile].get("environment"), environment)

        production = build["production"]
        self.assertEqual(production.get("distribution"), "store")
        self.assertTrue(production.get("autoIncrement"))
        self.assertNotEqual(
            production.get("android", {}).get("buildType"),
            "apk",
            "production must not silently be an installable preview APK",
        )

    def test_remote_eas_profiles_do_not_inline_backend_endpoints(self):
        eas = json.loads(read(MOBILE / "eas.json"))
        for profile in ("development", "preview", "production"):
            with self.subTest(profile=profile):
                env = eas["build"][profile].get("env", {})
                self.assertNotIn("EXPO_PUBLIC_API_URL", env)
                self.assertNotIn("EXPO_PUBLIC_TELEMETRY_URL", env)

        pilot = eas["build"]["pilot-local"].get("env", {})
        self.assertEqual(pilot.get("EXPO_PUBLIC_API_URL"), "http://localhost:8000")
        self.assertEqual(pilot.get("EXPO_PUBLIC_TELEMETRY_URL"), "http://localhost:8001")

    def test_sdk55_update_command_has_explicit_channel_and_environment(self):
        package = json.loads(read(MOBILE / "package.json"))
        deploy = package.get("scripts", {}).get("deploy:mobile", "")
        self.assertIn("eas-cli@24.7.0 update", deploy)
        self.assertIn("--channel production", deploy)
        self.assertIn("--environment production", deploy)
        self.assertIn("--clear-cache", deploy)
        self.assertNotIn("--branch production", deploy)

    def test_eas_commands_use_pinned_eas_cli_package(self):
        package = json.loads(read(MOBILE / "package.json"))
        scripts = package.get("scripts", {})
        for name in (
            "android",
            "ios",
            "build:pilot-local:android",
            "build:dev:android",
            "build:dev:ios",
            "build:preview:android",
            "build:preview:ios",
            "build:prod:android",
            "build:prod:ios",
            "deploy:mobile",
        ):
            with self.subTest(script=name):
                command = scripts.get(name, "")
                self.assertIn("pnpm dlx eas-cli@24.7.0", command)
                self.assertNotIn("npx eas ", command)

        self.assertIn(
            "pnpm exec expo prebuild --clean -p android",
            scripts.get("build:local:preview:android", ""),
        )
        self.assertNotIn("npx expo ", scripts.get("build:local:preview:android", ""))

    def test_eas_uses_default_monorepo_install_without_duplicate_hook(self):
        package = json.loads(read(MOBILE / "package.json"))
        scripts = package.get("scripts", {})
        self.assertNotIn("eas-build-pre-install", scripts)
        self.assertFalse((MOBILE / "eas-build-pre-install.sh").exists())

    def test_dev_server_script_is_explicitly_dev_client(self):
        package = json.loads(read(MOBILE / "package.json"))
        scripts = package.get("scripts", {})
        self.assertIn("--dev-client", scripts.get("start", ""))
        self.assertIn("--dev-client", scripts.get("start:dev-client", ""))

    def test_metro_uses_expo_sdk55_automatic_monorepo_resolution(self):
        metro = read(MOBILE / "metro.config.js")
        self.assertIn("expo/metro-config", metro)
        self.assertNotIn("watchFolders", metro)
        self.assertNotIn("nodeModulesPaths", metro)
        self.assertNotIn("extraNodeModules", metro)
        self.assertNotIn("disableHierarchicalLookup", metro)

    def test_app_config_does_not_claim_channel_or_legacy_new_arch_toggle(self):
        config = read(MOBILE / "app.config.js")
        self.assertNotIn('"channel": "production"', config)
        self.assertNotIn('"newArchEnabled"', config)
        self.assertIn("assertReleaseSafePublicEnv", config)

    def test_local_runtime_does_not_fall_back_to_production(self):
        sources = {
            "apiClient": read(MOBILE / "src/services/apiClient.ts"),
            "socialAuth": read(MOBILE / "src/services/socialAuth.ts"),
            "gpsTelemetryUrl": read(MOBILE / "src/services/gpsTelemetryUrl.ts"),
        }
        forbidden = (
            "DEV_FALLBACK_API_URL",
            "backend-production-55c7.up.railway.app",
            "docker-telemetry-production-123c.up.railway.app",
        )
        for name, source in sources.items():
            for token in forbidden:
                with self.subTest(source=name, token=token):
                    self.assertNotIn(token, source)

    def test_mobile_does_not_bake_or_read_public_e2e_credentials(self):
        app_config = read(MOBILE / "app.config.js")
        e2e_config = read(MOBILE / "src/bootstrap/e2eConfig.ts")
        auth_session = read(MOBILE / "src/bootstrap/useAuthSession.ts")

        for key in ("EXPO_PUBLIC_E2E_EMAIL", "EXPO_PUBLIC_E2E_PASSWORD"):
            with self.subTest(key=key):
                self.assertNotIn(f"{key}: process.env", app_config)
                self.assertNotIn(key, e2e_config)

        self.assertNotIn("e2eConfig.email", auth_session)
        self.assertNotIn("e2eConfig.password", auth_session)

    def test_mobile_does_not_document_or_read_public_llm_secret(self):
        env_example = read(ROOT / ".env.example")
        llm = read(MOBILE / "src/services/LlmCoachService.ts")
        self.assertNotIn("EXPO_PUBLIC_LLM_API_KEY", env_example)
        self.assertNotIn("process.env.EXPO_PUBLIC_LLM_API_KEY", llm)
        self.assertNotIn("process.env.OPENAI_API_KEY", llm)

    def test_updates_reload_only_after_download_is_pending(self):
        app = read(MOBILE / "App.tsx")
        self.assertIn("isUpdatePending", app)
        self.assertNotIn("isUpdateAvailable", app)


if __name__ == "__main__":
    unittest.main()
