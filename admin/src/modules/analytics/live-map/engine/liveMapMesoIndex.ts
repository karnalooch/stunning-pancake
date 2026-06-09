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

/** Cheap fingerprint — detects snapshot replacement without hashing every coord. */
export function positionsFingerprint(positions: LiveMapPosition[]): string {
    const n = positions.length;
    if (n === 0) return '0';
    const step = Math.max(1, Math.floor(n / 24));
    let h = n;
    for (let i = 0; i < n; i += step) {
        const p = positions[i];
        h = (h * 31 + String(p.deviceId ?? '').charCodeAt(0)) | 0;
        h = (h * 31 + Math.round(Number(p.lat) * 1e4)) | 0;
        h = (h * 31 + Math.round(Number(p.lng) * 1e4)) | 0;
    }
    const first = positions[0];
    const last = positions[n - 1];
    return `${n}|${first.deviceId}|${last.deviceId}|${h}`;
}

function positionsToPoints(positions: LiveMapPosition[]): Array<GeoJSON.Feature<GeoJSON.Point, ClusterProps>> {
    return positions
        .filter((p) => p.deviceId && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)))
        .map(positionToFeature);
}

/** Reusable Supercluster index — avoids full rebuild on zoom-only changes in Meso. */
export class MesoClusterIndex {
    private index: Supercluster<ClusterProps, ClusterProps> | null = null;
    private fingerprint = '';
    private clusterZoom = 10;

    ensureLoaded(positions: LiveMapPosition[], zoom: number): void {
        const fp = positionsFingerprint(positions);
        const z = Math.max(0, Math.min(Math.floor(zoom), CLUSTER_MAX_ZOOM));
        if (this.index && fp === this.fingerprint) {
            this.clusterZoom = z;
            return;
        }

        const points = positionsToPoints(positions);
        if (points.length === 0) {
            this.index = null;
            this.fingerprint = fp;
            this.clusterZoom = z;
            return;
        }

        const sc = new Supercluster<ClusterProps, ClusterProps>({
            radius: clusterRadiusForZoom(zoom),
            maxZoom: CLUSTER_MAX_ZOOM,
            minPoints: 2,
        });
        sc.load(points);
        this.index = sc;
        this.fingerprint = fp;
        this.clusterZoom = z;
    }

    getFeatureCollection(
        positions: LiveMapPosition[],
        zoom: number,
        bbox?: [number, number, number, number],
    ): GeoJSON.FeatureCollection<GeoJSON.Point, ClusterProps> {
        const points = positionsToPoints(positions);
        if (points.length === 0) {
            return { type: 'FeatureCollection', features: [] };
        }
        this.ensureLoaded(positions, zoom);
        if (!this.index) {
            return { type: 'FeatureCollection', features: [] };
        }
        const z = Math.max(0, Math.min(Math.floor(zoom), CLUSTER_MAX_ZOOM));
        const bounds = bbox ?? [-180, -85, 180, 85];
        const features = this.index.getClusters(bounds, z) as Array<GeoJSON.Feature<GeoJSON.Point, ClusterProps>>;
        return { type: 'FeatureCollection', features };
    }

    reset(): void {
        this.index = null;
        this.fingerprint = '';
    }

    /** Supercluster expansion zoom — replaces MapLibre geojson `cluster` source API. */
    getClusterExpansionZoom(
        positions: LiveMapPosition[],
        zoom: number,
        clusterId: number,
    ): number | null {
        this.ensureLoaded(positions, zoom);
        if (!this.index || !Number.isFinite(clusterId)) return null;
        try {
            return this.index.getClusterExpansionZoom(clusterId);
        } catch {
            return null;
        }
    }

    /** Bike/run breakdown for cluster hover tooltips. */
    getClusterLeafKinds(
        positions: LiveMapPosition[],
        zoom: number,
        clusterId: number,
        limit = 200,
    ): { bike: number; run: number } | null {
        this.ensureLoaded(positions, zoom);
        if (!this.index || !Number.isFinite(clusterId)) return null;
        try {
            const leaves = this.index.getLeaves(clusterId, limit, 0) as Array<
                GeoJSON.Feature<GeoJSON.Point, ClusterProps>
            >;
            if (!leaves.length) return null;
            let bike = 0;
            let run = 0;
            for (const leaf of leaves) {
                const k = leaf.properties?.kind;
                if (k === 'bike') bike += 1;
                else run += 1;
            }
            return { bike, run };
        } catch {
            return null;
        }
    }
}

export const sharedMesoClusterIndex = new MesoClusterIndex();
