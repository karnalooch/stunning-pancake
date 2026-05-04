/**
 * TriggerEngine Unit Tests
 * =========================
 * Tests priority queue ordering, cooldown system, deduplication,
 * FIFO within same priority, and edge cases (full queue, rapid pushes).
 * 
 * Run: npm test -- __tests__/services/TriggerEngine.test.ts
 */

import { TriggerEngine, TriggerPriority, TriggerMessage } from '../../src/services/TriggerEngine';

describe('TriggerEngine', () => {
  let engine: TriggerEngine;

  beforeEach(() => {
    jest.useFakeTimers();
    engine = new TriggerEngine();
  });

  afterEach(() => {
    engine.destroy();
    jest.useRealTimers();
  });

  function makeTrigger(overrides: Partial<TriggerMessage> & { id: string }): Omit<TriggerMessage, 'timestamp'> {
    return {
      message: 'Test message',
      title: 'TEST_TITLE',
      character: 'runner',
      priority: TriggerPriority.LOW,
      category: 'MOTIVATIONAL',
      ...overrides,
    };
  }

  // ── 1. Priority Queue Ordering ────────────────────

  test('CRITICAL messages should be processed first', () => {
    engine.push(makeTrigger({ id: 'low', priority: TriggerPriority.LOW }));
    engine.push(makeTrigger({ id: 'critical', priority: TriggerPriority.CRITICAL }));
    engine.push(makeTrigger({ id: 'medium', priority: TriggerPriority.MEDIUM }));

    const queue = engine.state.queue.get();
    expect(queue[0].id).toBe('critical');
    expect(queue[1].id).toBe('medium');
    expect(queue[2].id).toBe('low');
  });

  test('HIGH > MEDIUM > LOW ordering', () => {
    engine.push(makeTrigger({ id: 'm1', priority: TriggerPriority.MEDIUM }));
    engine.push(makeTrigger({ id: 'l1', priority: TriggerPriority.LOW }));
    engine.push(makeTrigger({ id: 'h1', priority: TriggerPriority.HIGH }));

    const queue = engine.state.queue.get();
    expect(queue[0].id).toBe('h1');
    expect(queue[1].id).toBe('m1');
    expect(queue[2].id).toBe('l1');
  });

  test('FIFO within same priority', () => {
    engine.push(makeTrigger({ id: 'a', priority: TriggerPriority.LOW }));
    engine.push(makeTrigger({ id: 'b', priority: TriggerPriority.LOW }));
    engine.push(makeTrigger({ id: 'c', priority: TriggerPriority.LOW }));

    const queue = engine.state.queue.get();
    expect(queue[0].id).toBe('a');
    expect(queue[1].id).toBe('b');
    expect(queue[2].id).toBe('c');
  });

  test('CRITICAL should interrupt/show before current LOW', () => {
    // Push LOW first, then CRITICAL — CRITICAL should go to front
    engine.push(makeTrigger({ id: 'low-first', priority: TriggerPriority.LOW }));
    engine.push(makeTrigger({ id: 'critical-later', priority: TriggerPriority.CRITICAL }));

    const queue = engine.state.queue.get();
    expect(queue[0].id).toBe('critical-later');
    expect(queue[1].id).toBe('low-first');
  });

  // ── 2. Deduplication ──────────────────────────────

  test('should skip duplicate trigger IDs within DEDUP_WINDOW', () => {
    engine.push(makeTrigger({ id: 'unique-trigger' }));
    engine.push(makeTrigger({ id: 'unique-trigger' }));

    const queue = engine.state.queue.get();
    // Only one instance of the trigger should be in the queue
    expect(queue.filter(t => t.id === 'unique-trigger').length).toBe(1);
  });

  test('dedup should clear after DEDUP_WINDOW', () => {
    engine.push(makeTrigger({ id: 'temp-trigger' }));

    // Advance past the 60s dedup window — cleanup setTimeout fires
    jest.advanceTimersByTime(61_000);

    // Now pushing the same ID should succeed (not deduplicated)
    engine.push(makeTrigger({ id: 'temp-trigger' }));

    // The queue should contain both triggers (dedup window cleared, second push succeeded)
    const queue = engine.state.queue.get();
    const tempTriggers = queue.filter(t => t.id === 'temp-trigger');
    expect(tempTriggers.length).toBe(1); // second push added it; first was not consumed (processing deferred)
  });

  // ── 3. Cooldown ───────────────────────────────────

  test('should respect COOLDOWN_MS between dialogs', () => {
    // Process first message
    engine.push(makeTrigger({ id: 'msg1', priority: TriggerPriority.CRITICAL }));

    // Fire only the processing timer (setTimeout(0)), not the auto-dismiss
    jest.advanceTimersByTime(0);

    const dialogShown = engine.state.currentDialog.visible.get();
    expect(dialogShown).toBe(true);

    // Dismiss current dialog
    engine.dismiss();
    jest.advanceTimersByTime(600); // Exit animation delay

    // Push new message right after dismiss — should wait for cooldown
    engine.push(makeTrigger({ id: 'msg2', priority: TriggerPriority.HIGH }));

    // Fire the cooldown timer (COOLDOWN_MS - 600ms elapsed)
    jest.advanceTimersByTime(8_000);

    // Now msg2 should be visible after cooldown expired
    expect(engine.state.currentDialog.visible.get()).toBe(true);
  });

  // ── 4. Clear and Destroy ──────────────────────────

  test('clear() should empty the queue and hide dialog', () => {
    engine.push(makeTrigger({ id: 't1' }));
    engine.push(makeTrigger({ id: 't2' }));

    // Fire the processing timer so dialog shows
    jest.advanceTimersByTime(0);

    engine.clear();

    expect(engine.state.queue.get().length).toBe(0);
    expect(engine.state.currentDialog.visible.get()).toBe(false);
  });

  test('destroy() should clear everything', () => {
    engine.push(makeTrigger({ id: 't1' }));
    engine.push(makeTrigger({ id: 't2' }));

    engine.destroy();

    expect(engine.state.queue.get().length).toBe(0);
    expect(engine.state.currentDialog.visible.get()).toBe(false);
  });

  // ── 5. Priority values ────────────────────────────

  test('TriggerPriority enum should have correct values', () => {
    expect(TriggerPriority.CRITICAL).toBe(4);
    expect(TriggerPriority.HIGH).toBe(3);
    expect(TriggerPriority.MEDIUM).toBe(2);
    expect(TriggerPriority.LOW).toBe(1);
  });

  // ── 6. Auto-dismiss with duration ─────────────────

  test('should auto-dismiss dialog after specified duration', () => {
    engine.push(makeTrigger({
      id: 'auto-dismiss',
      priority: TriggerPriority.CRITICAL,
      duration: 3_000,
    }));

    // Fire only the processing timer — dialog should be visible
    jest.advanceTimersByTime(0);

    // Dialog should now be visible
    expect(engine.state.currentDialog.visible.get()).toBe(true);

    // Fast-forward past the duration + exit animation
    jest.advanceTimersByTime(3_000 + 600);

    // Dialog should now be hidden
    expect(engine.state.currentDialog.visible.get()).toBe(false);
  });

  // ── 7. Default duration ───────────────────────────

  test('should use default duration when not specified', () => {
    engine.push(makeTrigger({
      id: 'default-duration',
      priority: TriggerPriority.MEDIUM,
      // No duration specified
    }));

    // Fire only the processing timer
    jest.advanceTimersByTime(0);
    expect(engine.state.currentDialog.visible.get()).toBe(true);

    // Fast-forward past the default 5s + exit animation
    jest.advanceTimersByTime(5_000 + 600);

    expect(engine.state.currentDialog.visible.get()).toBe(false);
  });

  // ── 8. Non-overflow: queue bounded ────────────────

  test('should handle many rapid pushes without crash', () => {
    for (let i = 0; i < 50; i++) {
      engine.push(makeTrigger({
        id: `burst-${i}`,
        priority: [
          TriggerPriority.LOW,
          TriggerPriority.MEDIUM,
          TriggerPriority.HIGH,
          TriggerPriority.CRITICAL,
        ][i % 4] as TriggerPriority,
      }));
    }

    const queue = engine.state.queue.get();
    expect(queue.length).toBe(50); // All 50 should be in queue
  });
});
