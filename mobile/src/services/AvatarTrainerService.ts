/**
 * AvatarTrainerService — SPORT Mobile App V3.0
 * ==============================================
 * The "brain" of the Intelligent Avatar Trainer.
 * 
 * Monitors real-time session data (speed, HR, pace, battery, GPS) and
 * fires contextual coaching triggers through TriggerEngine.
 * 
 * Personality profiles:
 *   - DRILL_SERGEANT: Direct, demanding, military tone
 *   - MOTIVATOR: Encouraging, positive, celebratory
 *   - ANALYST: Data-driven, factual, performance-focused
 * 
 * State Machine: IDLE → OBSERVING → COACHING → CELEBRATING
 * 
 * Spring Parameters (V3.0 Standard):
 *   damping: 14, stiffness: 100
 */

import { observable } from '@legendapp/state';
import { triggerEngine, TriggerPriority } from './TriggerEngine';
import { MilestoneTracker } from './MilestoneTracker';

// ─── Types ───────────────────────────────────────────────────────

export type AvatarPersonality = 'DRILL_SERGEANT' | 'MOTIVATOR' | 'ANALYST';

export type AvatarState = 'IDLE' | 'OBSERVING' | 'COACHING' | 'CELEBRATING';

export interface SessionContext {
  distanceM: number;
  speedMs: number;
  paceSecPerKm: number;
  heartRate: number;
  batteryPct: number;
  elevationGainM: number;
  gpsAccuracyM: number;
  elapsedSec: number;
}

interface AvatarInternalState {
  personality: AvatarPersonality;
  state: AvatarState;
  sessionActive: boolean;
  lastPaceCheckMs: number;
  lastHRZone: string;
  peakSpeedMs: number;
  avgSpeedMs: number;
  speedSamples: number;
  personalBestDistanceM: number;
  lowBatteryAlerted: boolean;
  gpsLostAlerted: boolean;
  paceDropAlerted: boolean;
  firstActivityOfDay: boolean;
}

// ─── Message Templates ──────────────────────────────────────────

const MESSAGES: Record<AvatarPersonality, Record<string, string[]>> = {
  DRILL_SERGEANT: {
    SESSION_START: [
      "Mission initialized. No excuses. MOVE!",
      "Clock is ticking, soldier. Every second counts.",
      "GPS locked. Your performance is being monitored.",
    ],
    SESSION_END: [
      "Session terminated. Uploading combat data...",
      "Debrief complete. Rest, refuel, return stronger.",
    ],
    PACE_DROP: [
      "Pace dropping! You're losing momentum. Push through!",
      "Negative trend detected. Dig deeper or get left behind.",
    ],
    LOW_BATTERY: [
      "CRITICAL: Battery at {pct}%. Complete mission ASAP!",
      "Power reserves depleted. Wrap up NOW.",
    ],
    GPS_LOST: [
      "WARNING: GPS signal compromised. Data integrity at risk.",
      "Signal lost! Move to open terrain immediately.",
    ],
    HR_ZONE_UP: [
      "Heart rate elevated to Zone {zone}. Control your breathing!",
    ],
    HR_ZONE_DOWN: [
      "Heart rate dropping. You're losing intensity!",
    ],
    PERSONAL_BEST: [
      "NEW RECORD! You've exceeded your previous best. Outstanding!",
    ],
    FIRST_ACTIVITY: [
      "Day one engagement detected. Let's make it count.",
    ],
  },
  MOTIVATOR: {
    SESSION_START: [
      "Let's GO! 🔥 Today is YOUR day to shine!",
      "Engine online! Every step is a victory!",
      "Ready to make some magic? Let's roll!",
    ],
    SESSION_END: [
      "Amazing session! You should be SO proud right now! 🏆",
      "What a performance! Rewards incoming... rest well!",
    ],
    PACE_DROP: [
      "Hey, pace slipped a bit — but you've got MORE in the tank!",
      "Small dip — no big deal. Breathe and find your rhythm!",
    ],
    LOW_BATTERY: [
      "Heads up — battery at {pct}%. Let's finish strong!",
    ],
    GPS_LOST: [
      "GPS hiccup — keep going! Signal will bounce back.",
    ],
    HR_ZONE_UP: [
      "Feeling the burn? Zone {zone}! You're pushing limits!",
    ],
    HR_ZONE_DOWN: [
      "Heart settling down — perfect for recovery mode!",
    ],
    PERSONAL_BEST: [
      "🎉 NEW PERSONAL BEST! You are INCREDIBLE!",
    ],
    FIRST_ACTIVITY: [
      "First mission of the day! Let's make it legendary!",
    ],
  },
  ANALYST: {
    SESSION_START: [
      "Session telemetry initialized. Monitoring all vital parameters.",
      "Data collection active. Baseline metrics being established.",
    ],
    SESSION_END: [
      "Session data committed. Avg speed: {avgSpeed} km/h. Syncing to cloud.",
      "Analysis complete. Performance metrics available in profile.",
    ],
    PACE_DROP: [
      "Pace deviation: -{dropPct}% below session average. Recommend cadence correction.",
      "Negative pace trend detected over last 2 minutes. Adjusting coaching parameters.",
    ],
    LOW_BATTERY: [
      "System alert: Device battery at {pct}%. Estimated tracking time: {est} min.",
    ],
    GPS_LOST: [
      "GPS accuracy degraded to {acc}m. Switching to predictive positioning.",
    ],
    HR_ZONE_UP: [
      "Heart rate transitioned to Zone {zone} ({hr} BPM). VO2 correlation active.",
    ],
    HR_ZONE_DOWN: [
      "Heart rate returned to Zone {zone}. Recovery phase initiated.",
    ],
    PERSONAL_BEST: [
      "Performance record updated. New peak distance: {dist}km.",
    ],
    FIRST_ACTIVITY: [
      "First daily session detected. Establishing baseline parameters.",
    ],
  },
};

// ─── Helper: Pick random from array ─────────────────────────────

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getHRZone(hr: number): string {
  if (hr < 100) return '1';
  if (hr < 120) return '2';
  if (hr < 140) return '3';
  if (hr < 160) return '4';
  return '5';
}

// ─── Service ────────────────────────────────────────────────────

export class AvatarTrainerService {
  readonly state = observable<AvatarInternalState>({
    personality: 'MOTIVATOR',
    state: 'IDLE',
    sessionActive: false,
    lastPaceCheckMs: 0,
    lastHRZone: '1',
    peakSpeedMs: 0,
    avgSpeedMs: 0,
    speedSamples: 0,
    personalBestDistanceM: 0,
    lowBatteryAlerted: false,
    gpsLostAlerted: false,
    paceDropAlerted: false,
    firstActivityOfDay: true,
  });

  readonly milestones = new MilestoneTracker();

  private _checkInterval: ReturnType<typeof setInterval> | null = null;
  private _lastContext: SessionContext | null = null;

  // ─── Configuration ─────────────────────

  setPersonality(personality: AvatarPersonality): void {
    this.state.personality.set(personality);
  }

  setPersonalBest(distanceM: number): void {
    this.state.personalBestDistanceM.set(distanceM);
  }

  // ─── Session Lifecycle ─────────────────

  startSession(): void {
    this.state.sessionActive.set(true);
    this.state.state.set('OBSERVING');
    this.state.peakSpeedMs.set(0);
    this.state.avgSpeedMs.set(0);
    this.state.speedSamples.set(0);
    this.state.lowBatteryAlerted.set(false);
    this.state.gpsLostAlerted.set(false);
    this.state.paceDropAlerted.set(false);
    this.state.lastPaceCheckMs.set(Date.now());
    this.milestones.reset();

    const personality = this.state.personality.get();

    // First activity of day trigger
    if (this.state.firstActivityOfDay.get()) {
      this.state.firstActivityOfDay.set(false);
      triggerEngine.push({
        id: 'first-activity-day',
        message: pickRandom(MESSAGES[personality].FIRST_ACTIVITY),
        title: 'DAILY_BOOT',
        character: 'runner',
        priority: TriggerPriority.LOW,
        category: 'MOTIVATIONAL',
      });
    }

    // Session start trigger
    triggerEngine.push({
      id: 'session-start',
      message: pickRandom(MESSAGES[personality].SESSION_START),
      title: 'MISSION_START',
      character: 'runner',
      priority: TriggerPriority.LOW,
      category: 'LIFECYCLE',
    });
  }

  endSession(): void {
    const personality = this.state.personality.get();
    const avgSpeed = this.state.avgSpeedMs.get() * 3.6;

    let msg = pickRandom(MESSAGES[personality].SESSION_END);
    msg = msg.replace('{avgSpeed}', avgSpeed.toFixed(1));

    triggerEngine.push({
      id: 'session-end',
      message: msg,
      title: 'MISSION_COMPLETE',
      character: 'elite',
      priority: TriggerPriority.LOW,
      category: 'LIFECYCLE',
    });

    this.state.sessionActive.set(false);
    this.state.state.set('IDLE');

    if (this._checkInterval) {
      clearInterval(this._checkInterval);
      this._checkInterval = null;
    }
  }

  // ─── Real-time Update (call every 2s from GpsSyncManager callback) ────

  update(ctx: SessionContext): void {
    if (!this.state.sessionActive.get()) return;

    this._lastContext = ctx;
    const personality = this.state.personality.get();

    // ── Update running averages ──
    const samples = this.state.speedSamples.get() + 1;
    const prevAvg = this.state.avgSpeedMs.get();
    const newAvg = prevAvg + (ctx.speedMs - prevAvg) / samples;
    this.state.avgSpeedMs.set(newAvg);
    this.state.speedSamples.set(samples);

    if (ctx.speedMs > this.state.peakSpeedMs.get()) {
      this.state.peakSpeedMs.set(ctx.speedMs);
    }

    // ── Milestone check ──
    this.milestones.update(ctx.distanceM);

    // ── Low Battery (<20%) ──
    if (ctx.batteryPct < 0.2 && !this.state.lowBatteryAlerted.get()) {
      this.state.lowBatteryAlerted.set(true);
      let msg = pickRandom(MESSAGES[personality].LOW_BATTERY);
      msg = msg.replace('{pct}', `${Math.round(ctx.batteryPct * 100)}`);
      msg = msg.replace('{est}', `${Math.round(ctx.batteryPct * 60)}`);

      triggerEngine.push({
        id: 'low-battery',
        message: msg,
        title: 'POWER_CRITICAL',
        character: 'ghost',
        priority: TriggerPriority.CRITICAL,
        category: 'SYSTEM',
      });
    }

    // ── GPS Lost (accuracy > 50m) ──
    if (ctx.gpsAccuracyM > 50 && !this.state.gpsLostAlerted.get()) {
      this.state.gpsLostAlerted.set(true);
      let msg = pickRandom(MESSAGES[personality].GPS_LOST);
      msg = msg.replace('{acc}', ctx.gpsAccuracyM.toFixed(0));

      triggerEngine.push({
        id: 'gps-lost',
        message: msg,
        title: 'SIGNAL_LOST',
        character: 'ghost',
        priority: TriggerPriority.CRITICAL,
        category: 'SYSTEM',
      });
    } else if (ctx.gpsAccuracyM <= 20) {
      // Reset GPS alert when signal recovers
      this.state.gpsLostAlerted.set(false);
    }

    // ── Pace Drop (>20% below session average, check every 30s) ──
    const now = Date.now();
    if (now - this.state.lastPaceCheckMs.get() > 30_000 && samples > 5) {
      this.state.lastPaceCheckMs.set(now);

      if (ctx.speedMs > 0.5 && newAvg > 0.5) {
        const dropPct = ((newAvg - ctx.speedMs) / newAvg) * 100;
        if (dropPct > 20 && !this.state.paceDropAlerted.get()) {
          this.state.paceDropAlerted.set(true);
          this.state.state.set('COACHING');

          let msg = pickRandom(MESSAGES[personality].PACE_DROP);
          msg = msg.replace('{dropPct}', dropPct.toFixed(0));

          triggerEngine.push({
            id: 'pace-drop',
            message: msg,
            title: 'PACE_ALERT',
            character: 'elite',
            priority: TriggerPriority.MEDIUM,
            category: 'COACHING',
          });

          // Reset pace alert after 2 minutes
          setTimeout(() => this.state.paceDropAlerted.set(false), 120_000);
        }
      }
    }

    // ── Heart Rate Zone Change ──
    const currentZone = getHRZone(ctx.heartRate);
    const lastZone = this.state.lastHRZone.get();
    if (currentZone !== lastZone && samples > 3) {
      this.state.lastHRZone.set(currentZone);
      const goingUp = parseInt(currentZone) > parseInt(lastZone);

      const template = goingUp ? MESSAGES[personality].HR_ZONE_UP : MESSAGES[personality].HR_ZONE_DOWN;
      let msg = pickRandom(template);
      msg = msg.replace('{zone}', currentZone);
      msg = msg.replace('{hr}', ctx.heartRate.toString());

      triggerEngine.push({
        id: `hr-zone-${currentZone}`,
        message: msg,
        title: goingUp ? 'HR_ESCALATION' : 'HR_RECOVERY',
        character: goingUp ? 'elite' : 'runner',
        priority: TriggerPriority.MEDIUM,
        category: 'COACHING',
      });
    }

    // ── Personal Best ──
    const pb = this.state.personalBestDistanceM.get();
    if (pb > 0 && ctx.distanceM > pb) {
      this.state.personalBestDistanceM.set(ctx.distanceM);
      this.state.state.set('CELEBRATING');

      let msg = pickRandom(MESSAGES[personality].PERSONAL_BEST);
      msg = msg.replace('{dist}', (ctx.distanceM / 1000).toFixed(2));

      triggerEngine.push({
        id: 'personal-best',
        message: msg,
        title: 'RECORD_BROKEN',
        character: 'elite',
        priority: TriggerPriority.HIGH,
        category: 'CELEBRATION',
        duration: 7_000,
      });
    }
  }

  // ─── Cleanup ───────────────────────────

  destroy(): void {
    if (this._checkInterval) clearInterval(this._checkInterval);
    triggerEngine.destroy();
  }
}

// Singleton
export const avatarTrainer = new AvatarTrainerService();
