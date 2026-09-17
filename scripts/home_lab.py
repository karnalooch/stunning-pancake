#!/usr/bin/env python3
"""Operate the isolated 4VELO home lab through Docker Compose."""

from __future__ import annotations

import argparse
import hashlib
import json
import secrets
import subprocess
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env.home"
ENV_TEMPLATE = ROOT / ".env.home.example"
BACKUP_DIR = ROOT / "backups" / "home-lab"
EVIDENCE_DIR = BACKUP_DIR / "evidence"
PROJECT = "4velo-home"
HOME_COMPOSE_FILE = ROOT / "docker-compose.home.yml"
RECOVERY_DATABASE = "4velo_restore_check"
CORE_SERVICES = (
    "db",
    "redis",
    "backend",
    "telemetry",
    "global_admin",
    "celery_worker",
    "celery_beat",
)
P3_RECOVERY_EXPECTED_COUNTS = {
    "tenants": 2,
    "users": 4,
    "departments": 2,
    "memberships": 4,
    "activities": 2,
    "audit_logs": 2,
    "gps_points": 6,
    "telemetry_receipts": 2,
}

P3_RECOVERY_SNAPSHOT_SQL = r"""
SELECT jsonb_build_object(
    'tenants', COALESCE((
        SELECT jsonb_agg(to_jsonb(row_data)) FROM (
            SELECT id::text AS id, name, is_active
            FROM users_tenant
            WHERE id IN (
                '5a7cba35-33d2-4f89-9ca8-621fdd06a001'::uuid,
                '5a7cba35-33d2-4f89-9ca8-621fdd06b002'::uuid
            )
            ORDER BY id
        ) AS row_data
    ), '[]'::jsonb),
    'users', COALESCE((
        SELECT jsonb_agg(to_jsonb(row_data)) FROM (
            SELECT username, role, tenant_id::text AS tenant_id, is_active
            FROM users_user
            WHERE username LIKE 'p3-recovery-%'
            ORDER BY username
        ) AS row_data
    ), '[]'::jsonb),
    'departments', COALESCE((
        SELECT jsonb_agg(to_jsonb(row_data)) FROM (
            SELECT d.name, d.tenant_id::text AS tenant_id, d.department_type,
                   d.is_active, u.username AS moderator
            FROM users_department d
            LEFT JOIN users_user u ON u.id = d.moderator_id
            WHERE d.name IN ('P3 Recovery Department A', 'P3 Recovery Department B')
            ORDER BY d.name
        ) AS row_data
    ), '[]'::jsonb),
    'memberships', COALESCE((
        SELECT jsonb_agg(to_jsonb(row_data)) FROM (
            SELECT u.username, d.name AS department, d.tenant_id::text AS tenant_id
            FROM users_userdepartment ud
            JOIN users_user u ON u.id = ud.user_id
            JOIN users_department d ON d.id = ud.department_id
            WHERE u.username LIKE 'p3-recovery-%'
              AND d.name IN ('P3 Recovery Department A', 'P3 Recovery Department B')
            ORDER BY u.username, d.name
        ) AS row_data
    ), '[]'::jsonb),
    'activities', COALESCE((
        SELECT jsonb_agg(to_jsonb(row_data)) FROM (
            SELECT a.external_id, u.username, a.tenant_id::text AS tenant_id, a.type,
                   extract(epoch FROM a.start_time)::bigint AS start_epoch,
                   extract(epoch FROM a.end_time)::bigint AS end_epoch,
                   a.distance, extract(epoch FROM a.duration)::bigint AS duration_seconds,
                   a.is_verified, a.verification_score,
                   ST_AsEWKT(a.route_path) AS route_path,
                   a.route_fingerprint
            FROM activities_activity a
            JOIN users_user u ON u.id = a.user_id
            WHERE a.external_id IN ('P3-RECOVERY-A', 'P3-RECOVERY-B')
            ORDER BY a.external_id
        ) AS row_data
    ), '[]'::jsonb),
    'audit_logs', COALESCE((
        SELECT jsonb_agg(to_jsonb(row_data)) FROM (
            SELECT al.action, actor.username AS actor, target.username AS target,
                   al.tenant_id, al.details, al.ip_address::text AS ip_address,
                   al.status_code, extract(epoch FROM al.timestamp)::bigint AS timestamp_epoch
            FROM users_auditlog al
            LEFT JOIN users_user actor ON actor.id = al.impersonator_id
            LEFT JOIN users_user target ON target.id = al.target_user_id
            WHERE al.action LIKE 'P3_RECOVERY_%'
            ORDER BY al.action
        ) AS row_data
    ), '[]'::jsonb),
    'gps_points', COALESCE((
        SELECT jsonb_agg(to_jsonb(row_data)) FROM (
            SELECT a.external_id, u.username, g.device_id, g.seq,
                   extract(epoch FROM g.time)::bigint AS time_epoch,
                   g.lat, g.lon, g.speed_ms, g.accuracy_m
            FROM gps_points g
            JOIN activities_activity a ON a.id = g.activity_id
            JOIN users_user u ON u.id = g.user_id
            WHERE g.device_id IN ('p3-recovery-device-a', 'p3-recovery-device-b')
            ORDER BY a.external_id, g.seq, g.time
        ) AS row_data
    ), '[]'::jsonb),
    'telemetry_receipts', COALESCE((
        SELECT jsonb_agg(to_jsonb(row_data)) FROM (
            SELECT r.client_batch_id, a.external_id, u.username,
                   r.point_count, r.persisted_count, r.dropped_privacy,
                   r.max_seq, r.payload_fingerprint,
                   extract(epoch FROM r.acked_at)::bigint AS acked_epoch
            FROM telemetry_ingest_receipts r
            JOIN activities_activity a ON a.id = r.activity_id
            JOIN users_user u ON u.id = r.user_id
            WHERE r.client_batch_id IN ('p3-recovery-batch-a', 'p3-recovery-batch-b')
            ORDER BY r.client_batch_id
        ) AS row_data
    ), '[]'::jsonb),
    'newest_gps_epoch', (
        SELECT extract(epoch FROM max(time))::double precision
        FROM gps_points
        WHERE device_id IN ('p3-recovery-device-a', 'p3-recovery-device-b')
    )
)::text;
"""

P3_RECOVERY_APP_SMOKE = """
from activities.models import Activity
from core.rls import global_owner_context
from django.db import connection
from users.models import User

with global_owner_context():
    assert User.objects.filter(username__startswith="p3-recovery-").count() == 4
    assert Activity.objects.filter(
        external_id__in=["P3-RECOVERY-A", "P3-RECOVERY-B"],
        route_path__isnull=False,
    ).count() == 2
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT count(*) FROM gps_points WHERE device_id IN (%s, %s)",
            ["p3-recovery-device-a", "p3-recovery-device-b"],
        )
        assert cursor.fetchone()[0] == 6
        cursor.execute(
            "SELECT count(*) FROM telemetry_ingest_receipts "
            "WHERE client_batch_id IN (%s, %s)",
            ["p3-recovery-batch-a", "p3-recovery-batch-b"],
        )
        assert cursor.fetchone()[0] == 2
print("P3 restored critical ORM/telemetry path OK")
"""


def compose_command(*args: str, profiles: tuple[str, ...] = ()) -> list[str]:
    command = ["docker", "compose", "-p", PROJECT, "--env-file", str(ENV_FILE)]
    # Layer the loopback-only home override on top of the shared compose file
    # so the LAN-facing defaults stay untouched for Railway / production / CI.
    # Compose merges files in order; -f override semantics let us narrow port
    # bindings without rewriting the shared `docker-compose.yml`.
    if HOME_COMPOSE_FILE.is_file():
        command.extend(("-f", str(HOME_COMPOSE_FILE)))
    for profile in profiles:
        command.extend(("--profile", profile))
    return [*command, *args]


def run(command: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, cwd=ROOT, check=check, text=True)


def run_capture(command: list[str]) -> str:
    result = subprocess.run(
        command,
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=True,
    )
    return result.stdout


def render_environment(template: str) -> str:
    values = {
        "DB_PASSWORD": secrets.token_urlsafe(32),
        "SECRET_KEY": secrets.token_urlsafe(64),
        "TELEMETRY_INGEST_JWT_SECRET": secrets.token_urlsafe(64),
    }
    lines = []
    for line in template.splitlines():
        name = line.split("=", 1)[0]
        if name in values:
            line = f"{name}={values[name]}"
        lines.append(line)
    return "\n".join(lines) + "\n"


def initialize() -> None:
    if ENV_FILE.exists():
        raise SystemExit(f"Refusing to overwrite existing {ENV_FILE.name}")
    ENV_FILE.write_text(render_environment(ENV_TEMPLATE.read_text()), encoding="utf-8")
    print(f"Created {ENV_FILE.name} with fresh local-only credentials")


def require_environment() -> None:
    if not ENV_FILE.exists():
        raise SystemExit("Run `python scripts/home_lab.py init` first")


def home_env_value(name: str) -> str:
    require_environment()
    prefix = f"{name}="
    for raw_line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if line.startswith(prefix):
            value = line.split("=", 1)[1].strip()
            if value:
                return value.strip('"').strip("'")
    raise SystemExit(f"Missing required {name} in {ENV_FILE.name}")


def profiles(args: argparse.Namespace) -> tuple[str, ...]:
    selected = []
    if args.routing:
        selected.append("routing")
    if args.simulation:
        selected.append("simulation")
    if args.tracking:
        selected.append("tracking")
    if args.all_admin:
        selected.append("all-admin")
    return tuple(selected)


def up(args: argparse.Namespace) -> None:
    require_environment()
    run(compose_command("config", "--quiet", profiles=profiles(args)))
    run(compose_command("up", "-d", "--build", "--wait", profiles=profiles(args)))
    check_health()


def parse_compose_ps(output: str) -> list[dict]:
    """Accept both JSON-array and newline-delimited Compose `ps` output."""
    output = output.strip()
    if not output:
        return []
    if output.startswith("["):
        decoded = json.loads(output)
        if not isinstance(decoded, list):
            raise ValueError("Docker Compose JSON array expected")
        return decoded
    if "\n" not in output:
        return [json.loads(output)]
    return [json.loads(line) for line in output.splitlines() if line.strip()]


def check_health() -> None:
    require_environment()
    result = subprocess.run(
        compose_command("ps", "--format", "json"),
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=True,
    )
    records = parse_compose_ps(result.stdout)
    states = {
        record.get("Service"): (record.get("State"), record.get("Health")) for record in records
    }
    missing = [service for service in CORE_SERVICES if service not in states]
    unhealthy = [
        name
        for name, (state, health) in states.items()
        if state != "running" or health == "unhealthy"
    ]
    if missing or unhealthy:
        raise SystemExit(f"Home lab is not healthy; missing={missing}, unhealthy={unhealthy}")
    for url in (
        "http://127.0.0.1:8000/health/",
        "http://127.0.0.1:8001/api/telemetry/health",
    ):
        with urllib.request.urlopen(url, timeout=5) as response:
            if response.status != 200:
                raise SystemExit(f"Health endpoint failed: {url} returned {response.status}")
    print("Home lab core services and HTTP health endpoints are ready")


def backup() -> Path:
    require_environment()
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
    destination = BACKUP_DIR / f"4velo-home-{stamp}.dump"
    remote = f"/tmp/{destination.name}"
    dump = 'pg_dump --format=custom --no-owner --no-acl --username="$POSTGRES_USER" --file="$1" "$POSTGRES_DB"'
    run(compose_command("exec", "-T", "db", "sh", "-c", dump, "sh", remote))
    try:
        run(compose_command("cp", f"db:{remote}", str(destination)))
    finally:
        run(compose_command("exec", "-T", "db", "rm", "-f", remote), check=False)
    print(f"Backup created: {destination}")
    return destination


def validate_backup(path: Path) -> Path:
    resolved = path.expanduser().resolve()
    if not resolved.is_file() or resolved.suffix != ".dump":
        raise SystemExit("Backup must be an existing .dump file")
    return resolved


def restore_backup(path: Path, database: str = RECOVERY_DATABASE) -> None:
    require_environment()
    source = validate_backup(path)
    remote = "/tmp/4velo-restore-check.dump"
    run(compose_command("cp", str(source), f"db:{remote}"))
    restore = '''dropdb --if-exists --force --username="$POSTGRES_USER" "$1"
createdb --username="$POSTGRES_USER" "$1"
pg_restore --exit-on-error --no-owner --no-acl --username="$POSTGRES_USER" --dbname="$1" "$2"'''
    try:
        run(compose_command("exec", "-T", "db", "sh", "-c", restore, "sh", database, remote))
    finally:
        run(compose_command("exec", "-T", "db", "rm", "-f", remote), check=False)


def drop_database(database: str = RECOVERY_DATABASE) -> None:
    cleanup = 'dropdb --if-exists --force --username="$POSTGRES_USER" "$1"'
    run(
        compose_command("exec", "-T", "db", "sh", "-c", cleanup, "sh", database),
        check=False,
    )


def psql_json(database: str, sql: str) -> dict:
    command = compose_command(
        "exec",
        "-T",
        "db",
        "sh",
        "-c",
        'psql --username="$POSTGRES_USER" --dbname="$1" --set=ON_ERROR_STOP=1 '
        '--no-align --tuples-only --command="$2"',
        "sh",
        database,
        sql,
    )
    output = run_capture(command).strip()
    if not output:
        raise SystemExit(f"P3 recovery snapshot returned no data for {database}")
    try:
        decoded = json.loads(output)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"P3 recovery snapshot is not valid JSON for {database}") from exc
    if not isinstance(decoded, dict):
        raise SystemExit(f"P3 recovery snapshot must be an object for {database}")
    return decoded


def recovery_snapshot(database: str) -> dict:
    return psql_json(database, P3_RECOVERY_SNAPSHOT_SQL)


def recovery_snapshot_counts(snapshot: dict) -> dict[str, int]:
    return {
        key: len(snapshot.get(key, []))
        for key in P3_RECOVERY_EXPECTED_COUNTS
    }


def validate_recovery_snapshot(snapshot: dict) -> dict[str, int]:
    counts = recovery_snapshot_counts(snapshot)
    if counts != P3_RECOVERY_EXPECTED_COUNTS:
        raise SystemExit(
            f"P3 recovery fixture invariant mismatch: expected={P3_RECOVERY_EXPECTED_COUNTS}, actual={counts}"
        )
    newest = snapshot.get("newest_gps_epoch")
    if not isinstance(newest, (int, float)):
        raise SystemExit("P3 recovery fixture has no recoverable GPS timestamp")

    roles = sorted(row.get("role") for row in snapshot["users"])
    if roles != ["ATHLETE", "ATHLETE", "TENANT_ADMIN", "TENANT_ADMIN"]:
        raise SystemExit(f"P3 recovery role invariant mismatch: {roles}")

    for activity in snapshot["activities"]:
        if not activity.get("route_path") or len(activity.get("route_fingerprint", "")) != 64:
            raise SystemExit("P3 recovery activity route/fingerprint invariant failed")

    gps_by_activity: dict[str, list[int]] = {}
    for point in snapshot["gps_points"]:
        gps_by_activity.setdefault(point["external_id"], []).append(point["seq"])
    if gps_by_activity != {"P3-RECOVERY-A": [1, 2, 3], "P3-RECOVERY-B": [1, 2, 3]}:
        raise SystemExit(f"P3 recovery GPS sequence invariant mismatch: {gps_by_activity}")

    for receipt in snapshot["telemetry_receipts"]:
        if (
            receipt.get("point_count") != 3
            or receipt.get("persisted_count") != 3
            or receipt.get("dropped_privacy") != 0
            or receipt.get("max_seq") != 3
            or len(receipt.get("payload_fingerprint", "")) != 64
        ):
            raise SystemExit("P3 recovery telemetry receipt invariant failed")
    return counts


def canonical_snapshot_digest(snapshot: dict) -> str:
    payload = json.dumps(snapshot, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_restored_critical_path(database: str) -> None:
    shell = 'export DATABASE_URL="${DATABASE_URL%/*}/$1"; python manage.py shell -c "$2"'
    run(
        compose_command(
            "exec",
            "-T",
            "backend",
            "sh",
            "-c",
            shell,
            "sh",
            database,
            P3_RECOVERY_APP_SMOKE,
        )
    )


def verify_restore(path: Path) -> None:
    source = validate_backup(path)
    restore_backup(source, RECOVERY_DATABASE)
    check = 'psql --username="$POSTGRES_USER" --dbname="$1" --tuples-only --command="SELECT count(*) FROM django_migrations;"'
    try:
        run(
            compose_command(
                "exec", "-T", "db", "sh", "-c", check, "sh", RECOVERY_DATABASE
            )
        )
        print("Backup restored successfully into an isolated verification database")
    finally:
        drop_database(RECOVERY_DATABASE)


def p3_recovery_drill() -> Path:
    require_environment()
    check_health()
    primary_database = home_env_value("POSTGRES_DB")
    anchor = datetime.now(timezone.utc).replace(microsecond=0)
    anchor_iso = anchor.isoformat().replace("+00:00", "Z")

    run(
        compose_command(
            "exec",
            "-T",
            "backend",
            "python",
            "manage.py",
            "seed_p3_recovery_fixture",
            "--anchor",
            anchor_iso,
        )
    )
    before = recovery_snapshot(primary_database)
    counts = validate_recovery_snapshot(before)
    before_digest = canonical_snapshot_digest(before)

    backup_started_at = datetime.now(timezone.utc)
    backup_path = backup()
    backup_completed_at = datetime.now(timezone.utc)
    backup_digest = file_sha256(backup_path)

    newest_gps_epoch = float(before["newest_gps_epoch"])
    rpo_seconds = max(0.0, backup_completed_at.timestamp() - newest_gps_epoch)

    restore_started_at = datetime.now(timezone.utc)
    restore_timer = time.monotonic()
    try:
        restore_backup(backup_path, RECOVERY_DATABASE)
        after = recovery_snapshot(RECOVERY_DATABASE)
        restored_counts = validate_recovery_snapshot(after)
        after_digest = canonical_snapshot_digest(after)
        if before_digest != after_digest:
            raise SystemExit(
                "P3 recovery integrity mismatch: restored business-data digest differs from source"
            )
        if counts != restored_counts:
            raise SystemExit("P3 recovery integrity mismatch: restored counts differ from source")
        verify_restored_critical_path(RECOVERY_DATABASE)
        restore_completed_at = datetime.now(timezone.utc)
        rto_seconds = time.monotonic() - restore_timer
    finally:
        drop_database(RECOVERY_DATABASE)

    report = {
        "schema_version": 1,
        "drill": "p3-business-integrity-recovery",
        "synthetic_data_only": True,
        "source_database": primary_database,
        "restore_database": RECOVERY_DATABASE,
        "fixture_anchor_utc": anchor_iso,
        "counts": counts,
        "snapshot_sha256": before_digest,
        "restored_snapshot_sha256": after_digest,
        "backup_file": backup_path.name,
        "backup_sha256": backup_digest,
        "backup_started_at_utc": backup_started_at.isoformat(),
        "backup_completed_at_utc": backup_completed_at.isoformat(),
        "newest_recoverable_gps_epoch": newest_gps_epoch,
        "measured_rpo_seconds": round(rpo_seconds, 3),
        "restore_started_at_utc": restore_started_at.isoformat(),
        "restore_completed_at_utc": restore_completed_at.isoformat(),
        "measured_rto_seconds": round(rto_seconds, 3),
        "integrity_match": True,
        "critical_app_path_verified": True,
    }
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
    report_path = EVIDENCE_DIR / f"p3-recovery-{stamp}.json"
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(
        "P3 business-integrity recovery PASS: "
        f"snapshot={before_digest[:12]}…, RPO={rpo_seconds:.3f}s, RTO={rto_seconds:.3f}s"
    )
    print(f"Evidence written: {report_path}")
    return report_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="action", required=True)
    sub.add_parser("init")
    for name in ("up", "config"):
        item = sub.add_parser(name)
        item.add_argument("--routing", action="store_true")
        item.add_argument("--simulation", action="store_true")
        item.add_argument("--tracking", action="store_true")
        item.add_argument("--all-admin", action="store_true")
    sub.add_parser("check")
    sub.add_parser("status")
    sub.add_parser("down")
    sub.add_parser("backup")
    restore = sub.add_parser("verify-restore")
    restore.add_argument("path", type=Path)
    sub.add_parser("p3-recovery-drill")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.action == "init":
        initialize()
    elif args.action == "up":
        up(args)
    elif args.action == "config":
        require_environment()
        run(compose_command("config", "--quiet", profiles=profiles(args)))
    elif args.action == "check":
        check_health()
    elif args.action == "status":
        require_environment()
        run(compose_command("ps"))
    elif args.action == "down":
        require_environment()
        run(compose_command("down"))
    elif args.action == "backup":
        backup()
    elif args.action == "verify-restore":
        verify_restore(args.path)
    elif args.action == "p3-recovery-drill":
        p3_recovery_drill()


if __name__ == "__main__":
    main()
