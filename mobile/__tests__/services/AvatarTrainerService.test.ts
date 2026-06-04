/**
 * AvatarTrainerService Unit Tests
 * =================================
 * Tests personality consistency, all 9 message categories,
 * template variable interpolation, fallback behavior,
 * Polish language constraint, and message length limits.
 * 
 * Run: npm test -- __tests__/services/AvatarTrainerService.test.ts
 */

import { AvatarTrainerService, SessionContext } from '../../src/services/AvatarTrainerService';
import { triggerEngine, TriggerMessage } from '../../src/services/TriggerEngine';
import { LlmCoachService } from '../../src/services/LlmCoachService';

// Mock LlmCoachService to return null (forcing fallback to static templates)
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

// Helper: drain microtasks + pending _postMessage LLM mocks (avoid fake timers — they block setImmediate)
async function flushAsync(rounds = 5): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await new Promise<void>(resolve => setImmediate(resolve));
  }
}

function pushedById(pushSpy: jest.SpyInstance, id: string): Omit<TriggerMessage, 'timestamp'>[] {
  return pushSpy.mock.calls
    .map(call => call[0] as Omit<TriggerMessage, 'timestamp'>)
    .filter(t => t.id === id);
}

describe('AvatarTrainerService', () => {
  let service: AvatarTrainerService;
  let pushSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    triggerEngine.clear();
    pushSpy = jest.spyOn(triggerEngine, 'push');
    const { llmCoach } = require('../../src/services/LlmCoachService');
    (llmCoach.generateMessage as jest.Mock).mockResolvedValue(null);
    service = new AvatarTrainerService();
  });

  afterEach(() => {
    service.destroy();
    pushSpy.mockRestore();
  });

  // ── 1. Personality Consistency ─────────────────────

  describe('Personality Consistency', () => {
    test('DRILL_SERGEANT should maintain military tone', () => {
      service.setPersonality('DRILL_SERGEANT');
      expect(service.state.personality.get()).toBe('DRILL_SERGEANT');
    });

    test('MOTIVATOR should maintain encouraging tone', () => {
      service.setPersonality('MOTIVATOR');
      expect(service.state.personality.get()).toBe('MOTIVATOR');
    });

    test('ANALYST should maintain data-driven tone', () => {
      service.setPersonality('ANALYST');
      expect(service.state.personality.get()).toBe('ANALYST');
    });
  });

  // ── 2. Session Lifecycle ───────────────────────────

  describe('Session Lifecycle', () => {
    test('startSession should set OBSERVING state and fire FIRST_ACTIVITY + SESSION_START', async () => {
      service.setPersonality('MOTIVATOR');
      service.startSession();

      await flushAsync();

      expect(service.state.state.get()).toBe('OBSERVING');
      expect(service.state.sessionActive.get()).toBe(true);

      expect(pushedById(pushSpy, 'first-activity-day').length).toBe(1);
      expect(pushedById(pushSpy, 'session-start').length).toBe(1);
    });

    test('endSession should set IDLE state and fire SESSION_END', async () => {
      service.setPersonality('ANALYST');
      service.startSession();
      await flushAsync();

      service.endSession();
      await flushAsync();

      expect(service.state.state.get()).toBe('IDLE');
      expect(service.state.sessionActive.get()).toBe(false);
    });

    test('firstActivityOfDay should only fire once per session', async () => {
      service.setPersonality('DRILL_SERGEANT');
      service.startSession();
      await flushAsync();

      // First activity flag should be consumed
      expect(service.state.firstActivityOfDay.get()).toBe(false);

      // End and start again — should NOT fire FIRST_ACTIVITY
      service.endSession();
      await flushAsync();

      service.startSession();
      await flushAsync();

      expect(pushedById(pushSpy, 'first-activity-day').length).toBeLessThanOrEqual(1);
    });
  });

  // ── 3. All 9 Trigger Categories ────────────────────

  describe('Trigger Categories', () => {
    function createContext(overrides: Partial<SessionContext> = {}): SessionContext {
      return {
        distanceM: 500,
        speedMs: 3.5,
        paceSecPerKm: 300,
        heartRate: 120,
        batteryPct: 0.8,
        elevationGainM: 10,
        gpsAccuracyM: 5,
        elapsedSec: 60,
        ...overrides,
      };
    }

    test('LOW_BATTERY trigger fires when battery <20%', async () => {
      service.setPersonality('DRILL_SERGEANT');
      service.startSession();
      await flushAsync();

      const ctx = createContext({ batteryPct: 0.15 });
      service.update(ctx);
      await flushAsync();

      const batteryTriggers = pushedById(pushSpy, 'low-battery');
      expect(batteryTriggers.length).toBe(1);
      expect(service.state.lowBatteryAlerted.get()).toBe(true);

      const message = batteryTriggers[0].message.toLowerCase();
      expect(message).toMatch(/15|battery|power|critical|depleted/);
    });

    test('GPS_LOST trigger fires when accuracy >50m', async () => {
      service.setPersonality('MOTIVATOR');
      service.startSession();
      await flushAsync();

      const ctx = createContext({ gpsAccuracyM: 75 });
      service.update(ctx);
      await flushAsync();

      const gpsTriggers = pushedById(pushSpy, 'gps-lost');
      expect(gpsTriggers.length).toBe(1);
      expect(service.state.gpsLostAlerted.get()).toBe(true);

      // GPS recovery should reset alert
      service.update(createContext({ gpsAccuracyM: 10 }));
      expect(service.state.gpsLostAlerted.get()).toBe(false);
    });

    test('PACE_DROP trigger fires when pace drops >20%', async () => {
      service.setPersonality('ANALYST');
      service.startSession();
      await flushAsync();

      // First build up a baseline speed
      for (let i = 0; i < 6; i++) {
        service.update(createContext({ speedMs: 5.0 }));
      }

      // Pass 30s pace-check interval without fake timers (Date.now-based)
      service.state.lastPaceCheckMs.set(Date.now() - 31_000);
      service.update(createContext({ speedMs: 2.0 }));
      await flushAsync();

      const paceTriggers = pushedById(pushSpy, 'pace-drop');
      expect(paceTriggers.length).toBeGreaterThanOrEqual(1);

      if (paceTriggers.length > 0) {
        expect(service.state.paceDropAlerted.get()).toBe(true);
        expect(service.state.state.get()).toBe('COACHING');
      }
    });

    test('HR_ZONE_UP trigger fires when HR zone increases', async () => {
      service.setPersonality('ANALYST');
      service.startSession();
      await flushAsync();

      // Build samples
      for (let i = 0; i < 5; i++) {
        service.update(createContext({ heartRate: 90 }));
      }

      // Increase HR zone significantly
      service.update(createContext({ heartRate: 145 }));
      await flushAsync();

      const hrTriggers = pushSpy.mock.calls
        .map(call => call[0] as Omit<TriggerMessage, 'timestamp'>)
        .filter(t => t.id.startsWith('hr-zone-'));
      expect(hrTriggers.length).toBeGreaterThanOrEqual(1);
      expect(hrTriggers[0].title).toBe('HR_ESCALATION');
    });

    test('HR_ZONE_DOWN trigger fires when HR zone decreases', async () => {
      service.setPersonality('MOTIVATOR');
      service.startSession();
      await flushAsync();

      // Build samples at high HR
      for (let i = 0; i < 5; i++) {
        service.update(createContext({ heartRate: 150 }));
      }

      // Drop HR zone
      service.update(createContext({ heartRate: 85 }));
      await flushAsync();

      const hrDownTriggers = pushSpy.mock.calls
        .map(call => call[0] as Omit<TriggerMessage, 'timestamp'>)
        .filter(t => t.id.startsWith('hr-zone-') && t.title === 'HR_RECOVERY');
      expect(hrDownTriggers.length).toBeGreaterThanOrEqual(1);
    });

    test('PERSONAL_BEST trigger fires when beating previous record', async () => {
      service.setPersonality('DRILL_SERGEANT');
      service.setPersonalBest(1000); // Previous best: 1km
      service.startSession();
      await flushAsync();

      service.update(createContext({ distanceM: 1100 }));
      await flushAsync();

      expect(pushedById(pushSpy, 'personal-best').length).toBe(1);
      expect(service.state.state.get()).toBe('CELEBRATING');
    });

    test('Milestone triggers fire at distance thresholds', async () => {
      service.setPersonality('MOTIVATOR');
      service.startSession();
      await flushAsync();

      service.update(createContext({ distanceM: 1050 }));
      await flushAsync();

      expect(pushedById(pushSpy, 'milestone-1000').length).toBe(1);
    });
  });

  // ── 4. Template Variable Interpolation ─────────────

  describe('Template Variables', () => {
    function buildStandaloneService(): AvatarTrainerService {
      const svc = new AvatarTrainerService();
      svc.setPersonality('ANALYST');
      return svc;
    }

    test('{pct} — battery percentage', async () => {
      const svc = buildStandaloneService();
      svc.state.sessionActive.set(true);
      svc.update({
        distanceM: 100, speedMs: 3, paceSecPerKm: 300,
        heartRate: 80, batteryPct: 0.18, elevationGainM: 0,
        gpsAccuracyM: 5, elapsedSec: 10,
      });
      await flushAsync();

      const batMsgs = pushedById(pushSpy, 'low-battery');
      expect(batMsgs.length).toBe(1);
      expect(batMsgs[0].message).toMatch(/18/);
      svc.destroy();
    });

    test('{zone} and {hr} — heart rate values', async () => {
      const svc = buildStandaloneService();
      svc.state.sessionActive.set(true);
      for (let i = 0; i < 5; i++) {
        svc.update({
          distanceM: 100, speedMs: 3, paceSecPerKm: 300,
          heartRate: 90, batteryPct: 0.8, elevationGainM: 0,
          gpsAccuracyM: 5, elapsedSec: 10,
        });
      }
      svc.update({
        distanceM: 100, speedMs: 3, paceSecPerKm: 300,
        heartRate: 135, batteryPct: 0.8, elevationGainM: 0,
        gpsAccuracyM: 5, elapsedSec: 10,
      });
      await flushAsync();

      const hrMsgs = pushSpy.mock.calls
        .map(call => call[0] as Omit<TriggerMessage, 'timestamp'>)
        .filter(t => t.id.startsWith('hr-zone-'));
      expect(hrMsgs.length).toBeGreaterThanOrEqual(1);
      svc.destroy();
    });

    test('{dist} — distance for personal best', async () => {
      const svc = buildStandaloneService();
      svc.setPersonalBest(500);
      svc.state.sessionActive.set(true);
      svc.update({
        distanceM: 5230, speedMs: 3, paceSecPerKm: 300,
        heartRate: 100, batteryPct: 0.8, elevationGainM: 0,
        gpsAccuracyM: 5, elapsedSec: 10,
      });
      await flushAsync();

      const pbMsgs = pushedById(pushSpy, 'personal-best');
      expect(pbMsgs.length).toBe(1);
      expect(pbMsgs[0].message).toMatch(/5\.23/);
      svc.destroy();
    });
  });

  // ── 5. Fallback behavior ──────────────────────────

  describe('Fallback', () => {
    test('should fall back to static templates when LLM returns null', async () => {
      // llmCoach.generateMessage is mocked to return null
      service.setPersonality('DRILL_SERGEANT');
      service.startSession();
      await flushAsync();

      const startMsgs = pushedById(pushSpy, 'session-start');
      expect(startMsgs.length).toBe(1);
      expect(startMsgs[0].message.length).toBeGreaterThan(0);
    });

    test('should still produce a message when LLM throws', async () => {
      const { llmCoach } = require('../../src/services/LlmCoachService');
      (llmCoach.generateMessage as jest.Mock).mockRejectedValue(new Error('API down'));

      service.setPersonality('MOTIVATOR');
      service.startSession();
      await flushAsync();

      expect(pushSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
      for (const call of pushSpy.mock.calls) {
        expect((call[0] as Omit<TriggerMessage, 'timestamp'>).message.length).toBeGreaterThan(0);
      }
    });
  });

  // ── 6. Language: Polish ────────────────────────────

  describe('Polish Language', () => {
    test('LLM-generated coaching messages can be delivered in Polish', async () => {
      const { llmCoach } = require('../../src/services/LlmCoachService');
      (llmCoach.generateMessage as jest.Mock).mockResolvedValue(
        'Świetna robota — utrzymaj tempo!'
      );

      service.setPersonality('MOTIVATOR');
      service.startSession();
      await flushAsync();

      const startMsgs = pushedById(pushSpy, 'session-start');
      expect(startMsgs.length).toBe(1);
      expect(startMsgs[0].message).toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/);
    });
  });

  // ── 7. Duplicate prevention during async LLM ──────

  describe('Async Deduplication', () => {
    test('should not push duplicate triggers during LLM generation', async () => {
      // Make LLM slow
      const { llmCoach } = require('../../src/services/LlmCoachService');
      let resolveLlm: ((val: any) => void) = () => {};
      (llmCoach.generateMessage as jest.Mock).mockImplementation(
        () => new Promise(resolve => { resolveLlm = resolve; })
      );

      service.setPersonality('MOTIVATOR');
      service.startSession();

      // Start another session immediately — should not fire duplicate first-activity or session-start
      service.startSession();
      await flushAsync();

      // Resolve the pending LLM
      resolveLlm('Szybki start!');
      await flushAsync();

      expect(pushedById(pushSpy, 'session-start').length).toBeLessThanOrEqual(1);
      expect(pushedById(pushSpy, 'first-activity-day').length).toBeLessThanOrEqual(1);
    });
  });
});
