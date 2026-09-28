import type { RootStackParamList } from './types';

/**
 * UX v2 route contract for primary tabs, stack destinations and deep-link helpers.
 */
export const ROUTE_PATHS = {
  today: 'today',
  discover: 'discover',
  startRide: 'ride/start',
  club: 'club',
  you: 'you',
  tracking: 'ride/live',
  settings: 'you/settings',
  trainingLog: 'you/training-log',
  gpsDiagnostics: 'ride/gps-diagnostics',
  clubs: 'club/clubs',
  segments: 'discover/segments',
  exploreMap: 'discover/map',
  marketplace: 'discover/marketplace',
  activityDetail: 'you/activity/:activityId',
  performanceTrends: 'you/trends',
  globalLeaderboard: 'club/global-leaderboard',
  ridePaused: 'ride/paused',
  visionGallery: 'vision-gallery',
} as const;

export function buildActivityDetailRoute(
  activityId: number,
): { name: 'ActivityDetail'; params: RootStackParamList['ActivityDetail'] } {
  return { name: 'ActivityDetail', params: { activityId } };
}
