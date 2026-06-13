/**
 * ADR 014 §10 — engagement events for retention telemetry.
 */

import { setAnalyticsEvent } from './FirebaseService';

export type EngagementEvent =
  | 'quest_complete'
  | 'ride_summary_share'
  | 'streak_day'
  | 'level_up'
  | 'layout_edit'
  | 'ride_complete'
  | 'immersive_toggle';

export function trackEngagement(
  event: EngagementEvent,
  params?: Record<string, string | number | boolean>,
): void {
  setAnalyticsEvent(`engagement_${event}`, params);
}
