#!/usr/bin/env python3
"""
Telemetry ingest + live-map load test scaffold.

Safe default: localhost. Do NOT point at production 50k without operator approval.

Examples:
  # Ingest benchmark (~50k positions/s target)
  python scripts/load-test-telemetry-ingest.py \\
    --url http://localhost:8001/api/telemetry/ingest/batch \\
    --workers 50 --duration 60 --batch-size 50 --target-rate 50000

  # Max-throughput laptop bench (no throttle, skip DB on telemetry side)
  python scripts/load-test-telemetry-ingest.py \\
    --url http://localhost:8001/api/telemetry/ingest/batch \\
    --workers 80 --duration 60 --batch-size 100 --target-rate 0 --skip-map

  # Live map p95 only (with JWT)
  python scripts/load-test-telemetry-ingest.py \\
    --map-url http://localhost:8000/api/activities/telemetry/live/ \\
    --token YOUR_JWT --map-workers 10 --map-duration 30 --map-only
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
import uuid
from pathlib import Path
from urllib.parse import urlparse

_LOAD_ROOT = Path(__file__).resolve().parent / "load"
if str(_LOAD_ROOT) not in sys.path:
    sys.path.insert(0, str(_LOAD_ROOT))

from lib.report import (  # noqa: E402
    build_report,
    evaluate_thresholds,
    ingest_metrics_from_counters,
    map_metrics_from_counters,
    validate_report,
)

try:
    import httpx
except ImportError as exc:
    raise SystemExit("Install httpx: pip install httpx") from exc


def _percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    values = sorted(values)
    k = (len(values) - 1) * (pct / 100.0)
    f = int(k)
    c = min(f + 1, len(values) - 1)
    if f == c:
        return values[f]
    return values[f] + (values[c] - values[f]) * (k - f)


def _summarize_latencies(latencies_ms: list[float]) -> dict[str, float]:
    if not latencies_ms:
        return {"p50": 0, "p95": 0, "p99": 0, "max": 0}
    return {
        "p50": _percentile(latencies_ms, 50),
        "p95": _percentile(latencies_ms, 95),
        "p99": _percentile(latencies_ms, 99),
        "max": max(latencies_ms),
    }


def _auth_headers(args: argparse.Namespace) -> dict[str, str]:
    if args.auth_header:
        return {"Authorization": args.auth_header}
    if args.token:
        return {"Authorization": f"Bearer {args.token}"}
    return {}


def _telemetry_health_url(ingest_url: str) -> str:
    parsed = urlparse(ingest_url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    return f"{base}/api/telemetry/health"


def _backend_base(map_url: str) -> str:
    parsed = urlparse(map_url)
    return f"{parsed.scheme}://{parsed.netloc}"


async def run_preflight(args: argparse.Namespace) -> bool:
    """Check health endpoints; optional admin telemetry count."""
    headers = _auth_headers(args)
    ok = True
    telemetry_health = _telemetry_health_url(args.url)
    print("=== Preflight ===")
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(telemetry_health)
            print(f"Telemetry health ({telemetry_health}): {resp.status_code} {resp.text[:120]}")
            ok = ok and resp.status_code == 200
        except Exception as exc:
            print(f"Telemetry health FAILED: {exc}")
            ok = False

        if args.map_url and not args.map_only:
            backend = _backend_base(args.map_url)
            try:
                resp = await client.get(f"{backend}/health/", headers=headers)
                print(f"Backend health ({backend}/health/): {resp.status_code}")
                ok = ok and resp.status_code == 200
            except Exception as exc:
                print(f"Backend health FAILED: {exc}")
                ok = False

        if args.preflight_count and args.map_url:
            try:
                resp = await client.get(args.map_url, params={"zoom": 6, "limit": 1}, headers=headers)
                print(f"Live map probe: {resp.status_code}")
                if resp.status_code == 200:
                    data = resp.json()
                    count = len(data) if isinstance(data, list) else data.get("count", "?")
                    print(f"  indexed positions (sample): {count}")
                else:
                    print("  (auth may be required — pass --token or --auth-header)")
            except Exception as exc:
                print(f"Live map probe FAILED: {exc}")
    print(f"Preflight: {'PASS' if ok else 'FAIL'}")
    return ok


async def _ingest_worker(
    client: httpx.AsyncClient,
    url: str,
    batch_size: int,
    duration: float,
    deadline: float,
    latencies: list[float],
    counters: dict[str, int],
    throttle_interval: float,
) -> None:
    base_lat, base_lon = 52.0, 21.0
    device_idx = 0
    while time.monotonic() < deadline:
        if throttle_interval > 0:
            await asyncio.sleep(throttle_interval)

        device_idx += 1
        packets = []
        now = time.time()
        for i in range(batch_size):
            packets.append(
                {
                    "device_id": f"load-{device_idx}-{i}",
                    "lat": base_lat + (i * 0.0001),
                    "lon": base_lon + (i * 0.0001),
                    "speed_ms": 5.0,
                    "timestamp": now,
                }
            )
        body = {
            "packets": packets,
            "client_batch_id": str(uuid.uuid4()),
        }
        t0 = time.perf_counter()
        try:
            resp = await client.post(url, json=body, timeout=30.0)
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            latencies.append(elapsed_ms)
            if resp.status_code == 202:
                counters["accepted"] += 1
                counters["positions"] += batch_size
            elif resp.status_code == 429:
                counters["throttled"] += 1
            else:
                counters["errors"] += 1
        except Exception:
            counters["errors"] += 1


def _write_json_report(
    args: argparse.Namespace,
    *,
    mode: str,
    ingest_stats: dict[str, float] | None = None,
    ingest_counters: dict[str, int] | None = None,
    map_stats: dict[str, float] | None = None,
    map_counters: dict[str, int] | None = None,
) -> None:
    if not args.json_out:
        return

    metrics: dict = {}
    if ingest_counters and ingest_stats is not None:
        metrics["ingest"] = ingest_metrics_from_counters(
            duration_s=args.duration,
            batch_size=args.batch_size,
            accepted=ingest_counters["accepted"],
            throttled=ingest_counters["throttled"],
            errors=ingest_counters["errors"],
            latency_ms=ingest_stats,
        )
    if map_counters and map_stats is not None:
        metrics["map"] = map_metrics_from_counters(
            ok=map_counters["ok"],
            errors=map_counters["errors"],
            latency_ms=map_stats,
        )

    tier = args.report_tier or "baseline"
    report = build_report(
        suite=args.report_suite or "python-ingest",
        tier=tier,
        environment={
            "target": args.report_target or "local",
            "ingest_url": args.url,
            "map_url": args.map_url,
        },
        tools=[
            {
                "name": mode,
                "duration_s": args.duration if mode == "python-ingest" else args.map_duration,
            }
        ],
        metrics=metrics,
    )
    report["threshold_evaluation"] = evaluate_thresholds(report, tier)
    errors = validate_report(report)
    if errors:
        report["validation_errors"] = errors

    out = Path(args.json_out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")


async def run_ingest(args: argparse.Namespace) -> None:
    deadline = time.monotonic() + args.duration
    latencies: list[float] = []
    counters = {"accepted": 0, "throttled": 0, "errors": 0, "positions": 0}

    positions_per_request = args.batch_size
    requests_per_sec = (
        args.target_rate / positions_per_request if args.target_rate > 0 else 0
    )
    throttle_interval = 1.0 / (requests_per_sec / args.workers) if requests_per_sec > 0 else 0

    limits = httpx.Limits(max_connections=max(args.workers * 2, 10))
    async with httpx.AsyncClient(limits=limits) as client:
        tasks = [
            asyncio.create_task(
                _ingest_worker(
                    client,
                    args.url,
                    args.batch_size,
                    args.duration,
                    deadline,
                    latencies,
                    counters,
                    throttle_interval,
                )
            )
            for _ in range(args.workers)
        ]
        await asyncio.gather(*tasks)

    elapsed = args.duration
    stats = _summarize_latencies(latencies)
    rps = counters["accepted"] / elapsed if elapsed else 0
    pps = counters["positions"] / elapsed if elapsed else 0

    print("\n=== Telemetry ingest load test ===")
    print(f"URL:           {args.url}")
    print(f"Workers:       {args.workers}")
    print(f"Batch size:    {args.batch_size}")
    print(f"Duration:      {args.duration}s")
    print(f"Target rate:   {args.target_rate or 'unlimited'} positions/s")
    print(f"Accepted:      {counters['accepted']} batches ({counters['positions']} positions)")
    print(f"Throttled 429: {counters['throttled']}")
    print(f"Errors:        {counters['errors']}")
    print(f"Throughput:    {rps:.1f} req/s  |  {pps:.1f} positions/s")
    print(f"Latency ms:    p50={stats['p50']:.1f}  p95={stats['p95']:.1f}  p99={stats['p99']:.1f}  max={stats['max']:.1f}")
    if args.target_rate > 0:
        ok = pps >= args.target_rate * 0.9
        print(f"Target met:    {'PASS' if ok else 'FAIL'} (>=90% of {args.target_rate}/s)")

    _write_json_report(
        args,
        mode="python-ingest",
        ingest_stats=stats,
        ingest_counters=counters,
    )

    if args.assert_outbox:
        # ADR 011: instrumented mobile clients retain points until ACK; harness expects no 5xx.
        outbox_ok = counters["errors"] == 0
        print(
            f"Outbox harness: {'PASS' if outbox_ok else 'FAIL'} "
            "(0 HTTP errors; mobile outbox must not clear on 202 without ACK)"
        )
        if not outbox_ok:
            sys.exit(2)


async def _map_worker(
    client: httpx.AsyncClient,
    url: str,
    deadline: float,
    latencies: list[float],
    counters: dict[str, int],
    headers: dict[str, str],
) -> None:
    params = {"zoom": 6, "limit": 800, "detail": "summary"}
    while time.monotonic() < deadline:
        t0 = time.perf_counter()
        try:
            resp = await client.get(url, params=params, headers=headers, timeout=30.0)
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            latencies.append(elapsed_ms)
            if resp.status_code == 200:
                counters["ok"] += 1
            else:
                counters["errors"] += 1
        except Exception:
            counters["errors"] += 1
        await asyncio.sleep(0.05)


async def run_map(args: argparse.Namespace) -> None:
    deadline = time.monotonic() + args.map_duration
    latencies: list[float] = []
    counters = {"ok": 0, "errors": 0}
    headers = _auth_headers(args)
    limits = httpx.Limits(max_connections=max(args.map_workers * 2, 10))

    async with httpx.AsyncClient(limits=limits) as client:
        tasks = [
            asyncio.create_task(
                _map_worker(client, args.map_url, deadline, latencies, counters, headers)
            )
            for _ in range(args.map_workers)
        ]
        await asyncio.gather(*tasks)

    stats = _summarize_latencies(latencies)
    print("\n=== Live map read load test ===")
    print(f"URL:           {args.map_url}")
    print(f"Workers:       {args.map_workers}")
    print(f"Duration:      {args.map_duration}s")
    print(f"OK responses:  {counters['ok']}")
    print(f"Errors:        {counters['errors']}")
    print(f"Latency ms:    p50={stats['p50']:.1f}  p95={stats['p95']:.1f}  p99={stats['p99']:.1f}")
    print(f"p95 < 300ms:   {'PASS' if stats['p95'] < 300 else 'FAIL'}")

    _write_json_report(
        args,
        mode="python-map",
        map_stats=stats,
        map_counters=counters,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Telemetry ingest / live-map load test")
    parser.add_argument(
        "--url",
        default="http://localhost:8001/api/telemetry/ingest/batch",
        help="FastAPI batch ingest URL",
    )
    parser.add_argument("--workers", type=int, default=20, help="Concurrent ingest workers")
    parser.add_argument("--duration", type=float, default=30.0, help="Ingest test duration (s)")
    parser.add_argument("--batch-size", type=int, default=50, help="Packets per batch POST")
    parser.add_argument(
        "--target-rate",
        type=int,
        default=0,
        help="Target positions/s (0 = unlimited)",
    )
    parser.add_argument(
        "--map-url",
        default="http://localhost:8000/api/activities/telemetry/live/",
        help="Django live map API URL",
    )
    parser.add_argument("--map-workers", type=int, default=10)
    parser.add_argument("--map-duration", type=float, default=30.0)
    parser.add_argument(
        "--map-only",
        action="store_true",
        help="Skip ingest; benchmark live-map reads only",
    )
    parser.add_argument(
        "--skip-map",
        action="store_true",
        help="Skip live-map read benchmark after ingest",
    )
    parser.add_argument(
        "--token",
        default="",
        help="JWT for map requests (Authorization: Bearer)",
    )
    parser.add_argument(
        "--auth-header",
        default="",
        help="Full Authorization header value (overrides --token)",
    )
    parser.add_argument(
        "--preflight",
        action="store_true",
        help="Check telemetry/backend health before running",
    )
    parser.add_argument(
        "--preflight-count",
        action="store_true",
        help="With --preflight, probe live-map index count (needs auth for prod-like stacks)",
    )
    parser.add_argument(
        "--assert-outbox",
        action="store_true",
        help="ADR 011: fail if any ingest HTTP errors (companion to mobile outbox engaged-guard test)",
    )
    parser.add_argument(
        "--json-out",
        default="",
        help="Write unified load report JSON (scripts/load/report_schema.json v1)",
    )
    parser.add_argument(
        "--report-tier",
        default="baseline",
        help="Threshold tier for --json-out (smoke, baseline, stress-50k, soak)",
    )
    parser.add_argument(
        "--report-suite",
        default="",
        help="Suite name embedded in --json-out report",
    )
    parser.add_argument(
        "--report-target",
        default="local",
        help="Environment label in --json-out report",
    )
    args = parser.parse_args()

    if args.preflight:
        ok = asyncio.run(run_preflight(args))
        if not ok:
            sys.exit(1)

    if args.map_only:
        asyncio.run(run_map(args))
    else:
        asyncio.run(run_ingest(args))
        if args.map_url and not args.skip_map:
            asyncio.run(run_map(args))


if __name__ == "__main__":
    main()
