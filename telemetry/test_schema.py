"""Contracts for explicit telemetry schema ownership."""

from __future__ import annotations

import unittest
from pathlib import Path

from schema import REQUIRED_INDEXES, assert_schema_ready, bootstrap_schema

ROOT = Path(__file__).resolve().parent
LIFECYCLE = ROOT / "lifecycle.py"


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
        self.assertIn("ALTER TABLE gps_points ADD COLUMN IF NOT EXISTS seq BIGINT", joined)
        self.assertIn("CREATE UNIQUE INDEX IF NOT EXISTS gps_points_activity_time_seq_uidx", joined)
        self.assertIn("CREATE TABLE IF NOT EXISTS telemetry_ingest_receipts", joined)
        self.assertIn("CREATE INDEX IF NOT EXISTS telemetry_ingest_receipts_activity_user_idx", joined)
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


if __name__ == "__main__":
    unittest.main()
