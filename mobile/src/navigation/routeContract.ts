import type { RootStackParamList } from './types';

/**
 * UX v2 route contract for primary tabs, stack destinations and deep-link helpers.
 * Public path strings intentionally preserve the pre-v2 URLs for backward compatibility.
 */
export const ROUTE_PATHS = {
  today: 'ride',
  discover: 'explore',
  startRide: 'ride/start',
  club: 'compete',
  you: 'profile',
  tracking: 'ride/live',
  settings: 'settings',
  trainingLog: 'profile/training-log',
  gpsDiagnostics: 'ride/gps-diagnostics',
  clubs: 'compete/clubs',
  segments: 'compete/segments',
  exploreMap: 'explore/map',
  marketplace: 'explore/marketplace',
  activityDetail: 'profile/activity/:activityId',
  performanceTrends: 'profile/trends',
  globalLeaderboard: 'compete/global-leaderboard',
  ridePaused: 'ride/paused',
  visionGallery: 'vision-gallery',
} as const;

export function buildActivityDetailRoute(
  activityId: number,
): { name: 'ActivityDetail'; params: RootStackParamList['ActivityDetail'] } {
  return { name: 'ActivityDetail', params: { activityId } };
}
