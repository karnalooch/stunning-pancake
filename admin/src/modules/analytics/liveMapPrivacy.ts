import type { Role } from '../../core/auth/useAuth';
import type { LiveMapPosition } from './liveMapMarkers';

/** Roles that see full rider names on micro tier. */
const FULL_PII_ROLES: Role[] = ['GLOBAL_OWNER', 'TENANT_ADMIN'];

export function canShowFullRiderPii(role: Role | undefined): boolean {
    return Boolean(role && FULL_PII_ROLES.includes(role));
}

export function maskRiderName(
    pos: Pick<LiveMapPosition, 'name' | 'deviceId'>,
    role: Role | undefined,
): string {
    if (canShowFullRiderPii(role)) {
        return pos.name || `Athlete ${pos.deviceId}`;
    }
    const raw = pos.name || pos.deviceId || '';
    if (!raw) return 'Athlete';
    const parts = raw.trim().split(/\s+/);
    if (parts.length >= 2) {
        return `${parts[0][0] ?? ''}. ${parts[parts.length - 1]}`;
    }
    if (raw.length <= 3) return raw;
    return `${raw.slice(0, 2)}…`;
}

export function displayRiderLabel(
    pos: Pick<LiveMapPosition, 'name' | 'deviceId'>,
    role: Role | undefined,
    tier: 'macro' | 'meso' | 'micro',
): string {
    if (tier !== 'micro') return maskRiderName(pos, role);
    return maskRiderName(pos, role);
}
