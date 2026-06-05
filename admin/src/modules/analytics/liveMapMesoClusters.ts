import type { LiveMapPosition } from './liveMapMarkers';
import { sharedMesoClusterIndex } from './liveMapMesoIndex';
import { buildMesoClusterFeatureCollectionAsync } from './liveMapMesoWorkerClient';

/** Sync fallback — tests and worker failure path. */
export function buildMesoClusterFeatureCollection(
    positions: LiveMapPosition[],
    zoom: number,
    bbox?: [number, number, number, number],
): GeoJSON.FeatureCollection<GeoJSON.Point, Record<string, unknown>> {
    return sharedMesoClusterIndex.getFeatureCollection(positions, zoom, bbox) as GeoJSON.FeatureCollection<
        GeoJSON.Point,
        Record<string, unknown>
    >;
}

export { buildMesoClusterFeatureCollectionAsync };
