#!/usr/bin/env python3
"""
P1 operational gate — poll live-simulate API and evaluate criteria 4 & 6.

Usage:
  export API_BASE=https://your-backend.up.railway.app/api
  export ADMIN_USER=global_owner ADMIN_PASS=...
  python scripts/simulator_operational_gate.py --minutes 17 --interval 60

Exit 0 = GO or WARN (idle), 1 = NO-GO.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from activities.simulator_operational_gate import GateSample, evaluate_gate  # noqa: E402

try:
    import requests
except ImportError:
    print("pip install requests", file=sys.stderr)
    sys.exit(2)


def _api_base() -> str:
    base = (
        os.getenv("API_BASE")
        or os.getenv("ADMIN_API_URL")
        or os.getenv("VITE_API_URL")
        or ""
    ).rstrip("/")
    if not base:
        raise SystemExit("Set API_BASE (e.g. https://host.up.railway.app/api)")
    if not base.endswith("/api"):
        base = f"{base}/api" if "/api" not in base else base
    return base


def _token(session: requests.Session, base: str) -> str:
    user = os.getenv("ADMIN_USER") or os.getenv("ADMIN_USER_GLOBAL_OWNER")
    password = os.getenv("ADMIN_PASS") or os.getenv("ADMIN_PASS_GLOBAL_OWNER")
    if not user or not password:
        raise SystemExit("Set ADMIN_USER and ADMIN_PASS (or GLOBAL_OWNER variants)")
    r = session.post(
        f"{base}/auth/token/",
        json={"username": user, "password": password},
        timeout=60,
    )
    r.raise_for_status()
    return r.json()["access"]


def _fetch_live_state(session: requests.Session, base: str, token: str) -> dict:
    r = session.get(
        f"{base}/activities/admin/live-simulate/",
        headers={"Authorization": f"Bearer {token}"},
        timeout=90,
    )
    r.raise_for_status()
    return r.json()


def main() -> int:
    parser = argparse.ArgumentParser(description="Simulator operational gate (P1 §1b)")
    parser.add_argument("--minutes", type=int, default=17, help="Observation window")
    parser.add_argument("--interval", type=int, default=60, help="Seconds between polls")
    parser.add_argument(
        "--report-dir",
        type=Path,
        default=ROOT / "scripts" / "load" / "reports",
    )
    parser.add_argument("--once", action="store_true", help="Single sample (smoke)")
    args = parser.parse_args()

    base = _api_base()
    session = requests.Session()
    token = _token(session, base)

    samples: list[GateSample] = []
    deadline = time.time() + (0 if args.once else args.minutes * 60)

    print(f"=== Simulator operational gate ===\nAPI: {base}\n")

    while True:
        now = datetime.now(UTC).isoformat()
        payload = _fetch_live_state(session, base, token)
        sample = GateSample.from_api_payload(payload, at=now)
        samples.append(sample)
        print(
            f"[{now}] running={sample.running} warming={sample.ride_warming} "
            f"depth={sample.routing_queue_depth}/{sample.max_routing_queue_depth} "
            f"bp={sample.routing_backpressure_active}"
        )
        if args.once or time.time() >= deadline:
            break
        time.sleep(max(5, args.interval))

    result = evaluate_gate(samples)
    report = {
        "evaluated_at": datetime.now(UTC).isoformat(),
        "api_base": base,
        "window_minutes": args.minutes if not args.once else 0,
        "poll_interval_s": args.interval,
        "samples": [s.__dict__ for s in samples],
        "result": result,
    }

    args.report_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
    report_path = args.report_dir / f"sim-operational-gate-{stamp}.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    verdict = result["verdict"]
    color = {"go": "GO", "warn": "WARN", "no-go": "NO-GO"}[verdict]
    print(f"\n=== Verdict: {color} ({result.get('reason')}) ===")
    print(f"Report: {report_path}")
    for name, check in (result.get("checks") or {}).items():
        if isinstance(check, dict):
            mark = "OK" if check.get("ok") else "FAIL"
            print(f"  {name}: {mark} — {check.get('detail')}")

    if verdict == "no-go":
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
