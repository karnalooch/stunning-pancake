import {
  crestForTenant,
  deptIconFor,
  crestInitials,
} from '../../src/assets/visionAssets';

describe('visionAssets resolvers', () => {
  test('crestForTenant matches by id/name regardless of diacritics or suffix', () => {
    // Assets are wired -> known cities resolve to a source; unknown/empty stay undefined.
    expect(crestForTenant('lublin')).toBeDefined();
    expect(crestForTenant('Gdańsk')).toBeDefined();
    expect(crestForTenant('siedlce-city')).toBeDefined();
    expect(crestForTenant(null)).toBeUndefined();
    expect(crestForTenant('Atlantis')).toBeUndefined();
  });

  test('deptIconFor matches Polish and English team names', () => {
    expect(deptIconFor('IT Rowery')).toBeDefined();
    expect(deptIconFor('Marketing')).toBeDefined();
    expect(deptIconFor('Sprzedaż')).toBeDefined();
    expect(deptIconFor('')).toBeUndefined();
  });

  test('crestInitials returns two uppercase letters', () => {
    expect(crestInitials('Lublin')).toBe('LU');
    expect(crestInitials('warszawa')).toBe('WA');
  });
});
