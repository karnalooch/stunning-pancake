# ADR-0005: Redis Sorted Sets for Real-Time Leaderboards

**Status**: Accepted  
**Date**: 2026-04-24  
**Author**: akarn  

---

## Context

SPORT requires real-time leaderboards at multiple levels:
- **City leaderboard** — all athletes in a city, ranked by total verified km
- **Event leaderboard** — participants in an active event, updated per-activity
- **Club leaderboard** — members ranked by contribution to club challenges

A naive implementation uses `SELECT ... ORDER BY score DESC LIMIT 10` on the `Participation` table. At 10,000+ concurrent users and 3-second telemetry intervals, this becomes a hot query bottleneck.

## Decision

We use **Redis Sorted Sets (`ZSET`)** for all leaderboard storage and ranking.

Key schema:
```
leaderboard:city:{tenant_id}       → {user_id: score}
leaderboard:event:{event_id}       → {user_id: score}
leaderboard:club:{club_id}         → {user_id: score}
```

Operations:
```python
# Increment score (O(log n))
redis.zincrby(key, km_delta, user_id)

# Top 10 (O(log n + limit))
redis.zrevrange(key, 0, 9, withscores=True)

# User rank (O(log n))
redis.zrevrank(key, user_id)
```

Persistence strategy:
- Redis is configured with `appendonly yes` (AOF) for durability.
- PostgreSQL `Participation.score` remains the source of truth; Redis is the read-optimised cache.
- On cache miss or Redis restart, leaderboard is rebuilt from `Participation` aggregates.

## Consequences

**Positive:**
- `zincrby` + `zrevrange` are O(log n) — constant performance at any scale.
- No DB round-trips for leaderboard reads from the admin dashboard or mobile app.
- TTL can be set per event key to auto-expire completed event boards.

**Negative:**
- Redis data is secondary — `Participation` table is always authoritative.
- Cache warming needed after Redis restart (Celery beat task).
- Memory usage: ~100 bytes per user per leaderboard; 1M users × 10 boards = ~1 GB RAM.

## Alternatives Considered

| Option | Why Rejected |
|--------|-------------|
| PostgreSQL `RANK()` | Correct but too slow for real-time (<100ms SLA) |
| Elasticsearch | Overkill for sorted numeric scores |
| Memcached | No sorted set native structure; would require manual rank computation |
