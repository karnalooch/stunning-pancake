import time
import json
import random
import asyncio
import httpx
import os

# Configuration
TELEMETRY_URL = os.getenv("TELEMETRY_URL", "http://localhost:8001/api/telemetry/ingest")
NUM_ATHLETES = 10
SIEDLCE_CENTER = (52.1672, 22.2906) # Lat, Lon

async def simulate_athlete(athlete_id):
    """Simulates a single athlete moving in a random direction from Siedlce center."""
    lat, lon = SIEDLCE_CENTER
    # Small variations to start in different places
    lat += random.uniform(-0.01, 0.01)
    lon += random.uniform(-0.01, 0.01)
    
    device_id = f"GRUPETTO-{athlete_id:02d}"
    print(f"Starting simulation for {device_id}", flush=True)

    async with httpx.AsyncClient() as client:
        for i in range(100): # 100 points per athlete
            # Move slightly (approx cycling speed)
            lat += random.uniform(-0.0005, 0.0005)
            lon += random.uniform(-0.0005, 0.0005)
            speed_ms = random.uniform(5.0, 10.0) # 18-36 km/h
            
            payload = {
                "device_id": device_id,
                "lat": lat,
                "lon": lon,
                "speed_ms": speed_ms,
                "timestamp": time.time(),
                "activity_type": "BIKE"
            }
            
            try:
                resp = await client.post(TELEMETRY_URL, json=payload, timeout=5.0)
                if resp.status_code not in [200, 202]:
                    print(f"[{device_id}] Failed: {resp.status_code} - {resp.text}", flush=True)
            except Exception as e:
                print(f"[{device_id}] Error: {e}", flush=True)
            
            # Wait 3-5 seconds between points
            await asyncio.sleep(random.uniform(3, 5))

async def main():
    print(f"Target: {TELEMETRY_URL}", flush=True)
    tasks = [simulate_athlete(i) for i in range(1, NUM_ATHLETES + 1)]
    await asyncio.gather(*tasks)

if __name__ == "__main__":
    asyncio.run(main())
