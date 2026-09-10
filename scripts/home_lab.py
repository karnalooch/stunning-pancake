#!/usr/bin/env python3
"""Operate the isolated 4VELO home lab through Docker Compose."""

from __future__ import annotations

import argparse
import json
import secrets
import subprocess
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env.home"
ENV_TEMPLATE = ROOT / ".env.home.example"
BACKUP_DIR = ROOT / "backups" / "home-lab"
PROJECT = "4velo-home"
CORE_SERVICES = (
    "db",
    "redis",
    "backend",
    "telemetry",
    "global_admin",
    "celery_worker",
    "celery_beat",
)


def compose_command(*args: str, profiles: tuple[str, ...] = ()) -> list[str]:
    command = ["docker", "compose", "-p", PROJECT, "--env-file", str(ENV_FILE)]
    for profile in profiles:
        command.extend(("--profile", profile))
    return [*command, *args]


def run(command: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, cwd=ROOT, check=check, text=True)


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
    for url in ("http://127.0.0.1:8000/health/", "http://127.0.0.1:8001/health"):
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


def verify_restore(path: Path) -> None:
    require_environment()
    source = validate_backup(path)
    remote = "/tmp/4velo-restore-check.dump"
    database = "4velo_restore_check"
    run(compose_command("cp", str(source), f"db:{remote}"))
    restore = '''dropdb --if-exists --force --username="$POSTGRES_USER" "$1"
createdb --username="$POSTGRES_USER" "$1"
pg_restore --exit-on-error --no-owner --no-acl --username="$POSTGRES_USER" --dbname="$1" "$2"
psql --username="$POSTGRES_USER" --dbname="$1" --tuples-only --command="SELECT count(*) FROM django_migrations;"'''
    try:
        run(compose_command("exec", "-T", "db", "sh", "-c", restore, "sh", database, remote))
        print("Backup restored successfully into an isolated verification database")
    finally:
        cleanup = 'dropdb --if-exists --force --username="$POSTGRES_USER" "$1"; rm -f "$2"'
        run(
            compose_command("exec", "-T", "db", "sh", "-c", cleanup, "sh", database, remote),
            check=False,
        )


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


if __name__ == "__main__":
    main()
