import type { GarminSimScheduleConfig } from '../api/types';
import { DEFAULT_GARMIN_SCHEDULE } from '../api/types';

const MASS_DRAFT_KEY = 'simulator:mass-draft';
const GARMIN_DRAFT_KEY = 'simulator:garmin-draft';

export interface MassDraft {
    cyclists: number;
    generateActivities: boolean;
    activePercent: number;
    cheatPercent: number;
    liveEnabled: boolean;
}

export interface GarminDraft {
    userCount: number;
    schedule: GarminSimScheduleConfig;
    names: Array<{ first: string; last: string; display: string }>;
    emails: string[];
}

export function loadMassDraft(): Partial<MassDraft> | null {
    try {
        const raw = sessionStorage.getItem(MASS_DRAFT_KEY);
        return raw ? (JSON.parse(raw) as Partial<MassDraft>) : null;
    } catch {
        return null;
    }
}

export function saveMassDraft(draft: MassDraft): void {
    try {
        sessionStorage.setItem(MASS_DRAFT_KEY, JSON.stringify(draft));
    } catch {
        /* ignore quota */
    }
}

export function loadGarminDraft(): Partial<GarminDraft> | null {
    try {
        const raw = sessionStorage.getItem(GARMIN_DRAFT_KEY);
        return raw ? (JSON.parse(raw) as Partial<GarminDraft>) : null;
    } catch {
        return null;
    }
}

export function saveGarminDraft(draft: GarminDraft): void {
    try {
        sessionStorage.setItem(GARMIN_DRAFT_KEY, JSON.stringify(draft));
    } catch {
        /* ignore quota */
    }
}

export function defaultGarminDraft(userCount = 10): GarminDraft {
    return {
        userCount,
        schedule: { ...DEFAULT_GARMIN_SCHEDULE },
        names: [],
        emails: Array.from({ length: userCount }, () => ''),
    };
}
