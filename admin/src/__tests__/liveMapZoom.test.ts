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
    LIVE_MAP_LOD,
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
        expect(apiDetailForZoom(6)).toBe('summary');
        expect(apiDetailForZoom(10)).toBe('standard');
        expect(apiDetailForZoom(13)).toBe('full');
    });

    it('clusterRadiusForZoom decreases as zoom increases', () => {
        expect(clusterRadiusForZoom(6)).toBeGreaterThan(clusterRadiusForZoom(12));
    });

    it('LOD crossfade bands do not overlap inconsistently', () => {
        expect(LIVE_MAP_LOD.dotFadeInEnd).toBeLessThan(LIVE_MAP_LOD.iconFadeInEnd);
        expect(LIVE_MAP_LOD.iconFadeOutEnd).toBeGreaterThan(LIVE_MAP_LOD.labelFadeInStart);
        expect(LIVE_MAP_LOD.cityHubFadeOutEnd).toBeLessThan(LIVE_MAP_LOD.clusterPeakEnd);
    });
});

describe('mapBasemap fonts', () => {
    it('uses Noto Sans stacks compatible with OpenFreeMap glyphs', () => {
        expect(MAP_TEXT_FONT_BOLD).toEqual(['Noto Sans Bold']);
        expect(MAP_TEXT_FONT_REGULAR).toEqual(['Noto Sans Regular']);
        expect(MAP_TEXT_FONT_BOLD.join(' ')).not.toMatch(/Open Sans/i);
    });
});
