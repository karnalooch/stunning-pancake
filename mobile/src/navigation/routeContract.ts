import type { RootStackParamList } from './types';

/**
 * Route contract for stack-level destinations and deep-link helpers.
 */
export const ROUTE_PATHS = {
  ride: 'ride',
  compete: 'compete',
  explore: 'explore',
  profile: 'profile',
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
  rideSummary: 'ride/summary/:activityId?',
} as const;

export function buildActivityDetailRoute(
  activityId: number,
): { name: 'ActivityDetail'; params: RootStackParamList['ActivityDetail'] } {
  return { name: 'ActivityDetail', params: { activityId } };
}

export function buildRideSummaryRoute(params: {
  distanceKm: number;
  elapsedS: number;
  elevationGainM: number;
  activityId?: number;
}): { name: 'RideSummary'; params: RootStackParamList['RideSummary'] } {
  return { name: 'RideSummary', params };
}
