import Supercluster from 'supercluster';
import type { LiveMapPosition } from './liveMapMarkers';
import { resolveActivityKind, speedToKmh } from './liveMapMarkers';
import { CLUSTER_MAX_ZOOM, clusterRadiusForZoom } from './liveMapZoom';

type ClusterProps = {
    deviceId?: string;
    name?: string;
    kind?: string;
    speed?: number;
    speedKmh?: number;
    course?: number;
    flagged?: boolean;
    cluster?: boolean;
    point_count?: number;
    cluster_id?: number;
};

function positionToFeature(pos: LiveMapPosition): GeoJSON.Feature<GeoJSON.Point, ClusterProps> {
    const lat = Number(pos.lat);
    const lng = Number(pos.lng);
    const speed = Number(pos.speed);
    const course = Number(pos.course);
    return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: {
            deviceId: pos.deviceId,
            name: pos.name || `Athlete ${pos.deviceId}`,
            kind: resolveActivityKind(pos.type),
            speed: Number.isFinite(speed) ? speed : 0,
            speedKmh: speedToKmh(Number.isFinite(speed) ? speed : 0),
            course: Number.isFinite(course) ? course : 0,
            flagged: Boolean(pos.flagged),
        },
    };
}

/** Client-side Supercluster — reliable meso tier display (MapLibre geojson cluster worker can stall). */
export function buildMesoClusterFeatureCollection(
    positions: LiveMapPosition[],
    zoom: number,
    bbox?: [number, number, number, number],
): GeoJSON.FeatureCollection<GeoJSON.Point, ClusterProps> {
    const points = positions
        .filter((p) => p.deviceId && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)))
        .map(positionToFeature);

    if (points.length === 0) {
        return { type: 'FeatureCollection', features: [] };
    }

    const index = new Supercluster<ClusterProps, ClusterProps>({
        radius: clusterRadiusForZoom(zoom),
        maxZoom: CLUSTER_MAX_ZOOM,
        minPoints: 2,
    });
    index.load(points);

    const z = Math.max(0, Math.min(Math.floor(zoom), CLUSTER_MAX_ZOOM));
    const bounds = bbox ?? [-180, -85, 180, 85];
    const features = index.getClusters(bounds, z) as Array<GeoJSON.Feature<GeoJSON.Point, ClusterProps>>;
    return { type: 'FeatureCollection', features };
}
