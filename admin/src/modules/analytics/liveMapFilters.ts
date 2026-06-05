/** Live Map query filters — synced with URL and API params. */

export type LiveMapActivityFilter = 'all' | 'bike' | 'run';

export type LiveMapFilters = {
    activityType: LiveMapActivityFilter;
    citySlug: string | null;
    presentationMode: boolean;
};

export const DEFAULT_LIVE_MAP_FILTERS: LiveMapFilters = {
    activityType: 'all',
    citySlug: null,
    presentationMode: false,
};

export function filtersToApiParams(filters: LiveMapFilters): Record<string, string> {
    const params: Record<string, string> = {};
    if (filters.activityType !== 'all') {
        params.activity_type = filters.activityType;
    }
    if (filters.citySlug) {
        params.city = filters.citySlug;
    }
    return params;
}

export function parseFiltersFromSearch(search: string): Partial<LiveMapFilters> {
    const qs = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const out: Partial<LiveMapFilters> = {};
    const act = qs.get('activity') || qs.get('activity_type');
    if (act === 'bike' || act === 'run') out.activityType = act;
    const city = qs.get('city');
    if (city) out.citySlug = city;
    if (qs.get('presentation') === '1') out.presentationMode = true;
    return out;
}

export function filtersToSearchParams(filters: LiveMapFilters, zoom?: number): string {
    const qs = new URLSearchParams();
    if (filters.activityType !== 'all') qs.set('activity', filters.activityType);
    if (filters.citySlug) qs.set('city', filters.citySlug);
    if (filters.presentationMode) qs.set('presentation', '1');
    if (zoom != null && Number.isFinite(zoom)) qs.set('z', String(Math.round(zoom * 10) / 10));
    const s = qs.toString();
    return s ? `?${s}` : '';
}

export function mergeFilters(base: LiveMapFilters, patch: Partial<LiveMapFilters>): LiveMapFilters {
    return { ...base, ...patch };
}
