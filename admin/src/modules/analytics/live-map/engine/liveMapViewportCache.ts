import type { LiveMapPosition } from './liveMapMarkers';
import type { LiveMapFilters } from './liveMapFilters';
import { filtersToApiParams } from './liveMapFilters';
import type { LiveApiDetail } from './liveMapZoom';

export type ViewportCacheEntry = {
    positions: LiveMapPosition[];
    meta: Record<string, unknown> | null;
    fetchedAt: number;
    etag?: string | null;
};

const MAX_ENTRIES = 24;
const cache = new Map<string, ViewportCacheEntry>();

/** Stable cache key: detail + bbox + filter params. */
export function viewportCacheKey(
    detail: LiveApiDetail,
    bbox: string | undefined,
    filters: LiveMapFilters,
): string {
    const filterKey = Object.entries(filtersToApiParams(filters))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join('&');
    return `${detail}|${bbox ?? ''}|${filterKey}`;
}

export function getViewportCache(key: string): ViewportCacheEntry | undefined {
    return cache.get(key);
}

export function setViewportCache(
    key: string,
    entry: Omit<ViewportCacheEntry, 'fetchedAt'> & { fetchedAt?: number },
): void {
    if (cache.size >= MAX_ENTRIES) {
        const oldest = [...cache.entries()].sort((a, b) => a[1].fetchedAt - b[1].fetchedAt)[0];
        if (oldest) cache.delete(oldest[0]);
    }
    cache.set(key, { ...entry, fetchedAt: entry.fetchedAt ?? Date.now() });
}

export function deleteViewportCache(key: string): void {
    cache.delete(key);
}

export function clearViewportCache(): void {
    cache.clear();
}
