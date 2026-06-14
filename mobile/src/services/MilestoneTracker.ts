/**
 * MilestoneTracker — SPORT Mobile App V3.0
 * =========================================
 * Tracks distance milestones and fires triggers via TriggerEngine.
 * Separate from the main tracking logic for clean separation of concerns.
 * 
 * Milestones: 1km, 5km, 10km, 21.1km (Half Marathon), 42.2km (Marathon)
 */

import { triggerEngine, TriggerPriority } from './TriggerEngine';

interface MilestoneConfig {
  distanceM: number;
  title: string;
  character: 'runner' | 'cyclist' | 'ghost' | 'elite';
  message: string;
}

const MILESTONES: MilestoneConfig[] = [
  {
    distanceM: 1_000,
    title: 'MILESTONE_1K',
    character: 'runner',
    message: "1KM completed! You're warming up. Keep the rhythm steady.",
  },
  {
    distanceM: 5_000,
    title: 'MILESTONE_5K',
    character: 'elite',
    message: "5KM! Outstanding stamina! You're entering the performance zone.",
  },
  {
    distanceM: 10_000,
    title: 'MILESTONE_10K',
    character: 'elite',
    message: "10KM! Elite territory! Very few reach this level. You're a machine.",
  },
  {
    distanceM: 21_100,
    title: 'HALF_MARATHON',
    character: 'elite',
    message: "HALF MARATHON! 21.1KM! You just crushed what most people never attempt!",
  },
  {
    distanceM: 42_195,
    title: 'MARATHON',
    character: 'elite',
    message: "MARATHON COMPLETE! 42.195KM! LEGENDARY! You are beyond limits!",
  },
];

export class MilestoneTracker {
  private _reached: Set<number> = new Set();

  /**
   * Call on every distance update. Fires milestone triggers as crossed.
   */
  update(currentDistanceM: number): void {
    for (const milestone of MILESTONES) {
      if (currentDistanceM >= milestone.distanceM && !this._reached.has(milestone.distanceM)) {
        this._reached.add(milestone.distanceM);

        triggerEngine.push({
          id: `milestone-${milestone.distanceM}`,
          message: milestone.message,
          title: milestone.title,
          character: milestone.character,
          priority: TriggerPriority.HIGH,
          category: 'MILESTONE',
          duration: 6_000,
        });
      }
    }
  }

  /**
   * Reset all milestones (call at session start).
   */
  reset(): void {
    this._reached.clear();
  }

  /**
   * Check if a specific milestone distance has been reached.
   */
  hasReached(distanceM: number): boolean {
    return this._reached.has(distanceM);
  }

  /**
   * Get next upcoming milestone distance in meters, or null if all reached.
   */
  getNextMilestone(currentDistanceM: number): number | null {
    for (const milestone of MILESTONES) {
      if (currentDistanceM < milestone.distanceM) {
        return milestone.distanceM;
      }
    }
    return null;
  }

  /**
   * Get progress to next milestone as 0-1 fraction.
   */
  getProgressToNext(currentDistanceM: number): number {
    const next = this.getNextMilestone(currentDistanceM);
    if (!next) return 1;

    // Find previous milestone
    const prevMilestones = MILESTONES.filter(m => m.distanceM <= currentDistanceM);
    const prevDistance = prevMilestones.length > 0 
      ? (prevMilestones[prevMilestones.length - 1]?.distanceM ?? 0)
      : 0;

    return (currentDistanceM - prevDistance) / (next - prevDistance);
  }
}
