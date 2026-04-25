#!/usr/bin/env python3
import argparse
import asyncio
import itertools
import json
import random
import sys
import time
import uuid
import aiohttp

# Global variables for tracking metrics
success_count = 0
failure_count = 0
total_requests = 0
start_time = 0
is_running = True

def generate_payload(batch_size: int) -> bytes:
    """Pre-generates a batch of telemetry packets as a JSON byte string."""
    packets = []
    for _ in range(batch_size):
        packets.append({
            "device_id": f"sim_{uuid.uuid4().hex[:8]}",
            "user_id": random.randint(1, 1_000_000),
            "lat": 52.2297 + random.uniform(-0.1, 0.1),
            "lon": 21.0122 + random.uniform(-0.1, 0.1),
            "speed_ms": random.uniform(2.0, 10.0),
            "accuracy_m": random.uniform(2.0, 10.0),
            "activity_id": random.randint(1, 1_000_000),
            "activity_type": random.choice(["RUN", "BIKE"]),
            "timestamp": time.time()
        })
    return json.dumps({"packets": packets}).encode('utf-8')

async def worker(session: aiohttp.ClientSession, url: str, payload_iterator, target_requests: int):
    """Worker task that continuously sends pre-generated batch payloads."""
    global success_count, failure_count, total_requests, is_running
    headers = {'Content-Type': 'application/json'}
    
    while is_running:
        if target_requests > 0 and total_requests >= target_requests:
            is_running = False
            break
            
        payload = next(payload_iterator)
        try:
            async with session.post(url, data=payload, headers=headers) as response:
                await response.read()  # Drain to keep the connection alive in the pool
                if response.status in (200, 201, 202, 204):
                    success_count += 1
                else:
                    failure_count += 1
        except Exception:
            failure_count += 1
        finally:
            total_requests += 1

async def reporter():
    """Background task that prints live RPS and stats."""
    global success_count, failure_count, total_requests, start_time, is_running
    last_total = 0
    while is_running:
        await asyncio.sleep(1.0)
        now = time.time()
        elapsed = now - start_time
        delta_reqs = total_requests - last_total
        last_total = total_requests
        
        print(f"[Elapsed: {elapsed:6.1f}s] RPS: {delta_reqs:6d}/s | "
              f"Total Req: {total_requests:8d} | Success: {success_count:8d} | Fail: {failure_count:8d}")

async def main(url: str, concurrency: int, target_requests: int, batch_size: int, pool_size: int):
    global start_time, is_running
    
    print(f"Pre-generating {pool_size} payloads (batch size {batch_size}) to avoid CPU bottleneck...")
    payloads = [generate_payload(batch_size) for _ in range(pool_size)]
    payload_iterator = itertools.cycle(payloads)
    
    print(f"Target URL: {url}")
    print(f"Concurrency: {concurrency} | Target Requests: {target_requests} | Payload Batch Size: {batch_size}")
    print("Starting extreme load test...\n")

    connector = aiohttp.TCPConnector(limit=concurrency, ttl_dns_cache=300)
    async with aiohttp.ClientSession(connector=connector) as session:
        start_time = time.time()
        
        reporter_task = asyncio.create_task(reporter())
        workers = [
            asyncio.create_task(worker(session, url, payload_iterator, target_requests))
            for _ in range(concurrency)
        ]
        
        await asyncio.gather(*workers, return_exceptions=True)
        is_running = False
        reporter_task.cancel()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SPORT Extreme Telemetry Load Tester")
    parser.add_argument("--url", type=str, default="http://localhost:8001/api/telemetry/ingest/batch", help="Target API URL")
    parser.add_argument("--concurrency", type=int, default=1000, help="Number of concurrent connections")
    parser.add_argument("--requests", type=int, default=100000, help="Total number of batches to send")
    parser.add_argument("--batch-size", type=int, default=50, help="Records per telemetry batch")
    parser.add_argument("--pool-size", type=int, default=1000, help="Number of pre-generated payloads in memory")
    
    args = parser.parse_args()

    # Opt into faster event loops if available
    try:
        import uvloop
        uvloop.install()
        print("uvloop installed for maximum performance.")
    except ImportError:
        pass

    try:
        asyncio.run(main(args.url, args.concurrency, args.requests, args.batch_size, args.pool_size))
        elapsed = time.time() - start_time
    except KeyboardInterrupt:
        is_running = False
        elapsed = time.time() - start_time
        print("\n--- Test stopped by user ---")
    
    print(f"\nTotal Time: {elapsed:.2f}s")
    if elapsed > 0:
        print(f"Average RPS: {total_requests / elapsed:.2f}/s")
    print(f"Total Requests: {total_requests}")
    print(f"Successful: {success_count}")
    print(f"Failed: {failure_count}")
