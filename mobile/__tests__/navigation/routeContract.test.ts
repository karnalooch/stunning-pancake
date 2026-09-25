import { ROUTE_PATHS, buildActivityDetailRoute } from '../../src/navigation/routeContract';
import { mobileLinking } from '../../src/navigation/linking';

describe('routeContract', () => {
  test('builds activity detail params', () => {
    expect(buildActivityDetailRoute(42)).toEqual({
      name: 'ActivityDetail',
      params: { activityId: 42 },
    });
  });


  test('exposes expected deep-link paths', () => {
    expect(ROUTE_PATHS.activityDetail).toBe('profile/activity/:activityId');
    expect(ROUTE_PATHS.marketplace).toBe('explore/marketplace');
    expect(mobileLinking.config?.screens?.Settings).toBe('settings');
    expect(mobileLinking.config?.screens?.RideSummary).toBeUndefined();
  });
});
