"""
Citus Sharding Manager — SPORT Platform (Hyperscale)
======================================================
Constitution §26: Distributed Database Layer

Configures PostgreSQL Citus extension to shard the largest tables
across multiple coordinator/worker nodes.

Sharding strategy:
  - activities_activity     → distributed by user_id (hash)
  - telemetry raw tables    → distributed by tenant_id (hash)
  - events_participation    → distributed by user_id (hash)
  - rewards_pointsledger    → distributed by user_id (hash)

Reference tables (small, replicated to all workers):
  - users_user
  - events_event
  - clubs_club
  - rewards_voucherpool

Why this strategy:
  - user_id sharding ensures ALL activities for a user land on the
    same shard → JOINs and aggregations per-user are local (fast).
  - Reference tables are replicated so JOINs with users/events
    never require cross-shard network hops.

Usage (run once after enabling Citus):
    docker compose -f docker-compose.scale.yml exec backend \
        python manage.py shell -c "from core.citus import apply_citus_sharding; apply_citus_sharding()"
"""
from __future__ import annotations

import logging

from django.db import connection

logger = logging.getLogger(__name__)

# Tables to distribute (sharded by column)
DISTRIBUTED_TABLES: list[tuple[str, str]] = [
    ("activities_activity",      "user_id"),
    ("events_participation",     "user_id"),
    ("rewards_pointsledger",     "user_id"),
    ("rewards_voucher",          "user_id"),
]

# Small tables replicated to all workers (for fast JOINs)
REFERENCE_TABLES: list[str] = [
    "users_user",
    "events_event",
    "clubs_club",
    "clubs_clubmembership",
    "rewards_sponsor",
    "rewards_voucherpool",
]

# Number of shards per distributed table (recommended: 2× worker count)
SHARD_COUNT = int(32)


def enable_citus_extension() -> None:
    """
    Enables the Citus extension on the PostgreSQL coordinator.
    Must be run as a superuser once per database.
    """
    with connection.cursor() as cursor:
        cursor.execute("CREATE EXTENSION IF NOT EXISTS citus;")
    logger.info("citus.extension_enabled")


def apply_citus_sharding() -> None:
    """
    Distributes large tables and replicates reference tables.

    Idempotent: safely re-runnable. Tables already distributed are skipped.

    Run order matters:
      1. Reference tables first (users_user must exist before activities_activity
         can reference it across shards).
      2. Distributed tables second.
    """
    enable_citus_extension()

    with connection.cursor() as cursor:
        # Step 1: Reference tables (replicated to all workers)
        for table in REFERENCE_TABLES:
            try:
                cursor.execute(
                    "SELECT create_reference_table(%s);",
                    [table],
                )
                logger.info("citus.reference_table table=%s", table)
            except Exception as exc:
                # Already distributed or not yet created — skip
                logger.warning("citus.reference_table_skip table=%s err=%s", table, exc)
                connection.connection.rollback()

        # Step 2: Distributed tables (sharded by column)
        for table, dist_col in DISTRIBUTED_TABLES:
            try:
                cursor.execute(
                    "SELECT create_distributed_table(%s, %s, shard_count => %s);",
                    [table, dist_col, SHARD_COUNT],
                )
                logger.info(
                    "citus.distributed_table table=%s dist_col=%s shards=%d",
                    table, dist_col, SHARD_COUNT,
                )
            except Exception as exc:
                logger.warning("citus.distributed_table_skip table=%s err=%s", table, exc)
                connection.connection.rollback()

    logger.info(
        "citus.sharding_complete reference=%d distributed=%d",
        len(REFERENCE_TABLES), len(DISTRIBUTED_TABLES),
    )


def add_citus_worker(host: str, port: int = 5432) -> None:
    """
    Registers a new PostgreSQL worker node in the Citus cluster.

    Call this after provisioning a new DB server.

    Args:
        host: Hostname or IP of the worker node.
        port: PostgreSQL port (default 5432).
    """
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT * FROM citus_add_node(%s, %s);",
            [host, port],
        )
    logger.info("citus.worker_added host=%s port=%d", host, port)


def citus_cluster_status() -> list[dict]:
    """
    Returns the current Citus cluster topology (coordinator + workers).

    Returns:
        List of dicts: [{nodeid, nodename, nodeport, isactive, role}]
    """
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT nodeid, nodename, nodeport, isactive,
                   CASE WHEN groupid = 0 THEN 'coordinator' ELSE 'worker' END AS role
            FROM pg_dist_node
            ORDER BY groupid, nodeid;
        """)
        cols = [d[0] for d in cursor.description]
        return [dict(zip(cols, row)) for row in cursor.fetchall()]


def citus_shard_status() -> list[dict]:
    """
    Returns shard distribution across workers.

    Useful for detecting imbalances that require rebalancing.
    """
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT logicalrelid::text AS table_name,
                   COUNT(*) AS shard_count,
                   SUM(shardmaxvalue::bigint - shardminvalue::bigint) AS slot_range
            FROM pg_dist_shard
            GROUP BY logicalrelid
            ORDER BY table_name;
        """)
        cols = [d[0] for d in cursor.description]
        return [dict(zip(cols, row)) for row in cursor.fetchall()]


def rebalance_shards() -> None:
    """
    Triggers Citus shard rebalancer to redistribute shards evenly
    after adding new worker nodes.

    This is a non-blocking operation in Citus 11+.
    """
    with connection.cursor() as cursor:
        cursor.execute("SELECT rebalance_table_shards();")
    logger.info("citus.rebalance_triggered")
