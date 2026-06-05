import type { LiveMapPosition } from './liveMapMarkers';
import { resolveActivityKind, speedToKmh } from './liveMapMarkers';
import { CLUSTER_MAX_ZOOM, clusterRadiusForZoom } from './liveMapZoom';
import { positionsFingerprint, sharedMesoClusterIndex } from './liveMapMesoIndex';

type WorkerReply = {
    id: number;
    features?: GeoJSON.Feature<GeoJSON.Point, Record<string, unknown>>[];
    error?: string;
};

let worker: Worker | null = null;
let workerFailed = false;
let seq = 0;
const pending = new Map<number, {
    resolve: (fc: GeoJSON.FeatureCollection<GeoJSON.Point, Record<string, unknown>>) => void;
    reject: (err: Error) => void;
}>();

function positionToPoint(pos: LiveMapPosition): { lng: number; lat: number; props: Record<string, unknown> } | null {
    const lat = Number(pos.lat);
    const lng = Number(pos.lng);
    if (!pos.deviceId || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const speed = Number(pos.speed);
    const course = Number(pos.course);
    return {
        lng,
        lat,
        props: {
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

function ensureWorker(): Worker | null {
    if (workerFailed || typeof Worker === 'undefined') return null;
    if (worker) return worker;
    try {
        worker = new Worker(new URL('./liveMapMeso.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (ev: MessageEvent<WorkerReply>) => {
            const { id, features, error } = ev.data;
            const p = pending.get(id);
            if (!p) return;
            pending.delete(id);
            if (error) {
                p.reject(new Error(error));
                return;
            }
            p.resolve({ type: 'FeatureCollection', features: features ?? [] });
        };
        worker.onerror = () => {
            workerFailed = true;
            worker?.terminate();
            worker = null;
        };
        return worker;
    } catch {
        workerFailed = true;
        return null;
    }
}

function buildSync(
    positions: LiveMapPosition[],
    zoom: number,
    bbox?: [number, number, number, number],
): GeoJSON.FeatureCollection<GeoJSON.Point, Record<string, unknown>> {
    return sharedMesoClusterIndex.getFeatureCollection(positions, zoom, bbox) as GeoJSON.FeatureCollection<
        GeoJSON.Point,
        Record<string, unknown>
    >;
}

export function buildMesoClusterFeatureCollectionAsync(
    positions: LiveMapPosition[],
    zoom: number,
    bbox?: [number, number, number, number],
): Promise<GeoJSON.FeatureCollection<GeoJSON.Point, Record<string, unknown>>> {
    const bounds = bbox ?? [-180, -85, 180, 85] as [number, number, number, number];
    const points = positions.map(positionToPoint).filter((p): p is NonNullable<typeof p> => p != null);
    if (points.length === 0) {
        return Promise.resolve({ type: 'FeatureCollection', features: [] });
    }

    const w = ensureWorker();
    if (!w) {
        return Promise.resolve(buildSync(positions, zoom, bounds));
    }

    const id = ++seq;
    const fingerprint = positionsFingerprint(positions);
    const radius = clusterRadiusForZoom(zoom);
    const z = Math.max(0, Math.min(Math.floor(zoom), CLUSTER_MAX_ZOOM));

    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        w.postMessage({
            id,
            type: 'build',
            fingerprint,
            points,
            zoom: z,
            bbox: bounds,
            radius,
        });
        setTimeout(() => {
            if (!pending.has(id)) return;
            pending.delete(id);
            resolve(buildSync(positions, zoom, bounds));
        }, 12_000);
    }).catch(() => buildSync(positions, zoom, bounds));
}

export function terminateMesoWorker(): void {
    worker?.terminate();
    worker = null;
    workerFailed = false;
    pending.clear();
}
