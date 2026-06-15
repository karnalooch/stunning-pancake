import {
  crestForTenant,
  deptIconFor,
  crestInitials,
} from '../../src/assets/visionAssets';

describe('visionAssets resolvers', () => {
  test('crestForTenant normalizes ids and names', () => {
    // No PNGs generated yet -> undefined, but resolver must not throw and must
    // match the right key regardless of diacritics / "-city" suffixes.
    expect(crestForTenant('lublin')).toBeUndefined();
    expect(crestForTenant('Gdańsk')).toBeUndefined();
    expect(crestForTenant('siedlce-city')).toBeUndefined();
    expect(crestForTenant(null)).toBeUndefined();
    expect(crestForTenant('Atlantis')).toBeUndefined();
  });

  test('deptIconFor matches Polish and English team names', () => {
    expect(deptIconFor('IT Rowery')).toBeUndefined();
    expect(deptIconFor('Marketing')).toBeUndefined();
    expect(deptIconFor('Sprzedaż')).toBeUndefined();
    expect(deptIconFor('')).toBeUndefined();
  });

  test('crestInitials returns two uppercase letters', () => {
    expect(crestInitials('Lublin')).toBe('LU');
    expect(crestInitials('warszawa')).toBe('WA');
  });
});
