import type { LiveMapTheme } from './liveMapTheme';
import { defaultLiveMapTheme } from './liveMapTheme';

export const H3_SOURCE = 'live-h3-cells';
export const H3_LAYER = 'live-h3-cells-fill';

const MESO_CLUSTER_LAYERS = [
    'live-clusters',
    'live-cluster-count',
    'live-direction-dots',
    'live-unclustered',
    'live-rider-icons',
    'live-rider-labels',
];

export function installH3Layer(
    map: {
        getSource: (id: string) => unknown;
        addSource: (id: string, spec: object) => void;
        addLayer: (spec: object, before?: string) => void;
    },
    theme: LiveMapTheme = defaultLiveMapTheme(),
): void {
    if (!map.getSource(H3_SOURCE)) {
        map.addSource(H3_SOURCE, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
        });
        map.addLayer({
            id: H3_LAYER,
            source: H3_SOURCE,
            type: 'fill',
            paint: {
                'fill-color': theme.h3Fill,
                'fill-opacity': [
                    'interpolate', ['linear'], ['get', 'weight'],
                    0, 0.12,
                    0.25, 0.28,
                    0.5, 0.42,
                    1, 0.62,
                ],
                'fill-outline-color': theme.h3Stroke,
            },
        });
    }
}

export function setH3CellData(
    map: { getSource: (id: string) => { setData?: (d: object) => void } | null },
    geojson: { type: string; features: unknown[] },
): void {
    const src = map.getSource(H3_SOURCE);
    src?.setData?.(geojson);
}

export function setLiveMapRenderMode(
    map: {
        getLayer: (id: string) => unknown;
        setLayoutProperty: (id: string, prop: string, value: unknown) => void;
    },
    mode: 'points' | 'clusters' | 'aggregate',
): void {
    const showPoints = mode === 'points' || mode === 'clusters';
    const showMeso = mode === 'clusters';
    const showH3 = mode === 'aggregate';

    for (const id of MESO_CLUSTER_LAYERS) {
        if (!map.getLayer(id)) continue;
        const visible = id === 'live-unclustered' || id === 'live-rider-icons' || id === 'live-rider-labels'
            ? showPoints && mode === 'points'
            : showMeso;
        map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    }
    if (map.getLayer(H3_LAYER)) {
        map.setLayoutProperty(H3_LAYER, 'visibility', showH3 ? 'visible' : 'none');
    }
}
