import { LIVE_LAYERS } from './liveMapLayers';

export const HEATMAP_SOURCE = 'heatmap-cells';
export const HEATMAP_FILL_LAYER = 'heatmap-fill';
export const HEATMAP_OUTLINE_LAYER = 'heatmap-outline';

type HeatmapMap = {
    getSource: (id: string) => { setData?: (d: object) => void } | undefined;
    addSource: (id: string, spec: object) => void;
    addLayer: (spec: object, before?: string) => void;
    getLayer: (id: string) => unknown;
    removeLayer: (id: string) => void;
    removeSource: (id: string) => void;
};

export function removeHeatmapLayers(map: HeatmapMap): void {
    for (const id of [HEATMAP_OUTLINE_LAYER, HEATMAP_FILL_LAYER]) {
        try {
            if (map.getLayer(id)) map.removeLayer(id);
        } catch { /* */ }
    }
    try {
        if (map.getSource(HEATMAP_SOURCE)) map.removeSource(HEATMAP_SOURCE);
    } catch { /* */ }
}

export function setHeatmapCellData(
    map: HeatmapMap,
    features: GeoJSON.Feature[],
): void {
    const payload = { type: 'FeatureCollection', features };
    const source = map.getSource(HEATMAP_SOURCE);
    if (!source && features.length > 0) {
        map.addSource(HEATMAP_SOURCE, { type: 'geojson', data: payload });
        map.addLayer({
            id: HEATMAP_FILL_LAYER,
            type: 'fill',
            source: HEATMAP_SOURCE,
            before: LIVE_LAYERS.unclustered,
            paint: {
                'fill-color': [
                    'interpolate', ['linear'], ['get', 'weight'],
                    0, '#1a3a5c', 0.25, '#2d6a9f', 0.5, '#f59e0b', 0.75, '#ef4444', 1, '#dc2626',
                ],
                'fill-opacity': [
                    'interpolate', ['linear'], ['get', 'weight'],
                    0, 0.12, 0.5, 0.4, 1, 0.6,
                ],
            },
        });
        map.addLayer({
            id: HEATMAP_OUTLINE_LAYER,
            type: 'line',
            source: HEATMAP_SOURCE,
            before: LIVE_LAYERS.unclustered,
            paint: { 'line-color': 'rgba(255,255,255,0.06)', 'line-width': 0.5 },
        });
        return;
    }
    source?.setData?.(payload);
}
