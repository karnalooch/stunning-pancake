import { limitForZoom } from './liveMapZoom';

/** Fast first-paint cap for Meso/micro viewport loads (P2 progressive limit). */
export const PROGRESSIVE_FAST_LIMIT = 1200;

export function progressiveLimitForZoom(zoom: number): number {
    return Math.min(PROGRESSIVE_FAST_LIMIT, limitForZoom(zoom));
}

export function shouldFetchFullLimitAfterFast(
    fastLimit: number,
    fullLimit: number,
    returned: number,
    capped: boolean,
): boolean {
    if (fullLimit <= fastLimit) return false;
    return capped || returned >= fastLimit;
}

/** Delay SSE restart so HTTP first-paint is not competing on the same tick (P0). */
export const SSE_RESTART_DELAY_MS = 300;

/** Coalesce zoomend + moveend into one viewport update per animation frame. */
export function coalesceViewportSettle(
    tokenRef: { current: number },
    run: () => void,
): void {
    const token = ++tokenRef.current;
    requestAnimationFrame(() => {
        if (token !== tokenRef.current) return;
        run();
    });
}
