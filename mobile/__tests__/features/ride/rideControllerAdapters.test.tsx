import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import type {
  RideController,
  RideControllerOptions,
} from '../../../src/features/ride/controller/RideController';
import { useDeterministicRideController } from '../../../src/features/ride/controller/useDeterministicRideController';
import { useProductionRideController } from '../../../src/features/ride/controller/useProductionRideController';

const mockUseRideLifecycle = jest.fn();

jest.mock('../../../src/bootstrap/useRideLifecycle', () => ({
  useRideLifecycle: (options: RideControllerOptions) => mockUseRideLifecycle(options),
}));

describe('ride controller adapters', () => {
  afterEach(() => {
    mockUseRideLifecycle.mockReset();
  });

  test('production adapter delegates to the existing lifecycle once', () => {
    const fake = {
      isRecording: false,
      ridePaused: false,
    } as RideController;
    mockUseRideLifecycle.mockReturnValue(fake);
    const options: RideControllerOptions = {
      onStartRideSuccess: jest.fn(),
    };

    let captured!: RideController;
    function Harness() {
      captured = useProductionRideController(options);
      return null;
    }

    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<Harness />);
    });

    expect(captured).toBe(fake);
    expect(mockUseRideLifecycle).toHaveBeenCalledTimes(1);
    expect(mockUseRideLifecycle).toHaveBeenCalledWith(options);

    act(() => tree.unmount());
  });

  test('deterministic adapter completes start, pause, resume and finish without production lifecycle', async () => {
    const onStartRideSuccess = jest.fn();
    let captured!: RideController;

    function Harness() {
      captured = useDeterministicRideController({ onStartRideSuccess });
      return null;
    }

    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<Harness />);
    });

    expect(mockUseRideLifecycle).not.toHaveBeenCalled();
    expect(captured.isRecording).toBe(false);

    await act(async () => {
      expect(await captured.handleStartRide('BIKE')).toBe(true);
    });
    expect(captured.isRecording).toBe(true);
    expect(captured.liveDistanceKm).toBeGreaterThan(0);
    expect(onStartRideSuccess).toHaveBeenCalledTimes(1);

    act(() => captured.setRidePaused(true));
    expect(captured.ridePaused).toBe(true);

    act(() => captured.setRidePaused(false));
    expect(captured.ridePaused).toBe(false);

    await act(async () => {
      expect(await captured.handleStopRide()).toEqual({ navigated: false });
    });
    expect(captured.isRecording).toBe(false);
    expect(captured.rideSummary?.distanceKm).toBeGreaterThan(0);

    act(() => tree.unmount());
  });
});
