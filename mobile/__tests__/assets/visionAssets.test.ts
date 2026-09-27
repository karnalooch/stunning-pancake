import fs from 'fs';
import path from 'path';
import {
  crestForTenant,
  deptIconFor,
  crestInitials,
} from '../../src/assets/visionAssets';

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, '../../src/assets/visionAssets.ts'),
  'utf8',
);

describe('visionAssets resolvers after legacy asset purge', () => {
  test('legacy optional crest lookup fails closed until a verified crest is approved', () => {
    expect(crestForTenant('lublin')).toBeUndefined();
    expect(crestForTenant('Gdańsk')).toBeUndefined();
    expect(crestForTenant('siedlce-city')).toBeUndefined();
    expect(crestForTenant(null)).toBeUndefined();
    expect(crestForTenant('Atlantis')).toBeUndefined();
  });

  test('legacy department PNG lookup fails closed instead of restoring generated assets', () => {
    expect(deptIconFor('IT Rowery')).toBeUndefined();
    expect(deptIconFor('Marketing')).toBeUndefined();
    expect(deptIconFor('Sprzedaż')).toBeUndefined();
    expect(deptIconFor('')).toBeUndefined();
  });

  test('resolver module does not reference retired generated roots', () => {
    expect(SOURCE).not.toContain('assets/generated');
    expect(SOURCE).not.toContain('mobile/assets/generated');
  });

  test('crestInitials remains available for deterministic Place Badge fallback', () => {
    expect(crestInitials('Lublin')).toBe('LU');
    expect(crestInitials('warszawa')).toBe('WA');
  });
});
