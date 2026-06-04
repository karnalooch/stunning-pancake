import type { LiveApiDetail } from './liveMapZoom';

/** Stable key for bbox + API detail — used to detect zoom/pan viewport changes. */
export function liveMapViewportKey(detail: LiveApiDetail, bbox: string | undefined): string {
    return `${detail}|${bbox ?? ''}`;
}

export type LiveMapStaleEmptyInput = {
    listLength: number;
    detail: LiveApiDetail;
    movedRecently: boolean;
    currentPositions: number;
    viewportChanged: boolean;
    /** Server returned cached payload — empty positions must not wipe the map. */
    cachedResponse?: boolean;
};

/**
 * Keep last markers only when the viewport is unchanged and the API returned []
 * shortly after a pan/zoom (transient empty). Never keep stale across viewport changes.
 */
export function shouldKeepStaleEmptyResponse(input: LiveMapStaleEmptyInput): boolean {
    const {
        listLength,
        detail,
        movedRecently,
        currentPositions,
        viewportChanged,
    } = input;
    if (viewportChanged) return false;
    if (
        listLength === 0
        && detail !== 'summary'
        && currentPositions > 0
        && input.cachedResponse
    ) {
        return true;
    }
    return (
        listLength === 0
        && detail !== 'summary'
        && movedRecently
        && currentPositions > 0
    );
}

/** Clear map when re-entering detail after summary or when bbox/detail changed with no riders yet. */
export function shouldClearOnEmptyViewportChange(
    listLength: number,
    detail: LiveApiDetail,
    viewportChanged: boolean,
): boolean {
    return viewportChanged && listLength === 0 && detail !== 'summary';
}
