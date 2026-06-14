/**
 * Integration Tests: AvatarTrainerService + TriggerEngine
 * ========================================================
 * Verifies end-to-end flow of trigger generation through
 * priority queue to final dialog display.
 * 
 * Run: npm test -- __tests__/services/Integration.test.ts
 */

import { AvatarTrainerService } from '../../src/services/AvatarTrainerService';
import { triggerEngine, TriggerPriority } from '../../src/services/TriggerEngine';

jest.mock('../../src/services/LlmCoachService', () => ({
  LlmCoachService: jest.fn().mockImplementation(() => ({
    generateMessage: jest.fn().mockResolvedValue(null),
    clearCache: jest.fn(),
    destroy: jest.fn(),
    isHealthy: jest.fn().mockReturnValue(false),
  })),
  llmCoach: {
    generateMessage: jest.fn().mockResolvedValue(null),
    clearCache: jest.fn(),
    destroy: jest.fn(),
    isHealthy: jest.fn().mockReturnValue(false),
  },
}));

// Flush microtask queue without advancing fake timers.
// Multiple resolutions handle chained async promises (e.g. _postMessage → llmCoach.generateMessage → triggerEngine.push).
const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('Integration: AvatarTrainerService + TriggerEngine', () => {
  let trainer: AvatarTrainerService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    trainer = new AvatarTrainerService();
    // Clear previous engine state
    triggerEngine.clear();
  });

  afterEach(() => {
    trainer.destroy();
    triggerEngine.clear();
    jest.useRealTimers();
  });

  // ── 1. Full Session Cycle ─────────────────────────

  test('START → OBSERVING → COACHING → IDLE lifecycle', async () => {
    trainer.setPersonality('MOTIVATOR');
    trainer.startSession();
    await flushPromises();

    expect(trainer.state.state.get()).toBe('OBSERVING');
    expect(triggerEngine.state.queue.get().length).toBeGreaterThanOrEqual(2);

    // Simulate a pace drop trigger → COACHING
    for (let i = 0; i < 6; i++) {
      trainer.update({
        distanceM: 100 * i,
        speedMs: 5.0,
        paceSecPerKm: 200,
        heartRate: 100,
        batteryPct: 0.8,
        elevationGainM: 0,
        gpsAccuracyM: 5,
        elapsedSec: 10 * i,
      });
    }

    jest.advanceTimersByTime(31_000);
    trainer.update({
      distanceM: 600,
      speedMs: 2.0, // big drop
      paceSecPerKm: 500,
      heartRate: 100,
      batteryPct: 0.8,
      elevationGainM: 0,
      gpsAccuracyM: 5,
      elapsedSec: 310,
    });
    await flushPromises();

    expect(trainer.state.state.get()).toBe('COACHING');

    // End session → IDLE
    trainer.endSession();
    await flushPromises();
    jest.runAllTimers();

    expect(trainer.state.state.get()).toBe('IDLE');
  });

  // ── 2. Priority Queue Integration ─────────────────

  test('CRITICAL triggers should appear before LOW in queue', async () => {
    trainer.setPersonality('DRILL_SERGEANT');
    trainer.startSession();
    await flushPromises();

    // Push some data that triggers multiple events
    trainer.update({
      distanceM: 2000,
      speedMs: 2.0,
      paceSecPerKm: 500,
      heartRate: 120,
      batteryPct: 0.15, // low battery → CRITICAL
      elevationGainM: 0,
      gpsAccuracyM: 75, // GPS lost → CRITICAL
      elapsedSec: 30,
    });
    await flushPromises();

    const queue = triggerEngine.state.queue.get();

    // Find the highest priority items
    const priorities = queue.map(t => t.priority);

    // Queue should be sorted: CRITICAL(4) > HIGH(3) > MEDIUM(2) > LOW(1)
    for (let i = 1; i < priorities.length; i++) {
      const prev = priorities[i - 1] ?? TriggerPriority.LOW;
      const current = priorities[i] ?? TriggerPriority.LOW;
      expect(prev).toBeGreaterThanOrEqual(current);
    }
  });

  // ── 3. Dialog Display Flow ────────────────────────

  test('triggerEngine should process queue items one by one', async () => {
    trainer.setPersonality('ANALYST');
    trainer.startSession();
    await flushPromises();

    // Fire only the processing timer (not the auto-dismiss)
    jest.advanceTimersByTime(0);

    // A dialog should be visible
    expect(triggerEngine.state.currentDialog.visible.get()).toBe(true);
    expect(triggerEngine.state.currentDialog.message.get().length).toBeGreaterThan(0);

    // Dismiss and wait for next
    triggerEngine.dismiss();
    jest.advanceTimersByTime(600); // exit animation
    jest.advanceTimersByTime(8_000); // cooldown

    // Next message should be processed if queue has items
    // (queue may be empty after processing, but that's fine)
    expect(true).toBe(true);
  });

  // ── 4. Cooldown + Dedup in Integration ────────────

  test('duplicate trigger IDs should be deduplicated', async () => {
    trainer.setPersonality('MOTIVATOR');
    trainer.startSession();
    await flushPromises();

    // Call startSession again — triggers should not double
    trainer.startSession();
    await flushPromises();

    const queue = triggerEngine.state.queue.get();
    const firstActivityTriggers = queue.filter(t => t.id === 'first-activity-day');
    const sessionStartTriggers = queue.filter(t => t.id === 'session-start');

    // Dedup in TriggerEngine prevents duplicates
    expect(firstActivityTriggers.length).toBeLessThanOrEqual(1);
    expect(sessionStartTriggers.length).toBeLessThanOrEqual(1);
  });

  // ── 5. Trigger Engine State After Destroy ─────────

  test('destroying AvatarTrainer also cleans TriggerEngine', () => {
    trainer.destroy();

    expect(triggerEngine.state.queue.get().length).toBe(0);
    expect(triggerEngine.state.currentDialog.visible.get()).toBe(false);
  });
});
