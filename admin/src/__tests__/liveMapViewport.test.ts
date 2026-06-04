import { describe, expect, it } from 'vitest';
import {
    liveMapViewportKey,
    shouldClearOnEmptyViewportChange,
    shouldKeepStaleEmptyResponse,
} from '../modules/analytics/liveMapViewport';

describe('liveMapViewport', () => {
    it('viewport key includes detail and bbox', () => {
        expect(liveMapViewportKey('standard', '19,52,20,53')).toBe('standard|19,52,20,53');
        expect(liveMapViewportKey('summary', undefined)).toBe('summary|');
    });

    it('does not keep stale when viewport changed', () => {
        expect(
            shouldKeepStaleEmptyResponse({
                listLength: 0,
                detail: 'standard',
                movedRecently: true,
                currentPositions: 40,
                viewportChanged: true,
            }),
        ).toBe(false);
    });

    it('keeps stale on transient empty within same viewport', () => {
        expect(
            shouldKeepStaleEmptyResponse({
                listLength: 0,
                detail: 'standard',
                movedRecently: true,
                currentPositions: 40,
                viewportChanged: false,
            }),
        ).toBe(true);
    });

    it('clears map on empty response after viewport change', () => {
        expect(shouldClearOnEmptyViewportChange(0, 'standard', true)).toBe(true);
        expect(shouldClearOnEmptyViewportChange(0, 'summary', true)).toBe(false);
        expect(shouldClearOnEmptyViewportChange(5, 'standard', true)).toBe(false);
    });
});
