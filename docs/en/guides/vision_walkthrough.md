# PROJECT VISION: "FEEDING WITH KNOWLEDGE"

The following document outlines the visual and technical direction of the platform. The entire system is built on a rigorously selected Open Source stack, ensuring commercial safety and scalability.

## 1. Visual Concept (Management Panel)

The designed administration panel interface (Web/Windows) focuses on telemetry data clarity and modern dark mode / glassmorphism aesthetics.

![Admin Panel Mockup](file:///C:/Users/akarn/.gemini/antigravity/brain/eb4a7fd7-307b-4760-b580-bbe540ddb5af/admin_panel_mockup_1776964330807.png)

> [!TIP]
> **Premium Aesthetics**: Using background blurs (backdrop-filter) and vibrant color accents allows for creating an enterprise-grade tool that motivates users to engage with data.

## 2. "Single Source of Truth" Architecture (Mobile)

Implementing an **Offline-First** strategy is key to GPS tracking stability.

1.  **Local Database**: Every GPS point goes to SQLite first.
2.  **Synchronization**: A background task detects network availability and sends data packets (batching) to the server.
3.  **Maps**: MapLibre GL renders vector tiles directly from mbtiles files stored on the device.

## 3. Initial Technical Steps

Recommended development sequence:

1.  **Repository Structure**: Initialize the project using a monorepo architecture with dedicated packages for the telemetry core.
2.  **Telemetry Backend**: Run a local Traccar instance (Docker) for WebSocket communication testing.
3.  **BRouter Validation**: Prepare GPX -> BRouter test scripts to verify the Anti-Cheat algorithm.

---

### Do you want me to prepare a project skeleton for the Management Panel now, or should we focus on backend configuration (Traccar/BRouter)?
