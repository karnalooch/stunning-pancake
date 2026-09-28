#!/usr/bin/env python3
"""4VELO developer-environment preflight.

This command is intentionally read-only. It verifies the tracked local toolchain
and host prerequisites needed by the canonical Home Lab path, then prints the
explicit next commands. Runtime/service health belongs to T90.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from collections.abc import Callable, Sequence
from dataclasses import asdict, dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class ToolchainContract:
    node: str
    node_engine: str
    pnpm: str
    python: str


@dataclass(frozen=True)
class Check:
    name: str
    status: str
    detail: str
    remediation: str = ""


@dataclass(frozen=True)
class CommandResult:
    returncode: int
    output: str


CommandRunner = Callable[[Sequence[str]], CommandResult]


def load_toolchain_contract(root: Path = ROOT) -> ToolchainContract:
    package = json.loads((root / "package.json").read_text(encoding="utf-8"))
    node = (root / ".nvmrc").read_text(encoding="utf-8").strip()
    package_manager = str(package.get("packageManager", ""))
    if not package_manager.startswith("pnpm@"):
        raise ValueError("package.json packageManager must pin pnpm@<version>")
    pnpm = package_manager.split("@", 1)[1]

    node_engine = str(package.get("engines", {}).get("node", ""))
    try:
        next_node_major = int(node.split(".", 1)[0]) + 1
    except ValueError as exc:
        raise ValueError(".nvmrc must contain a semantic Node version") from exc
    expected_engine = f">={node} <{next_node_major}"
    if node_engine != expected_engine:
        raise ValueError(
            f"package.json engines.node must match .nvmrc: expected {expected_engine!r}, "
            f"found {node_engine!r}"
        )

    ci = (root / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    match = re.search(
        r"(?m)^\s*PYTHON_VERSION:\s*['\"]?([0-9]+\.[0-9]+)['\"]?\s*$",
        ci,
    )
    if match is None:
        raise ValueError(".github/workflows/ci.yml must declare env.PYTHON_VERSION")
    python = match.group(1)

    return ToolchainContract(
        node=node,
        node_engine=node_engine,
        pnpm=pnpm,
        python=python,
    )


def run_command(args: Sequence[str]) -> CommandResult:
    try:
        completed = subprocess.run(
            list(args),
            cwd=ROOT,
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=15,
        )
    except FileNotFoundError:
        return CommandResult(127, "command not found")
    except subprocess.TimeoutExpired:
        return CommandResult(124, "command timed out")
    return CommandResult(completed.returncode, completed.stdout.strip())


def _version(text: str) -> str:
    value = text.strip().splitlines()[0] if text.strip() else ""
    return value.removeprefix("v")


def _command_check(
    name: str,
    args: Sequence[str],
    expected: str | None,
    remediation: str,
    runner: CommandRunner,
) -> Check:
    result = runner(args)
    if result.returncode != 0:
        detail = result.output or f"exit {result.returncode}"
        return Check(name, "FAIL", detail, remediation)
    actual = _version(result.output)
    if expected is not None and actual != expected:
        return Check(
            name,
            "FAIL",
            f"expected {expected}, found {actual or result.output}",
            remediation,
        )
    return Check(name, "PASS", actual or result.output)


def collect_checks(
    *,
    root: Path = ROOT,
    runner: CommandRunner = run_command,
    python_version: tuple[int, int] | None = None,
    cwd: Path | None = None,
) -> list[Check]:
    checks: list[Check] = []
    required = (
        "package.json",
        ".nvmrc",
        "pnpm-lock.yaml",
        "docker-compose.yml",
        "docker-compose.home.yml",
        "scripts/home_lab.py",
        ".github/workflows/ci.yml",
    )
    missing = [path for path in required if not (root / path).is_file()]
    checks.append(
        Check(
            "repository",
            "PASS" if not missing else "FAIL",
            "canonical repository files present"
            if not missing
            else f"missing: {', '.join(missing)}",
            "Use a complete 4VELO repository checkout.",
        )
    )
    if missing:
        return checks

    actual_cwd = (cwd or Path.cwd()).resolve()
    expected_cwd = root.resolve()
    checks.append(
        Check(
            "repository root",
            "PASS" if actual_cwd == expected_cwd else "FAIL",
            str(actual_cwd),
            f"Run the doctor from the repository root: {expected_cwd}",
        )
    )

    try:
        contract = load_toolchain_contract(root)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        checks.append(
            Check(
                "toolchain contract",
                "FAIL",
                str(exc),
                "Repair the tracked package.json/.nvmrc/CI toolchain contract first.",
            )
        )
        return checks

    checks.append(
        Check(
            "toolchain contract",
            "PASS",
            f"Node {contract.node}; pnpm {contract.pnpm}; Python {contract.python}",
        )
    )

    git = runner(("git", "rev-parse", "--show-toplevel"))
    if git.returncode == 0:
        try:
            git_root = Path(git.output).resolve()
        except OSError:
            git_root = Path(git.output)
        if git_root == expected_cwd:
            checks.append(Check("git checkout", "PASS", str(git_root)))
        else:
            checks.append(
                Check(
                    "git checkout",
                    "FAIL",
                    f"expected {expected_cwd}, found {git_root}",
                    "Run from the intended 4VELO Git checkout.",
                )
            )
    else:
        checks.append(
            Check(
                "git checkout",
                "FAIL",
                git.output or "git unavailable",
                "Install Git and run from the 4VELO repository.",
            )
        )

    ignored = runner(("git", "check-ignore", "-q", ".env.home"))
    if ignored.returncode == 0:
        checks.append(Check("secret-file ignore", "PASS", ".env.home is ignored by Git"))
    else:
        checks.append(
            Check(
                "secret-file ignore",
                "FAIL",
                ".env.home is not protected by the Git ignore contract",
                "Restore the tracked .gitignore rule for .env.home before generating secrets.",
            )
        )

    current_python = python_version or (sys.version_info.major, sys.version_info.minor)
    actual_python = f"{current_python[0]}.{current_python[1]}"
    if actual_python == contract.python:
        checks.append(Check("python", "PASS", actual_python))
    else:
        checks.append(
            Check(
                "python",
                "FAIL",
                f"expected {contract.python}, found {actual_python}",
                f"Install/activate Python {contract.python} to match CI.",
            )
        )

    checks.append(
        _command_check(
            "node",
            ("node", "--version"),
            contract.node,
            f"Install/activate Node {contract.node} (see .nvmrc).",
            runner,
        )
    )
    checks.append(
        _command_check(
            "corepack",
            ("corepack", "--version"),
            None,
            "Use the Corepack bundled with the canonical Node installation.",
            runner,
        )
    )
    checks.append(
        _command_check(
            "pnpm",
            ("pnpm", "--version"),
            contract.pnpm,
            f"Run: corepack enable && corepack prepare pnpm@{contract.pnpm} --activate",
            runner,
        )
    )

    compose = runner(("docker", "compose", "version", "--short"))
    compose_version = _version(compose.output)
    try:
        compose_major = int(compose_version.split(".", 1)[0])
    except (ValueError, IndexError):
        compose_major = -1
    if compose.returncode == 0 and compose_major == 2:
        checks.append(Check("docker compose", "PASS", compose_version))
    else:
        checks.append(
            Check(
                "docker compose",
                "FAIL",
                compose.output or "docker compose unavailable",
                "Install Docker Desktop/Engine with Docker Compose v2.",
            )
        )

    daemon = runner(("docker", "version", "--format", "{{.Server.Version}}"))
    if daemon.returncode == 0 and daemon.output.strip():
        checks.append(Check("docker daemon", "PASS", daemon.output.strip()))
    else:
        checks.append(
            Check(
                "docker daemon",
                "FAIL",
                daemon.output or "Docker daemon unavailable",
                "Start Docker Desktop/Engine and ensure the current user can access it.",
            )
        )

    env_file = root / ".env.home"
    checks.append(
        Check(
            "home-lab environment",
            "PASS",
            ".env.home exists; init will preserve it"
            if env_file.exists()
            else ".env.home not created yet; init is the next safe step",
        )
    )
    return checks


def next_steps(root: Path = ROOT) -> list[str]:
    contract = load_toolchain_contract(root)
    steps = [
        f"corepack enable && corepack prepare pnpm@{contract.pnpm} --activate",
        "pnpm install --frozen-lockfile",
    ]
    if not (root / ".env.home").exists():
        steps.append("python scripts/home_lab.py init")
    steps.extend(
        [
            "python scripts/home_lab.py config",
            "python scripts/home_lab.py up",
        ]
    )
    return steps


def print_human(checks: Sequence[Check], root: Path = ROOT) -> None:
    print("4VELO Dev Doctor")
    print("================")
    for check in checks:
        print(f"[{check.status}] {check.name}: {check.detail}")
        if check.status == "FAIL" and check.remediation:
            print(f"       -> {check.remediation}")

    failures = sum(check.status == "FAIL" for check in checks)
    print()
    if failures:
        print(f"PRECHECK FAILED: {failures} required check(s) need attention.")
        return

    print("PRECHECK PASS")
    print("Next canonical commands:")
    for command in next_steps(root):
        print(f"  {command}")
    print("T90 owns runtime cold-start smoke and the final DEV ENV READY claim.")


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Verify the 4VELO local developer/Home Lab prerequisites without mutating the host."
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="emit machine-readable check results instead of human output",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    checks = collect_checks()
    failed = any(check.status == "FAIL" for check in checks)
    if args.json:
        payload = {
            "ok": not failed,
            "checks": [asdict(check) for check in checks],
            "next_steps": [] if failed else next_steps(),
        }
        print(json.dumps(payload, indent=2))
    else:
        print_human(checks)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
