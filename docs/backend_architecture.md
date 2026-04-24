# BACKEND ARCHITECTURE: "SPORT"

## 1. Telemetry Core: Traccar (Apache 2.0)
Traccar is the central point for data collection. This choice is driven by project maturity and support for hundreds of GPS protocols.

### Configuration and Integration
- **Database**: PostgreSQL (TimescaleDB recommended for large-scale time-series data).
- **Communication**: Real-time stream via WebSockets (JSON protocol).
- **Computed Attributes**: Using JEXL to filter activity types based on speed and sensors (e.g., heart rate monitor).
- **Groups**: Logical isolation of B2B users (e.g., Company X sees only its employees).

## 2. Validation and Map-Matching: BRouter (MIT)
BRouter is used to verify the authenticity of traveled tracks.

### GPX Validation Process
1.  **Track Receipt**: After a session ends, the GPX track is sent to the BRouter API.
2.  **Topological Check**: BRouter matches points to the OpenStreetMap road network.
3.  **Cost Factor Analysis**: If the track passes through inaccessible areas (e.g., buildings, lakes without ferries) for the selected profile (bike/run), it is flagged as suspicious.
4.  **Anti-Cheat**: Comparison of GPS distance with "on-road" distance (routing distance). Significant discrepancies suggest spoofing or the use of a motorized vehicle.

## 3. Gamification Engine: Redis (BSD-3-Clause)
Rankings must be calculated instantaneously.

### Data Structure (Sorted Sets)
- **Key**: `leaderboard:city:{city_id}` or `leaderboard:corp:{corp_id}`.
- **Score**: Normalized points (e.g., kilometers / number of residents/employees).
- **Member**: UserID.
- **Advantage**: O(log(N)) operations allow handling millions of records in milliseconds.

## 4. Communication: Matrix (Apache 2.0)
A decentralized chat protocol ensuring retention and security.

### Integration
- **Matrix Rust SDK**: Used in the Flutter app to handle clan and city rooms.
- **E2EE**: End-to-end encryption for private messages.
- **Identity Provider**: Integration with the platform's user database.

## 5. Extensibility: Service-Oriented Logic
To ensure the platform can evolve (AI, Marketplaces, New Sports), the backend follows a strict decoupled pattern:

### 5.1 Domain-Driven Design (DDD)
Business logic is encapsulated in **Service Layers** within each Django app, not in Views.
- `activities.services`: Handles track processing and BRouter validation.
- `events.services`: Manages participation, progress calculation, and leaderboard updates.
- `rewards.services`: Integration with external voucher providers.

### 5.2 Multi-Tenant Data Isolation
- All models contain a `tenant_id` to ensure data leakage prevention at the database level (PostgreSQL RLS - Row Level Security is an option for Phase 5).
- Each tenant can have its own validation rules and normalization factors stored in a `TenantConfig` JSON object.

### 5.3 Future-Proof Integration Hooks
- **Signal System**: Use of Django Signals (or a local event bus) to trigger cross-app actions (e.g., "Activity Verified" -> "Update Event Progress").
- **Task Queue Isolation**: Separate Celery queues for critical (Telemetry) and non-critical (Social notifications) tasks to prevent bottlenecks.
