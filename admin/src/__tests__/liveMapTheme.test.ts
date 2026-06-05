import { describe, expect, it } from 'vitest';
import { clusterColorExpression, resolveLiveMapTheme } from '../modules/analytics/liveMapTheme';

describe('liveMapTheme', () => {
    it('builds cluster stops from tenant colors', () => {
        const theme = resolveLiveMapTheme({ primary_color: '#ff0000', secondary_color: '#00ff00' });
        expect(theme.clusterStops.length).toBeGreaterThanOrEqual(3);
        expect(theme.hubAccent).toBe('#ff0000');
    });

    it('clusterColorExpression is valid step', () => {
        const theme = resolveLiveMapTheme({ primary_color: '#112233', secondary_color: '#aabbcc' });
        const expr = clusterColorExpression(theme);
        expect(expr[0]).toBe('step');
        expect(expr.length).toBeGreaterThan(4);
    });
});
