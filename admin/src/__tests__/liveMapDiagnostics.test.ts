import { describe, expect, it } from 'vitest';
import { appendRequestLog, formatCapHonestyMessage } from '../modules/analytics/liveMapDiagnostics';

describe('liveMapDiagnostics', () => {
    it('formatCapHonestyMessage when capped with estimate', () => {
        const msg = formatCapHonestyMessage({
            capped: true,
            positions_returned: 2800,
            viewport_total_estimate: 4200,
        });
        expect(msg).toContain('2');
        expect(msg).toContain('4');
    });

    it('appendRequestLog caps history', () => {
        let log = appendRequestLog([], {
            detail: 'standard',
            latencyMs: 120,
            positions: 10,
        });
        for (let i = 0; i < 20; i += 1) {
            log = appendRequestLog(log, { detail: 'full', latencyMs: i, positions: i });
        }
        expect(log.length).toBeLessThanOrEqual(12);
    });
});
