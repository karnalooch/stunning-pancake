# BACKEND ARCHITECTURE: "SPORT"

## 1. Telemetry Core: Traccar (Apache 2.0)
Traccar remains the central data ingestion point, but Milestone 2 introduces a high-performance **Redis Direct Pipeline**.

### Data Flow (Milestone 2 Optimized)
- **Direct Pub/Sub**: Traccar pushes raw GPS positions directly to a Redis channel (`traccar:positions`), bypassing traditional HTTP webhooks to achieve <1ms ingestion lag.
- **FastAPI Telemetry Service**: A dedicated async service consumes the Redis stream and performs the first pass of validation.
- **TimescaleDB**: GPS points are stored in **Hypertables**, optimized for time-series analysis and rapid heatmap generation.

## 2. Multi-Layer Anti-Cheat Engine
The validation process is now a structured 3-layer pipeline designed for cost-efficiency and high integrity.

### Layer 1: Fast Selection Gate (O(N) Math)
- **Zero I/O**: Performs kinematic tests (Teleport, Accel, Motor Fingerprint) purely in memory.
- **Early Rejection**: Obvious "tram/car" tracks are rejected before hitting expensive map-matching engines.

### Layer 2: V-max Biomechanical Check
- Verifies segments against sport-specific speed ceilings (RUN/BIKE/WALK).
- Uses configurable anomaly ratios (e.g., >20% violations = reject).

### Layer 3: BRouter Topological Validation (MIT)
- **Map-Matching**: Snaps track to the OpenStreetMap road network via the Viterbi HMM algorithm.
- **Topology Check**: Verifies that the track follows valid paths and doesn't cross physical barriers (buildings, rivers) without infrastructure.

## 3. High-Performance Leaderboards: Redis + PostGIS
Rankings are handled by a hybrid approach for both speed and official accuracy.

### Real-time (Redis)
- **Sorted Sets**: Instant rankings for active events.
- **Pipeline Batching**: Updates are batched via Redis pipelines to handle hundreds of concurrent session finishes.

### Official Rankings (PostGIS)
- **Materialized Views**: `city_rankings_mv` provides the "Source of Truth" for official municipal battles.
- **Async Refresh**: Updated concurrently via Celery tasks to ensure the API remains responsive.

## 4. Communication: Matrix (Apache 2.0)
Decentralized, encrypted chat for clans and cities.
- **Clan Automation**: Matrix rooms are automatically provisioned when a sports club is created.
- **Matrix SDK**: Integrated via `matrix-js-sdk` (Mobile) and Python `matrix-nio` (Backend).

## 5. Domain-Driven Design (DDD)
The backend follows a service-oriented pattern to isolate business logic from delivery mechanisms.
- `activities.services.signal_processing`: The brain of the telemetry engine.
- `activities.tasks`: Asynchronous pipeline management using Celery.
- `leaderboards.services`: Logic for Redis/PostGIS ranking synchronization.
