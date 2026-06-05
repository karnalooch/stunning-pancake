import type { LiveMapFilters } from './liveMapFilters';

export type LiveMapBookmark = {
    id: string;
    label: string;
    center: [number, number];
    zoom: number;
    filters: LiveMapFilters;
};

const STORAGE_KEY = 'live-map-bookmarks-v1';

export function loadLiveMapBookmarks(): LiveMapBookmark[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function saveLiveMapBookmarks(bookmarks: LiveMapBookmark[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks.slice(0, 20)));
}

export function addLiveMapBookmark(
    bookmarks: LiveMapBookmark[],
    entry: Omit<LiveMapBookmark, 'id'>,
): LiveMapBookmark[] {
    const id = `bm-${Date.now()}`;
    return [{ ...entry, id }, ...bookmarks.filter((b) => b.label !== entry.label)].slice(0, 20);
}
