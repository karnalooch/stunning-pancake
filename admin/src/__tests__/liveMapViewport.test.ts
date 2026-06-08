import { describe, expect, it } from 'vitest';
import {
    liveMapViewportKey,
    shouldClearOnEmptyViewportChange,
    shouldKeepStaleEmptyResponse,
    shouldRetainMarkersOnEmptyPayload,
} from '../modules/analytics/live-map/engine/liveMapViewport';

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

    it('keeps markers when server cache returns empty positions', () => {
        expect(
            shouldKeepStaleEmptyResponse({
                listLength: 0,
                detail: 'standard',
                movedRecently: false,
                currentPositions: 40,
                viewportChanged: false,
                cachedResponse: true,
            }),
        ).toBe(true);
    });

    it('clears map on empty response after viewport change', () => {
        expect(shouldClearOnEmptyViewportChange(0, 'standard', true)).toBe(true);
        expect(shouldClearOnEmptyViewportChange(0, 'summary', true)).toBe(false);
        expect(shouldClearOnEmptyViewportChange(5, 'standard', true)).toBe(false);
    });

    it('retains markers on empty SSE when server did not confirm empty viewport', () => {
        expect(
            shouldRetainMarkersOnEmptyPayload({
                listLength: 0,
                detail: 'standard',
                movedRecently: false,
                currentPositions: 40,
                viewportChanged: false,
                fromStream: true,
                meta: { ride_on_map: 299 },
            }),
        ).toBe(true);
    });

    it('clears on empty SSE when server confirms viewport_returned 0', () => {
        expect(
            shouldRetainMarkersOnEmptyPayload({
                listLength: 0,
                detail: 'standard',
                movedRecently: false,
                currentPositions: 40,
                viewportChanged: false,
                fromStream: true,
                meta: { viewport_returned: 0 },
            }),
        ).toBe(false);
    });
});
