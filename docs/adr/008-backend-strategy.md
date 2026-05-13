# ADR 008: Backend Integration Strategy (Power Couple)

## Status
Accepted (2026-05-13)

## Context
The SPORT platform needs to handle both high-frequency telemetry ingestion and complex business logic (users, activities, leaderboards, AI coaching).

## Decision
We adopted the **"Power Couple" Strategy**:
- **Python (Django/FastAPI)**: Used for the core backend, heavy data processing, AI model orchestration, and telemetry ingestion. Python was chosen for its mature data science ecosystem and rapid development speed for complex logic.
- **TypeScript (React/React Native)**: Used for all frontend interfaces (Web Admin & Mobile App). TypeScript ensures type safety across the application layer and a high-quality UI/UX.
- **Shared Schemas**: We use JSON-based contracts between the mobile app and backend to ensure consistency.
- **Telemetry Proxy**: The mobile app communicates with a dedicated telemetry endpoint optimized for high-volume batch ingestion, separate from the main business API.

## Consequences
- **Positive**: Best-of-breed tools for each domain (Data vs UI).
- **Positive**: Scalability. Ingestion can be scaled independently from the user-facing web server.
- **Negative**: Overhead of maintaining two language stacks and ensuring API contract synchronization.
