/**
 * Live Map zoom LOD helpers — unit tests (no MapLibre canvas required).
 *
 * Run: npx vitest run src/__tests__/liveMapZoom.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
    zoomFade,
    resolveLiveMapZoomMode,
    apiDetailForZoom,
    clusterRadiusForZoom,
    CLUSTER_MAX_ZOOM,
    LIVE_MAP_LOD,
    auditLiveMapLodCrossfade,
    riderUnclusteredOpacityAtZoom,
    shouldRenderIndividualRiders,
    ridersVisibleAtZoom,
} from '../modules/analytics/liveMapZoom';
import { MAP_TEXT_FONT_BOLD, MAP_TEXT_FONT_REGULAR } from '../core/map/mapBasemap';

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

    it('apiDetailForZoom switches at summary/standard/full thresholds', () => {
        expect(apiDetailForZoom(4.5)).toBe('summary');
        expect(apiDetailForZoom(5)).toBe('standard');
        expect(apiDetailForZoom(10)).toBe('standard');
        expect(apiDetailForZoom(12)).toBe('full');
        expect(apiDetailForZoom(11.4)).toBe('standard');
    });

    it('clusterMaxZoom aligns with dot fade-in (no invisible band 11.5–12)', () => {
        expect(CLUSTER_MAX_ZOOM).toBe(LIVE_MAP_LOD.dotFadeInStart);
        expect(ridersVisibleAtZoom(11.5)).toBe(true);
        expect(ridersVisibleAtZoom(11.6)).toBe(true);
        expect(ridersVisibleAtZoom(11.9)).toBe(true);
    });

    it('auditLiveMapLodCrossfade has no gap at zoom 5', () => {
        const gaps = auditLiveMapLodCrossfade(4.5, 7, 0.1).filter((i) => i.type === 'GAP');
        const at5 = gaps.filter((i) => Math.abs(i.zoom - 5) < 0.05);
        expect(at5, JSON.stringify(at5)).toHaveLength(0);
    });

    it('clusterRadiusForZoom decreases as zoom increases', () => {
        expect(clusterRadiusForZoom(6)).toBeGreaterThan(clusterRadiusForZoom(12));
    });

    it('LOD crossfade bands do not overlap inconsistently', () => {
        expect(LIVE_MAP_LOD.dotFadeInEnd).toBeLessThan(LIVE_MAP_LOD.iconFadeInEnd);
        expect(LIVE_MAP_LOD.iconMaxZoom).toBe(LIVE_MAP_LOD.labelMinZoom);
        expect(LIVE_MAP_LOD.dotFadeOutStart).toBe(LIVE_MAP_LOD.iconFadeInStart);
        expect(LIVE_MAP_LOD.dotFadeOutEnd).toBeLessThanOrEqual(LIVE_MAP_LOD.iconMaxZoom);
        expect(LIVE_MAP_LOD.cityHubFadeOutEnd).toBeLessThan(LIVE_MAP_LOD.clusterPeakEnd);
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

    it('hides individual riders below z=12 (country/region zoom-out bug)', () => {
        expect(riderUnclusteredOpacityAtZoom(6)).toBe(0);
        expect(riderUnclusteredOpacityAtZoom(10)).toBe(0);
        expect(shouldRenderIndividualRiders(6)).toBe(false);
        expect(shouldRenderIndividualRiders(11.5)).toBe(false);
        expect(shouldRenderIndividualRiders(12.3)).toBe(true);
        expect(LIVE_MAP_LOD.dotFadeInStart).toBe(12);
        expect(apiDetailForZoom(12)).toBe('full');
        expect(LIVE_MAP_LOD.iconMinZoom).toBeGreaterThanOrEqual(LIVE_MAP_LOD.dotFadeInStart);
    });
});

describe('mapBasemap fonts', () => {
    it('uses Noto Sans stacks compatible with OpenFreeMap glyphs', () => {
        expect(MAP_TEXT_FONT_BOLD).toEqual(['Noto Sans Bold']);
        expect(MAP_TEXT_FONT_REGULAR).toEqual(['Noto Sans Regular']);
        expect(MAP_TEXT_FONT_BOLD.join(' ')).not.toMatch(/Open Sans/i);
    });
});
