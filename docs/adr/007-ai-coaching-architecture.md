# ADR 007: AI Coaching Architecture

## Status
Accepted (2026-05-13)

## Context
The "Intelligent Avatar Coach" is a flagship feature. It provides real-time feedback based on performance. Using a purely static template system feels robotic, while using a purely LLM-based system is too slow and potentially unreliable/expensive.

## Decision
We implemented a **Hybrid LLM-Template Strategy** in `AvatarTrainerService`.
- **LLM-First**: The service first attempts to generate a context-aware message via `LlmCoachService` (using `gpt-4o-mini`).
- **Resilient Fallback**: If the LLM call fails, times out (5s), or is rate-limited, the system instantly falls back to a curated list of static personality-matching templates.
- **Circuit Breaker**: If 3 consecutive LLM calls fail, a 60s cooldown is triggered to prevent unnecessary network traffic and API costs during periods of poor connectivity.
- **Deduplication**: We track pending LLM requests to ensure we don't fire multiple identical prompts if a user triggers the same category twice in quick succession.

## Consequences
- **Positive**: High reliability. The user always gets a message, regardless of connectivity.
- **Positive**: Low cost and latency. `gpt-4o-mini` is cheap, and aggressive caching/rate-limiting keeps overhead minimal.
- **Negative**: Occasional "personality jump" between highly dynamic LLM responses and more rigid static templates.
