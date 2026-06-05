/**
 * Web Worker — Supercluster build off main thread (Meso tier).
 */
import Supercluster from 'supercluster';
import { CLUSTER_MAX_ZOOM } from './liveMapZoom';

type PointMsg = {
    lng: number;
    lat: number;
    props: Record<string, unknown>;
};

type BuildMsg = {
    id: number;
    type: 'build';
    fingerprint: string;
    points: PointMsg[];
    zoom: number;
    bbox: [number, number, number, number];
    radius: number;
};

type ClustersMsg = {
    id: number;
    type: 'clusters';
    fingerprint: string;
    zoom: number;
    bbox: [number, number, number, number];
};

type WorkerIn = BuildMsg | ClustersMsg;

type ClusterProps = Record<string, unknown>;

let index: Supercluster<ClusterProps, ClusterProps> | null = null;
let loadedFingerprint = '';

function getClusters(
    points: PointMsg[],
    fingerprint: string,
    zoom: number,
    bbox: [number, number, number, number],
    radius: number,
): GeoJSON.Feature<GeoJSON.Point, ClusterProps>[] {
    if (points.length === 0) {
        index = null;
        loadedFingerprint = fingerprint;
        return [];
    }
    if (!index || loadedFingerprint !== fingerprint) {
        const features = points.map((p) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
            properties: p.props,
        }));
        const sc = new Supercluster<ClusterProps, ClusterProps>({
            radius,
            maxZoom: CLUSTER_MAX_ZOOM,
            minPoints: 2,
        });
        sc.load(features);
        index = sc;
        loadedFingerprint = fingerprint;
    }
    const z = Math.max(0, Math.min(Math.floor(zoom), CLUSTER_MAX_ZOOM));
    return index.getClusters(bbox, z) as GeoJSON.Feature<GeoJSON.Point, ClusterProps>[];
}

self.onmessage = (ev: MessageEvent<WorkerIn>) => {
    const msg = ev.data;
    try {
        if (msg.type === 'build') {
            const features = getClusters(msg.points, msg.fingerprint, msg.zoom, msg.bbox, msg.radius);
            self.postMessage({ id: msg.id, features });
            return;
        }
        if (msg.type === 'clusters') {
            if (!index || loadedFingerprint !== msg.fingerprint) {
                self.postMessage({ id: msg.id, features: [] });
                return;
            }
            const z = Math.max(0, Math.min(Math.floor(msg.zoom), CLUSTER_MAX_ZOOM));
            const features = index.getClusters(msg.bbox, z) as GeoJSON.Feature<GeoJSON.Point, ClusterProps>[];
            self.postMessage({ id: msg.id, features });
        }
    } catch (err) {
        self.postMessage({ id: msg.id, error: String(err) });
    }
};
