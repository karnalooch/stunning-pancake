/**
 * Live Map render_mode layer visibility — unit tests (no MapLibre canvas).
 *
 * Run: npx vitest run src/__tests__/liveMapRenderMode.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
    layerVisibilityForRenderMode,
    MICRO_RIDER_LAYERS,
    MESO_RIDER_LAYERS,
    H3_LAYER,
    setLiveMapRenderMode,
} from '../modules/analytics/live-map/engine/liveMapH3Layer';
import { buildMockH3AggregateFeatures } from '../../e2e/fixtures/liveMapTelemetry';

describe('layerVisibilityForRenderMode', () => {
    it('hides all rider layers in aggregate mode', () => {
        for (const id of [...MESO_RIDER_LAYERS, ...MICRO_RIDER_LAYERS]) {
            expect(layerVisibilityForRenderMode(id, 'aggregate', 11)).toBe(false);
        }
    });

    it('shows meso cluster layers at z=10 in clusters mode', () => {
        for (const id of MESO_RIDER_LAYERS) {
            expect(layerVisibilityForRenderMode(id, 'clusters', 10)).toBe(true);
        }
        for (const id of MICRO_RIDER_LAYERS) {
            expect(layerVisibilityForRenderMode(id, 'clusters', 10)).toBe(false);
        }
    });

    it('shows micro layers at z=13 in clusters mode (prod fix)', () => {
        for (const id of MICRO_RIDER_LAYERS) {
            expect(layerVisibilityForRenderMode(id, 'clusters', 13)).toBe(true);
        }
        for (const id of MESO_RIDER_LAYERS) {
            expect(layerVisibilityForRenderMode(id, 'clusters', 13)).toBe(false);
        }
    });

    it('shows meso cluster layers at z=10 even in points render_mode (tier-first)', () => {
        for (const id of MESO_RIDER_LAYERS) {
            expect(layerVisibilityForRenderMode(id, 'points', 10)).toBe(true);
        }
        for (const id of MICRO_RIDER_LAYERS) {
            expect(layerVisibilityForRenderMode(id, 'points', 10)).toBe(false);
        }
    });

    it('hides rider layers at macro zoom', () => {
        for (const id of [...MESO_RIDER_LAYERS, ...MICRO_RIDER_LAYERS]) {
            expect(layerVisibilityForRenderMode(id, 'clusters', 7)).toBe(false);
        }
    });
});

describe('setLiveMapRenderMode', () => {
    it('sets micro layer visibility visible at z=13 clusters mode', () => {
        const visibility = new Map<string, string>();
        const layers = new Set([...MESO_RIDER_LAYERS, ...MICRO_RIDER_LAYERS, 'live-h3-cells-fill']);
        const map = {
            getLayer: (id: string) => (layers.has(id) ? {} : undefined),
            setLayoutProperty: (id: string, prop: string, value: unknown) => {
                if (prop === 'visibility') visibility.set(id, String(value));
            },
        };
        setLiveMapRenderMode(map, 'clusters', 13);
        expect(visibility.get('live-unclustered')).toBe('visible');
        expect(visibility.get('live-rider-labels')).toBe('visible');
        expect(visibility.get('live-clusters')).toBe('none');
    });

    it('shows H3 fill layer in aggregate mode', () => {
        const visibility = new Map<string, string>();
        const layers = new Set([...MESO_RIDER_LAYERS, ...MICRO_RIDER_LAYERS, H3_LAYER]);
        const map = {
            getLayer: (id: string) => (layers.has(id) ? {} : undefined),
            setLayoutProperty: (id: string, prop: string, value: unknown) => {
                if (prop === 'visibility') visibility.set(id, String(value));
            },
        };
        setLiveMapRenderMode(map, 'aggregate', 8);
        expect(visibility.get(H3_LAYER)).toBe('visible');
        expect(visibility.get('live-clusters')).toBe('none');
        expect(visibility.get('live-unclustered')).toBe('none');
    });
});

describe('buildMockH3AggregateFeatures', () => {
    it('generates high cell count for scale gate mocks', () => {
        const features = buildMockH3AggregateFeatures(1500);
        expect(features).toHaveLength(1500);
        expect(features[0]?.geometry).toMatchObject({ type: 'Polygon' });
    });
});
