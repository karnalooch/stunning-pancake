import { describe, expect, it } from 'vitest';
import {
    batchRefetchInterval,
    garminRefetchInterval,
    liveRefetchInterval,
} from './polling';
import type { BatchStatus, GarminSimStatus, LiveStatus } from './types';

const baseLive = { running: false } as LiveStatus;
const baseBatch = { running: false, current_phase: 'idle' } as BatchStatus;
const baseGarmin = { running: false } as GarminSimStatus;

describe('simulator query refetch intervals', () => {
    it('polls live faster when running', () => {
        expect(liveRefetchInterval({ ...baseLive, running: true })).toBe(1500);
        expect(liveRefetchInterval(baseLive)).toBe(15_000);
    });

    it('polls batch faster when running or stuck', () => {
        expect(batchRefetchInterval({ ...baseBatch, running: true })).toBe(2000);
        expect(batchRefetchInterval({ ...baseBatch, stuck: true })).toBe(2000);
        expect(batchRefetchInterval(baseBatch)).toBe(15_000);
    });

    it('polls garmin faster when running', () => {
        expect(garminRefetchInterval({ ...baseGarmin, running: true })).toBe(2000);
        expect(garminRefetchInterval(baseGarmin)).toBe(15_000);
    });
});
