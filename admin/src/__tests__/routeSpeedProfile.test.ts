import { describe, it, expect } from 'vitest';
import { buildSpeedProfile } from '../utils/routeSpeedProfile';

describe('buildSpeedProfile', () => {
  it('returns points for a simple route', () => {
    const coords: Array<[number, number]> = [[21, 52], [21.01, 52], [21.02, 52.01]];
    const profile = buildSpeedProfile(coords, 3600);
    expect(profile.length).toBe(3);
    expect(profile[2].km).toBeGreaterThan(0);
    expect(profile[2].speedKmh).toBeGreaterThan(0);
  });
});
