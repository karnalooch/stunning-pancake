# ADR 007: AI Coaching Architecture

| | |
|--|--|
| **Status** | Accepted |
| **Owner role** | Tech Lead |
| **Last reviewed** | 2026-06-03 |
| **Language** | English |
| **Index** | [docs/README.md](../README.md) |


## Status
Accepted (2026-05-13)

## Context
The "Intelligent Avatar Coach" is a flagship feature. It provides real-time feedback based on performance. Using a purely static template system feels robotic, while using a purely LLM-based system is too slow and potentially unreliable/expensive.

## Decision
We implemented a **Hybrid LLM-Template Strategy** in `AvatarTrainerService`.

### Logic Flow
1. **Trigger Phase**: Sensor data (speed, HR) triggers a coaching event (e.g., `PACE_DROP`).
2. **Deduplication**: If an identical trigger is already being processed by the LLM, the new event is ignored to prevent "chatter".
3. **Execution Phase**:
    - **LLM Call**: The system sends a prompt containing (Personality + Context + Performance Variables) to the LLM.
    - **Caching**: Successful responses are cached for the duration of the session to reduce API costs.
    - **Circuit Breaker**: If 3 consecutive network failures or timeouts (>5s) occur, the LLM is bypassed globally for 60 seconds.
4. **Fallback Phase**: If the LLM is bypassed (or fails), a random template is selected from `MESSAGES[personality][category]` and interpolated with current variables.

### Prompt Strategy
Prompts are restricted to **Polish** and a maximum of **150 characters**. This ensures the resulting message fits comfortably within the UI notification bubbles and keeps the voice synthesis (Text-to-Speech) concise.

## Consequences
- **Positive**: High reliability. The user always gets a message, regardless of connectivity.
- **Positive**: Cost Efficiency. Caching and rate-limiting (max 1 call per 15s) prevent runaway API spending.
- **Negative**: Occasional latency (~1-2s) for the first LLM message of a category, though subsequent identical triggers are either cached or rate-limited.
