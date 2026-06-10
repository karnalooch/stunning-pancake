import { describe, expect, it } from 'vitest';
import { buildCityRanking } from '../modules/analytics/live-map/engine/liveMapCityRanking';

describe('buildCityRanking', () => {
    it('filters inactive cities by default', () => {
        const rows = buildCityRanking({ warszawa: 3 }, {}, {}, {});
        expect(rows).toHaveLength(1);
        expect(rows[0].total).toBe(3);
    });

    it('includes all cities when includeInactive is set', () => {
        const rows = buildCityRanking({}, {}, {}, {}, { includeInactive: true });
        expect(rows.length).toBeGreaterThan(1);
        expect(rows.every((r) => r.total === 0)).toBe(true);
    });

    it('sorts active cities before inactive ones', () => {
        const rows = buildCityRanking({ siedlce: 2, warszawa: 5 }, {}, {}, {}, { includeInactive: true });
        expect(rows[0].total).toBe(5);
        expect(rows[1].total).toBe(2);
        expect(rows.some((r) => r.total === 0)).toBe(true);
    });
});
