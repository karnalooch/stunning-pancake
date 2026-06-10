import { describe, it, expect } from 'vitest';
import {
  tenantActivitiesUrl,
  tenantLiveMapUrl,
  tenantToCitySlug,
  tenantUsersUrl,
} from '../utils/tenantDrillDown';

describe('tenantDrillDown', () => {
  it('builds users url', () => {
    expect(tenantUsersUrl('warszawa', 'Warszawa')).toBe(
      '/owner/users?tenant_id=warszawa&tenant_name=Warszawa',
    );
  });

  it('builds activities url', () => {
    expect(tenantActivitiesUrl('krakow')).toBe('/owner/activities?tenant_id=krakow');
  });

  it('maps known city name to slug', () => {
    expect(tenantToCitySlug('city-x', 'Warszawa')).toBe('warszawa');
  });

  it('builds live map url with city param', () => {
    expect(tenantLiveMapUrl('warszawa', 'Warszawa')).toBe(
      '/owner/analytics/live-map?city=warszawa',
    );
  });
});
