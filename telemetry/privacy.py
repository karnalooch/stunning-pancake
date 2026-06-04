"""Privacy zones cache and geospatial checks."""

from __future__ import annotations

import json
import logging
from math import asin, cos, radians, sin, sqrt

from config import REDIS_URL, ZONE_UPDATE_CHANNEL

logger = logging.getLogger("telemetry")

# {user_id: [{lat, lon, radius, id}, ...]}
zones: dict[int, list[dict]] = {}


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r_earth = 6_371_000
    d_lat = radians(lat2 - lat1)
    d_lon = radians(lon2 - lon1)
    lat1r = radians(lat1)
    lat2r = radians(lat2)
    a = sin(d_lat / 2) ** 2 + cos(lat1r) * cos(lat2r) * sin(d_lon / 2) ** 2
    return r_earth * 2 * asin(sqrt(a))


def is_in_privacy_zone(user_id: int | None, lat: float, lon: float) -> bool:
    if user_id is None or user_id not in zones:
        return False
    for zone in zones[user_id]:
        if calculate_distance(lat, lon, zone["lat"], zone["lon"]) <= zone["radius"]:
            return True
    return False


def load_zones_from_rows(rows) -> None:
    zones.clear()
    for r in rows:
        uid = int(r["user_id"])
        if uid not in zones:
            zones[uid] = []
        zones[uid].append(
            {
                "lat": r["lat"],
                "lon": r["lon"],
                "radius": r["radius"],
                "id": r["id"],
            }
        )


async def privacy_zones_sync() -> None:
    """Listen for privacy zone updates from Django via Redis."""
    import asyncio

    import redis.asyncio as redis_lib

    logger.info("privacy_zones_sync: initializing listener on %s", ZONE_UPDATE_CHANNEL)
    client = redis_lib.from_url(REDIS_URL, decode_responses=True)

    while True:
        try:
            async with client.pubsub() as pubsub:
                await pubsub.subscribe(ZONE_UPDATE_CHANNEL)
                async for message in pubsub.listen():
                    if message["type"] != "message":
                        continue
                    data = json.loads(message["data"])
                    uid = int(data["user_id"])

                    if data["type"] == "ZONE_UPDATE":
                        if uid not in zones:
                            zones[uid] = []
                        zone = {
                            "lat": float(data["lat"]),
                            "lon": float(data["lon"]),
                            "radius": float(data["radius"]),
                            "id": data["zone_id"],
                        }
                        zones[uid] = [z for z in zones[uid] if z.get("id") != data["zone_id"]]
                        zones[uid].append(zone)
                        logger.info(
                            "privacy_zones: updated zone %d for user %d",
                            data["zone_id"],
                            uid,
                        )
                    elif data["type"] == "ZONE_DELETE":
                        if uid in zones:
                            zones[uid] = [z for z in zones[uid] if z.get("id") != data["zone_id"]]
                            logger.info(
                                "privacy_zones: deleted zone %d for user %d",
                                data["zone_id"],
                                uid,
                            )
        except Exception as exc:
            logger.error("privacy_zones_sync: connection error (%s). Retrying in 5s...", exc)
            await asyncio.sleep(5)
