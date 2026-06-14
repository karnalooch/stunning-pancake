import { ROUTE_PATHS, buildActivityDetailRoute, buildRideSummaryRoute } from '../../src/navigation/routeContract';
import { mobileLinking } from '../../src/navigation/linking';

describe('routeContract', () => {
  test('builds activity detail params', () => {
    expect(buildActivityDetailRoute(42)).toEqual({
      name: 'ActivityDetail',
      params: { activityId: 42 },
    });
  });

  test('builds ride summary params with optional activity id', () => {
    expect(
      buildRideSummaryRoute({
        distanceKm: 10.2,
        elapsedS: 1800,
        elevationGainM: 220,
        activityId: 7,
      }),
    ).toEqual({
      name: 'RideSummary',
      params: {
        distanceKm: 10.2,
        elapsedS: 1800,
        elevationGainM: 220,
        activityId: 7,
      },
    });
  });

  test('builds ride summary params without activity id', () => {
    expect(
      buildRideSummaryRoute({
        distanceKm: 4.5,
        elapsedS: 900,
        elevationGainM: 80,
      }),
    ).toEqual({
      name: 'RideSummary',
      params: {
        distanceKm: 4.5,
        elapsedS: 900,
        elevationGainM: 80,
      },
    });
  });

  test('exposes expected deep-link paths', () => {
    expect(ROUTE_PATHS.activityDetail).toBe('profile/activity/:activityId');
    expect(ROUTE_PATHS.rideSummary).toBe('ride/summary/:activityId?');
    expect(ROUTE_PATHS.marketplace).toBe('explore/marketplace');
    expect(mobileLinking.config?.screens?.Settings).toBe('settings');
  });
});
