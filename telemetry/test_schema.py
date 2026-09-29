"""Contracts for explicit telemetry schema ownership."""

from __future__ import annotations

import unittest
from pathlib import Path

from schema import REQUIRED_INDEXES, assert_schema_ready, bootstrap_schema

TELEMETRY_ROOT = Path(__file__).resolve().parent
REPO_ROOT = TELEMETRY_ROOT.parent
LIFECYCLE = TELEMETRY_ROOT / "lifecycle.py"


class FakeConnection:
    def __init__(
        self,
        *,
        indexes: set[str] | None = None,
        fail_runtime_read: bool = False,
        fail_hypertable: bool = False,
    ) -> None:
        self.indexes = set(REQUIRED_INDEXES if indexes is None else indexes)
        self.fail_runtime_read = fail_runtime_read
        self.fail_hypertable = fail_hypertable
        self.executed: list[str] = []
        self.fetched: list[str] = []

    async def execute(self, sql: str) -> None:
        normalized = " ".join(sql.split())
        self.executed.append(normalized)
        if self.fail_hypertable and "create_hypertable" in normalized:
            raise RuntimeError("timescale unavailable")

    async def fetch(self, sql: str, *args):
        normalized = " ".join(sql.split())
        self.fetched.append(normalized)
        if self.fail_runtime_read and "FROM gps_points" in normalized:
            raise RuntimeError("relation does not exist")
        if "FROM pg_indexes" in normalized:
            return [{"indexname": name} for name in sorted(self.indexes)]
        return []


class TelemetrySchemaTests(unittest.IsolatedAsyncioTestCase):
    async def test_bootstrap_owns_schema_ddl_and_is_idempotent_shape(self):
        conn = FakeConnection(fail_hypertable=True)

        await bootstrap_schema(conn)

        joined = "\n".join(conn.executed)
        self.assertIn("CREATE TABLE IF NOT EXISTS gps_points", joined)
        self.assertIn(
            "ALTER TABLE gps_points ADD COLUMN IF NOT EXISTS seq BIGINT",
            joined,
        )
        self.assertIn(
            "CREATE UNIQUE INDEX IF NOT EXISTS gps_points_activity_time_seq_uidx",
            joined,
        )
        self.assertIn("CREATE TABLE IF NOT EXISTS telemetry_ingest_receipts", joined)
        self.assertIn(
            "CREATE INDEX IF NOT EXISTS telemetry_ingest_receipts_activity_user_idx",
            joined,
        )
        self.assertIn("create_hypertable", joined)

    async def test_runtime_readiness_is_read_only(self):
        conn = FakeConnection()

        await assert_schema_ready(conn)

        self.assertEqual(conn.executed, [])
        self.assertTrue(conn.fetched)
        self.assertTrue(all(query.upper().startswith("SELECT ") for query in conn.fetched))

    async def test_runtime_readiness_fails_closed_when_relation_is_missing(self):
        conn = FakeConnection(fail_runtime_read=True)

        with self.assertRaisesRegex(RuntimeError, "schema_bootstrap.py"):
            await assert_schema_ready(conn)

    async def test_runtime_readiness_fails_closed_when_required_index_is_missing(self):
        conn = FakeConnection(indexes={"gps_points_activity_time_seq_uidx"})

        with self.assertRaisesRegex(RuntimeError, "telemetry_ingest_receipts_activity_user_idx"):
            await assert_schema_ready(conn)

    def test_fastapi_lifespan_contains_no_schema_ddl(self):
        text = LIFECYCLE.read_text(encoding="utf-8")
        upper = text.upper()

        for token in ("CREATE TABLE", "ALTER TABLE", "CREATE INDEX", "CREATE_HYPERTABLE"):
            with self.subTest(token=token):
                self.assertNotIn(token, upper)
        self.assertIn("assert_schema_ready", text)

    def test_runtime_manifests_do_not_receive_migration_owner(self):
        compose = (REPO_ROOT / "docker-compose.yml").read_text(encoding="utf-8")
        migrate_start = compose.index("  telemetry_migrate:")
        runtime_start = compose.index("  telemetry:", migrate_start)
        next_service = compose.index("  # 1. Global Admin", runtime_start)
        migrate_block = compose[migrate_start:runtime_start]
        runtime_block = compose[runtime_start:next_service]

        self.assertIn('profiles: ["bootstrap"]', migrate_block)
        self.assertIn("python schema_bootstrap.py", migrate_block)
        self.assertNotIn("schema_bootstrap.py", runtime_block)

        deployment = (REPO_ROOT / "infrastructure/k8s/optional/telemetry.optional.yaml").read_text(
            encoding="utf-8"
        )
        migration_job = (
            REPO_ROOT / "infrastructure/k8s/jobs/telemetry-migrate-job.optional.yaml"
        ).read_text(encoding="utf-8")

        self.assertNotIn("sport-migration-secrets", deployment)
        self.assertNotIn("MIGRATION_DATABASE_URL", deployment)
        self.assertIn("sport-migration-secrets", migration_job)
        self.assertIn("MIGRATION_DATABASE_URL", migration_job)
        self.assertIn("python", migration_job)
        self.assertIn("schema_bootstrap.py", migration_job)


if __name__ == "__main__":
    unittest.main()
