import { describe, expect, it } from 'vitest';
import { canShowFullRiderPii, maskRiderName } from '../modules/analytics/liveMapPrivacy';

describe('liveMapPrivacy', () => {
    it('allows full PII for GLOBAL_OWNER', () => {
        expect(canShowFullRiderPii('GLOBAL_OWNER')).toBe(true);
        expect(maskRiderName({ name: 'Jan Kowalski', deviceId: '1' }, 'GLOBAL_OWNER')).toBe('Jan Kowalski');
    });

    it('masks names for TENANT_MODERATOR', () => {
        expect(canShowFullRiderPii('TENANT_MODERATOR')).toBe(false);
        expect(maskRiderName({ name: 'Jan Kowalski', deviceId: '1' }, 'TENANT_MODERATOR')).toBe('J. Kowalski');
    });
});
