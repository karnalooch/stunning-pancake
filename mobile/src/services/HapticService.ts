/**
 * HapticService — Centralized haptic feedback engine powered by expo-haptics.
 *
 * Provides a catalog of named haptic patterns mapped to specific UI interactions,
 * giving consistent tactile feedback across the entire app. All patterns use
 * expo-haptics' impact and notification feedback styles.
 *
 * Pattern Catalog:
 *   - tab_switch          — light (tab navigation)
 *   - button_press        — light + 50ms delay (general button press)
 *   - achievement_unlock  — heavy + 100ms + heavy (double pulse)
 *   - level_up            — triple ascending: light, medium, heavy
 *   - card_flip           — light (GameCard interactions)
 *   - error               — sharp double: heavy + 80ms + heavy
 *   - coin_collect        — rapid triple light
 *   - scanline_glitch     — irregular rapid light pulses (CRT effect)
 *
 * Usage:
 *   import { HapticService, HapticPattern } from '../services/HapticService';
 *   HapticService.trigger('button_press');
 *   HapticService.trigger('achievement_unlock');
 */

import * as Haptics from 'expo-haptics';

// ─── Types ──────────────────────────────────────────────────────────

/** All recognized haptic feedback patterns */
export type HapticPattern =
    | 'tab_switch'
    | 'button_press'
    | 'achievement_unlock'
    | 'level_up'
    | 'card_flip'
    | 'error'
    | 'coin_collect'
    | 'scanline_glitch';

/** A single haptic event within a pattern sequence */
interface HapticEvent {
    type: 'impact' | 'notification';
    /** Impact style (only for 'impact' type) */
    style?: Haptics.ImpactFeedbackStyle;
    /** Notification type (only for 'notification' type) */
    notificationType?: Haptics.NotificationFeedbackType;
    /** Delay in ms before this event fires (from start of pattern) */
    delayMs: number;
}

// ─── Pattern Definitions ────────────────────────────────────────────

/**
 * Each pattern is a sequence of haptic events with precise timing.
 * Patterns execute asynchronously and silently catch errors.
 */
const PATTERNS: Record<HapticPattern, HapticEvent[]> = {
    /** Tab navigation — quick light tap */
    tab_switch: [
        { type: 'impact', style: Haptics.ImpactFeedbackStyle.Light, delayMs: 0 },
    ],

    /** Button press — light press-in + medium press-out feel */
    button_press: [
        { type: 'impact', style: Haptics.ImpactFeedbackStyle.Light, delayMs: 0 },
        { type: 'impact', style: Haptics.ImpactFeedbackStyle.Medium, delayMs: 50 },
    ],

    /** Achievement unlock — celebratory double heavy pulse */
    achievement_unlock: [
        { type: 'impact', style: Haptics.ImpactFeedbackStyle.Heavy, delayMs: 0 },
        { type: 'impact', style: Haptics.ImpactFeedbackStyle.Heavy, delayMs: 100 },
    ],

    /** Level up — triple ascending intensity burst */
    level_up: [
        { type: 'impact', style: Haptics.ImpactFeedbackStyle.Light, delayMs: 0 },
        { type: 'impact', style: Haptics.ImpactFeedbackStyle.Medium, delayMs: 80 },
        { type: 'impact', style: Haptics.ImpactFeedbackStyle.Heavy, delayMs: 160 },
    ],

    /** Card flip — subtle light tap for card interactions */
    card_flip: [
        { type: 'impact', style: Haptics.ImpactFeedbackStyle.Light, delayMs: 0 },
    ],

    /** Error — sharp double heavy for alert/error states */
    error: [
        { type: 'impact', style: Haptics.ImpactFeedbackStyle.Heavy, delayMs: 0 },
        { type: 'impact', style: Haptics.ImpactFeedbackStyle.Heavy, delayMs: 80 },
    ],

    /** Coin collect — rapid triple light for coin pickups */
    coin_collect: [
        { type: 'impact', style: Haptics.ImpactFeedbackStyle.Light, delayMs: 0 },
        { type: 'impact', style: Haptics.ImpactFeedbackStyle.Light, delayMs: 60 },
        { type: 'impact', style: Haptics.ImpactFeedbackStyle.Light, delayMs: 120 },
    ],

    /** Scanline glitch — irregular rapid light pulses mimicking CRT interference */
    scanline_glitch: [
        { type: 'impact', style: Haptics.ImpactFeedbackStyle.Light, delayMs: 0 },
        { type: 'impact', style: Haptics.ImpactFeedbackStyle.Light, delayMs: 40 },
        { type: 'impact', style: Haptics.ImpactFeedbackStyle.Light, delayMs: 90 },
        { type: 'impact', style: Haptics.ImpactFeedbackStyle.Light, delayMs: 130 },
        { type: 'impact', style: Haptics.ImpactFeedbackStyle.Light, delayMs: 200 },
    ],
};

// ─── Haptic Service Implementation ──────────────────────────────────

class HapticServiceImpl {
    /**
     * Trigger a named haptic pattern.
     * Silently catches errors (e.g., device doesn't support haptics).
     *
     * @param pattern - The haptic pattern to trigger
     */
    trigger(pattern: HapticPattern): void {
        const events = PATTERNS[pattern];
        if (!events) {
            console.warn(`[HapticService] Unknown pattern: "${pattern}"`);
            return;
        }

        for (const event of events) {
            const execute = () => {
                try {
                    if (event.type === 'impact' && event.style !== undefined) {
                        Haptics.impactAsync(event.style).catch(() => { });
                    } else if (event.type === 'notification' && event.notificationType !== undefined) {
                        Haptics.notificationAsync(event.notificationType).catch(() => { });
                    }
                } catch {
                    // Silently ignore — device may not support haptics
                }
            };

            if (event.delayMs > 0) {
                setTimeout(execute, event.delayMs);
            } else {
                execute();
            }
        }
    }

    /**
     * Convenience: trigger a single light impact immediately.
     * Used for quick, ad-hoc haptic feedback where a named pattern
     * isn't needed.
     */
    light(): void {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    }

    /**
     * Convenience: trigger a single medium impact immediately.
     */
    medium(): void {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    }

    /**
     * Convenience: trigger a single heavy impact immediately.
     */
    heavy(): void {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => { });
    }

    /**
     * Convenience: trigger a notification feedback (success).
     */
    success(): void {
        Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
        ).catch(() => { });
    }

    /**
     * Convenience: trigger a notification feedback (warning).
     */
    warning(): void {
        Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning,
        ).catch(() => { });
    }

    /**
     * Convenience: trigger a notification feedback (error).
     */
    errorNotify(): void {
        Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Error,
        ).catch(() => { });
    }
}

/** Singleton instance — import and use directly */
export const HapticService = new HapticServiceImpl();
