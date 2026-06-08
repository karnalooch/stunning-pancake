/**
 * Live Map zoom LOD helpers — unit tests (no MapLibre canvas required).
 *
 * Run: npx vitest run src/__tests__/liveMapZoom.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
    zoomFade,
    zoomStops,
    resolveLiveMapZoomMode,
    apiDetailForZoom,
    clusterRadiusForZoom,
    CLUSTER_MAX_ZOOM,
    LIVE_MAP_LOD,
    auditLiveMapLodCrossfade,
    riderUnclusteredOpacityAtZoom,
    riderLayerVisibilityAtZoom,
    shouldRenderIndividualRiders,
    ridersVisibleAtZoom,
    riderIconOpacityAtZoom,
    cityHubOpacityAtZoom,
    clusterLayerOpacityAtZoom,
} from '../modules/analytics/live-map/engine/liveMapZoom';
import {
    MAP_GLYPHS_URL,
    MAP_TEXT_FONT_BOLD,
    MAP_TEXT_FONT_REGULAR,
    transformMapGlyphsStyle,
} from '../core/map/mapBasemap';

describe('liveMapZoom', () => {
    it('zoomFade returns 0 below start and 1 at/above end', () => {
        expect(zoomFade(5, 6, 8)).toBe(0);
        expect(zoomFade(8, 6, 8)).toBe(1);
        expect(zoomFade(7, 6, 8)).toBeCloseTo(0.5);
    });

    it('resolveLiveMapZoomMode covers ordered bands', () => {
        expect(resolveLiveMapZoomMode(6)).toBe('country');
        expect(resolveLiveMapZoomMode(8)).toBe('region');
        expect(resolveLiveMapZoomMode(12.5)).toBe('handoff');
        expect(resolveLiveMapZoomMode(13.8)).toBe('street-labels');
        expect(resolveLiveMapZoomMode(15)).toBe('detail');
    });

    it('apiDetailForZoom follows enterprise tier thresholds', () => {
        expect(apiDetailForZoom(4.5)).toBe('summary');
        expect(apiDetailForZoom(8)).toBe('summary');
        expect(apiDetailForZoom(9)).toBe('standard');
        expect(apiDetailForZoom(10)).toBe('standard');
        expect(apiDetailForZoom(11.4)).toBe('standard');
        expect(apiDetailForZoom(12)).toBe('full');
    });

    it('clusterMaxZoom aligns with dot fade-in (no invisible band 11.5–12)', () => {
        expect(CLUSTER_MAX_ZOOM).toBe(LIVE_MAP_LOD.dotFadeInStart);
        expect(ridersVisibleAtZoom(11.5)).toBe(true);
        expect(ridersVisibleAtZoom(11.6)).toBe(true);
        expect(ridersVisibleAtZoom(11.9)).toBe(true);
    });

    it('auditLiveMapLodCrossfade has no gap at macro zoom (hubs only)', () => {
        const gaps = auditLiveMapLodCrossfade(4.5, 8.5, 0.1).filter((i) => i.type === 'GAP');
        const at6 = gaps.filter((i) => Math.abs(i.zoom - 6) < 0.05);
        expect(at6, JSON.stringify(at6)).toHaveLength(0);
    });

    it('auditLiveMapLodCrossfade has no gap at meso zoom 10', () => {
        const gaps = auditLiveMapLodCrossfade(9.5, 11.5, 0.1).filter((i) => i.type === 'GAP');
        const at10 = gaps.filter((i) => Math.abs(i.zoom - 10) < 0.05);
        expect(at10, JSON.stringify(at10)).toHaveLength(0);
    });

    it('clusterRadiusForZoom decreases as zoom increases', () => {
        expect(clusterRadiusForZoom(6)).toBeGreaterThan(clusterRadiusForZoom(12));
    });

    it('LOD crossfade bands do not overlap inconsistently', () => {
        expect(LIVE_MAP_LOD.dotFadeInEnd).toBeLessThanOrEqual(LIVE_MAP_LOD.iconFadeInEnd);
        expect(LIVE_MAP_LOD.iconMaxZoom).toBe(LIVE_MAP_LOD.labelMinZoom);
        expect(LIVE_MAP_LOD.dotFadeOutEnd).toBe(LIVE_MAP_LOD.labelMinZoom);
        expect(LIVE_MAP_LOD.dotFadeOutStart).toBeLessThan(LIVE_MAP_LOD.dotFadeOutEnd);
        expect(LIVE_MAP_LOD.cityHubFadeOutEnd).toBeLessThan(LIVE_MAP_LOD.clusterPeakEnd);
    });

    it('micro handoff band z=12.5–12.9 keeps riders visible (dots or icons)', () => {
        for (const z of [12.5, 12.9, 13.0]) {
            expect(riderLayerVisibilityAtZoom(z), `z=${z}`).toBeGreaterThan(0.5);
            expect(ridersVisibleAtZoom(z), `z=${z}`).toBe(true);
            expect(riderIconOpacityAtZoom(z), `z=${z}`).toBeGreaterThanOrEqual(0.85);
        }
    });

    it('auditLiveMapLodCrossfade finds no gaps or double rider layers', () => {
        const issues = auditLiveMapLodCrossfade();
        const gaps = issues.filter((i) => i.type === 'GAP');
        const doubles = issues.filter((i) => i.type === 'DOUBLE');
        const aggregateDoubles = issues.filter((i) => i.type === 'AGGREGATE_DOUBLE');
        const overlaps = issues.filter((i) => i.type === 'ICON_OVERLAP');
        const steps = issues.filter((i) => i.type === 'ICON_STEP');
        expect(gaps, JSON.stringify(gaps)).toHaveLength(0);
        expect(overlaps, JSON.stringify(overlaps)).toHaveLength(0);
        expect(steps, JSON.stringify(steps)).toHaveLength(0);
        expect(doubles.length, JSON.stringify(doubles.slice(0, 8))).toBe(0);
        expect(aggregateDoubles, JSON.stringify(aggregateDoubles.slice(0, 8))).toHaveLength(0);
    });

    it('cityHubOpacityAtZoom stays visible at z=8.9 (macro handoff)', () => {
        expect(cityHubOpacityAtZoom(8.9)).toBeGreaterThanOrEqual(0.85);
        const gaps = auditLiveMapLodCrossfade(8.5, 9.2, 0.1).filter((i) => i.type === 'GAP');
        const at89 = gaps.filter((i) => Math.abs(i.zoom - 8.9) < 0.05);
        expect(at89, JSON.stringify(at89)).toHaveLength(0);
    });

    it('clusterLayerOpacityAtZoom is strong at meso z=11.6', () => {
        expect(clusterLayerOpacityAtZoom(11.6)).toBeGreaterThanOrEqual(0.8);
    });

    it('zoomStops sorts pairs by zoom ascending', () => {
        const expr = zoomStops([9, 0.4], [5.5, 0.42], [8, 0.72], [10.5, 0.88]) as unknown[];
        expect(expr[0]).toBe('interpolate');
        expect(expr.slice(3)).toEqual([5.5, 0.42, 8, 0.72, 9, 0.4, 10.5, 0.88]);
    });

    it('meso singleton dots visible z=9–11.5, full micro dots from z≥12', () => {
        expect(riderUnclusteredOpacityAtZoom(6)).toBe(0);
        expect(riderUnclusteredOpacityAtZoom(10)).toBeGreaterThan(0.35);
        expect(riderUnclusteredOpacityAtZoom(11.5)).toBeGreaterThan(0.35);
        expect(riderUnclusteredOpacityAtZoom(12)).toBeCloseTo(0, 3);
        expect(shouldRenderIndividualRiders(6)).toBe(false);
        expect(shouldRenderIndividualRiders(11.5)).toBe(true);
        expect(shouldRenderIndividualRiders(12.3)).toBe(true);
        expect(shouldRenderIndividualRiders(12.9)).toBe(true);
        expect(ridersVisibleAtZoom(12.9)).toBe(true);
        expect(LIVE_MAP_LOD.dotFadeInStart).toBe(12);
        expect(apiDetailForZoom(12)).toBe('full');
        expect(LIVE_MAP_LOD.iconMinZoom).toBeGreaterThanOrEqual(LIVE_MAP_LOD.dotFadeInStart);
    });
});

describe('mapBasemap fonts', () => {
    it('uses Noto Sans stacks compatible with OpenMapTiles glyphs', () => {
        expect(MAP_TEXT_FONT_BOLD).toEqual(['Noto Sans Bold']);
        expect(MAP_TEXT_FONT_REGULAR).toEqual(['Noto Sans Regular']);
        expect(MAP_TEXT_FONT_BOLD.join(' ')).not.toMatch(/Open Sans/i);
    });

    it('transformMapGlyphsStyle overrides OpenFreeMap glyphs URL', () => {
        const incoming = {
            glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
            version: 8,
        };
        expect(transformMapGlyphsStyle(incoming, incoming)).toEqual({
            ...incoming,
            glyphs: MAP_GLYPHS_URL,
        });
    });
});
