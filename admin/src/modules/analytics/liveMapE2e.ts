import type { LiveMapWebGlAudit } from './liveMapDiagnostics';

/** Playwright-only bridge (enabled when `VITE_E2E=1`). */
export type LiveMapE2EApi = {
    setZoom: (zoom: number, center?: [number, number]) => void;
    getZoom: () => number;
    getZoomMode: () => string;
    isReady: () => boolean;
    getLayerVisibility: (layerId: string) => string | null;
    getRenderedCount: () => number;
    getWebGlAudit: () => LiveMapWebGlAudit | null;
    getRenderMode: () => 'points' | 'clusters' | 'aggregate';
    waitForPaint: () => Promise<void>;
};

declare global {
    interface Window {
        __liveMapE2E?: LiveMapE2EApi;
    }
}

import { isPlaywrightE2eSession } from '../../core/auth/e2eEnv';

export function isLiveMapE2eEnabled(): boolean {
    return isPlaywrightE2eSession();
}

export function publishLiveMapE2e(api: LiveMapE2EApi | undefined): void {
    if (!isLiveMapE2eEnabled()) return;
    if (api) window.__liveMapE2E = api;
    else delete window.__liveMapE2E;
}
