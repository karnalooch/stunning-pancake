/**
 * TriggerEngine — SPORT Mobile App V3.0
 * ======================================
 * Centralized priority queue for Character Cut-in dialog messages.
 * Extracted from inline TrackingScreen logic into a reusable service.
 * 
 * Features:
 * - Priority-based queue (CRITICAL > HIGH > MEDIUM > LOW)
 * - Cooldown system (min 8s between dialogs)
 * - Deduplication (no repeating the same trigger within 60s)
 * - Observable state for zero-proxy Legend-State reactivity
 */

import { observable } from '@legendapp/state';

export enum TriggerPriority {
  CRITICAL = 4,   // Ghost alerts, GPS lost, low battery
  HIGH = 3,       // Milestones, personal bests
  MEDIUM = 2,     // Coaching (pace drop, HR zone)
  LOW = 1,        // Motivational, lifecycle
}

export type TriggerCategory =
  | 'MILESTONE'
  | 'SYSTEM'
  | 'SECURITY'
  | 'CELEBRATION'
  | 'COACHING'
  | 'MOTIVATIONAL'
  | 'LIFECYCLE';

export interface TriggerMessage {
  id: string;
  message: string;
  title: string;
  character: 'runner' | 'cyclist' | 'ghost' | 'elite';
  priority: TriggerPriority;
  category: TriggerCategory;
  timestamp: number;
  /** Duration in ms before auto-dismiss. Default: 5000 */
  duration?: number;
}

interface TriggerEngineState {
  queue: TriggerMessage[];
  currentDialog: {
    visible: boolean;
    message: string;
    title: string;
    character: string;
  };
  isProcessing: boolean;
  lastDismissTime: number;
  recentTriggerIds: string[];
}

const COOLDOWN_MS = 8_000;           // Min 8s between dialogs
const DEDUP_WINDOW_MS = 60_000;      // Same trigger ID blocked for 60s
const EXIT_ANIMATION_DELAY_MS = 600; // Wait for spring exit animation
const DEFAULT_DURATION_MS = 5_000;

export class TriggerEngine {
  readonly state = observable<TriggerEngineState>({
    queue: [],
    currentDialog: {
      visible: false,
      message: '',
      title: 'SYSTEM_MSG',
      character: 'runner',
    },
    isProcessing: false,
    lastDismissTime: 0,
    recentTriggerIds: [],
  });

  private _dismissTimer: ReturnType<typeof setTimeout> | null = null;
  private _processTimer: ReturnType<typeof setTimeout> | null = null;
  private _dedupTimers = new Set<ReturnType<typeof setTimeout>>();

  /**
   * Push a new trigger into the priority queue.
   * Automatically deduplicates and starts processing.
   */
  push(trigger: Omit<TriggerMessage, 'timestamp'>): void {
    const now = Date.now();

    // Deduplication check
    const recentIds = this.state.recentTriggerIds.get();
    if (recentIds.includes(trigger.id)) {
      console.log(`[TriggerEngine] Dedup: skipping "${trigger.id}"`);
      return;
    }

    const fullTrigger: TriggerMessage = {
      ...trigger,
      timestamp: now,
    };

    // Insert into queue sorted by priority (highest first)
    const queue = [...this.state.queue.get()];
    const insertIdx = queue.findIndex(t => t.priority < fullTrigger.priority);
    if (insertIdx === -1) {
      queue.push(fullTrigger);
    } else {
      queue.splice(insertIdx, 0, fullTrigger);
    }
    this.state.queue.set(queue);

    // Track for dedup
    this.state.recentTriggerIds.set([...recentIds, trigger.id]);
    const dedupTimer = setTimeout(() => {
      this.state.recentTriggerIds.set(
        this.state.recentTriggerIds.get().filter(id => id !== trigger.id)
      );
      this._dedupTimers.delete(dedupTimer);
    }, DEDUP_WINDOW_MS);
    this._dedupTimers.add(dedupTimer);

    // Start processing if idle
    if (!this.state.isProcessing.get() && !this.state.currentDialog.visible.get()) {
      this._scheduleNext();
    }
  }

  /**
   * Immediately dismiss current dialog and process next.
   */
  dismiss(): void {
    if (this._dismissTimer) clearTimeout(this._dismissTimer);
    this.state.currentDialog.visible.set(false);
    this.state.lastDismissTime.set(Date.now());

    if (this._processTimer) clearTimeout(this._processTimer);
    this._processTimer = setTimeout(() => {
      this._processTimer = null;
      this._processNext();
    }, EXIT_ANIMATION_DELAY_MS);
  }

  /**
   * Clear entire queue and dismiss current dialog.
   * Also resets dedup window and cooldown state for clean test isolation.
   */
  clear(): void {
    if (this._dismissTimer) clearTimeout(this._dismissTimer);
    if (this._processTimer) clearTimeout(this._processTimer);
    this._dismissTimer = null;
    this._processTimer = null;
    for (const timer of this._dedupTimers) {
      clearTimeout(timer);
    }
    this._dedupTimers.clear();
    this.state.queue.set([]);
    this.state.currentDialog.visible.set(false);
    this.state.isProcessing.set(false);
    this.state.recentTriggerIds.set([]);
    this.state.lastDismissTime.set(0);
  }

  /**
   * Destroy all timers. Call on unmount.
   */
  destroy(): void {
    this.clear();
  }

  private _scheduleNext(): void {
    if (this._processTimer) return;
    const now = Date.now();
    const lastDismiss = this.state.lastDismissTime.get();
    const elapsed = now - lastDismiss;

    if (elapsed < COOLDOWN_MS && lastDismiss > 0) {
      // Respect cooldown
      const wait = COOLDOWN_MS - elapsed;
      this._processTimer = setTimeout(() => {
        this._processTimer = null;
        this._processNext();
      }, wait);
    } else {
      // Defer to next tick so push() doesn't synchronously consume queue items
      this._processTimer = setTimeout(() => {
        this._processTimer = null;
        this._processNext();
      }, 0);
    }
  }

  private _processNext(): void {
    const queue = this.state.queue.get();
    if (queue.length === 0) {
      this.state.isProcessing.set(false);
      return;
    }

    this.state.isProcessing.set(true);

    // Take highest priority item (first in sorted queue)
    const next = queue[0];
    if (!next) {
      this.state.isProcessing.set(false);
      return;
    }
    this.state.queue.set(queue.slice(1));

    // Show dialog
    this.state.currentDialog.set({
      visible: true,
      message: next.message,
      title: next.title,
      character: next.character,
    });

    // Schedule auto-dismiss
    const duration = next.duration ?? DEFAULT_DURATION_MS;
    this._dismissTimer = setTimeout(() => {
      this.dismiss();
    }, duration);
  }
}

// Singleton instance for the app
export const triggerEngine = new TriggerEngine();
