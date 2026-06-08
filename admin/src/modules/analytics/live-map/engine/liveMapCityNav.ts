import { cityBySlug } from './liveMapCities';
import type { LiveMapFilters } from './liveMapFilters';
import { filtersToApiParams } from './liveMapFilters';
import { getViewportCache, viewportCacheKey } from './liveMapViewportCache';
import { apiDetailForZoom } from './liveMapZoom';

const MESO_FLY_ZOOM = 10.5;
const MESO_BBOX_PAD = 0.18;

export function mesoBboxForCitySlug(slug: string): string | null {
    const city = cityBySlug(slug);
    if (!city) return null;
    return [
        (city.lng - MESO_BBOX_PAD).toFixed(4),
        (city.lat - MESO_BBOX_PAD).toFixed(4),
        (city.lng + MESO_BBOX_PAD).toFixed(4),
        (city.lat + MESO_BBOX_PAD).toFixed(4),
    ].join(',');
}

export function cityHasMesoViewportCache(slug: string, filters: LiveMapFilters): boolean {
    const bbox = mesoBboxForCitySlug(slug);
    if (!bbox) return false;
    const detail = apiDetailForZoom(MESO_FLY_ZOOM);
    const key = viewportCacheKey(detail, bbox, { ...filters, citySlug: slug });
    const cached = getViewportCache(key);
    return Boolean(cached && cached.positions.length > 0);
}

export function mesoFlyZoom(): number {
    return MESO_FLY_ZOOM;
}

export function cityFlyParams(
    slug: string,
    filters: LiveMapFilters,
): { center: [number, number]; zoom: number; duration: number; instant: boolean } | null {
    const city = cityBySlug(slug);
    if (!city) return null;
    const instant = cityHasMesoViewportCache(slug, filters);
    return {
        center: [city.lng, city.lat],
        zoom: MESO_FLY_ZOOM,
        duration: instant ? 0 : 700,
        instant,
    };
}

