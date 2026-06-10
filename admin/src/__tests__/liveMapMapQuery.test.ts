import { describe, it, expect } from 'vitest';
import {
    classifyRenderedFeatures,
    countRenderedWithSymbolFallback,
    queryRenderedFeaturesInViewport,
} from '../modules/analytics/live-map/engine/liveMapMapQuery';

describe('liveMapMapQuery', () => {
    it('queryRenderedFeaturesInViewport prefers options-only then CSS bbox', () => {
        const calls: unknown[] = [];
        const map = {
            getCanvas: () => ({ width: 1600, height: 1200, clientWidth: 800, clientHeight: 600 }) as HTMLCanvasElement,
            getContainer: () => ({ clientWidth: 800, clientHeight: 600 }) as HTMLElement,
            queryRenderedFeatures: (...args: unknown[]) => {
                calls.push(args);
                if (args.length === 1) return [];
                return [{ properties: { point_count: 5 } }];
            },
        };
        const out = queryRenderedFeaturesInViewport(map, ['live-clusters']);
        expect(out).toHaveLength(1);
        expect(calls[0]).toEqual([{ layers: ['live-clusters'] }]);
        expect(calls[1]).toEqual([[[0, 0], [800, 600]], { layers: ['live-clusters'] }]);
    });

    it('classifyRenderedFeatures splits clusters and riders', () => {
        const features = [
            { properties: { point_count: 12 } },
            { properties: { deviceId: 'a' } },
            { properties: { slug: 'warszawa', count: 10 } },
        ];
        expect(classifyRenderedFeatures(features, 'meso')).toEqual({
            total: 2,
            clusters: 1,
            points: 1,
            hubs: 0,
        });
        expect(classifyRenderedFeatures(features, 'macro')).toEqual({
            total: 2,
            clusters: 1,
            points: 0,
            hubs: 1,
        });
    });

    it('countRenderedWithSymbolFallback uses source features for micro symbol layers', () => {
        const map = {
            getCanvas: () => ({ clientWidth: 800, clientHeight: 600 }) as HTMLCanvasElement,
            getContainer: () => ({ clientWidth: 800, clientHeight: 600 }) as HTMLElement,
            queryRenderedFeatures: () => [],
            querySourceFeatures: () => [
                { properties: { deviceId: 'a' } },
                { properties: { deviceId: 'b' } },
            ],
        };
        const out = countRenderedWithSymbolFallback(
            map,
            ['live-rider-labels'],
            'micro',
            'live-positions',
        );
        expect(out).toEqual({
            total: 2,
            clusters: 0,
            points: 2,
            hubs: 0,
            usedSourceFallback: true,
        });
    });
});
