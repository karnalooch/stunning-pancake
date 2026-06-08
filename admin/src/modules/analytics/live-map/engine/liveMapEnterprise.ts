/**
 * Enterprise Live Map tiers — one active visualization family per zoom band.
 *
 * | Tier  | Zoom   | API detail | Render |
 * |-------|--------|------------|--------|
 * | macro | z < 9  | summary    | City hubs only (no rider GeoJSON) |
 * | meso  | 9–12   | standard   | Supercluster circles + counts |
 * | micro | z ≥ 12 | full       | GPU icons + labels |
 */
export type LiveApiDetail = 'summary' | 'standard' | 'full';

export const LIVE_MAP_TIER = {
    mesoMinZoom: 9,
    microMinZoom: 12,
} as const;

export type LiveMapTier = 'macro' | 'meso' | 'micro';

export const TIER_MODE_LABEL: Record<LiveMapTier, string> = {
    macro: 'Makro',
    meso: 'Meso',
    micro: 'Mikro',
};

export function resolveLiveMapTier(zoom: number): LiveMapTier {
    if (zoom < LIVE_MAP_TIER.mesoMinZoom) return 'macro';
    if (zoom < LIVE_MAP_TIER.microMinZoom) return 'meso';
    return 'micro';
}

export function apiDetailForTier(zoom: number): LiveApiDetail {
    const tier = resolveLiveMapTier(zoom);
    if (tier === 'macro') return 'summary';
    if (tier === 'meso') return 'standard';
    return 'full';
}

export function tierShowsCityHubs(zoom: number): boolean {
    return resolveLiveMapTier(zoom) === 'macro';
}

export function tierShowsRiderClusters(zoom: number): boolean {
    return resolveLiveMapTier(zoom) === 'meso';
}

export function tierShowsRiderDetail(zoom: number): boolean {
    return resolveLiveMapTier(zoom) === 'micro';
}
