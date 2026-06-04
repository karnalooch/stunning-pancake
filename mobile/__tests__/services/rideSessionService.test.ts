/**
 * Ride start/stop at service layer (Q-P1-4) — mocked API + GpsSyncManager.
 */

const mockCreateSession = jest.fn();
const mockStartTracking = jest.fn();
const mockStopTracking = jest.fn();
const mockSetUserId = jest.fn();

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    getString: jest.fn(() => 'device-test-1'),
    set: jest.fn(),
  })),
}));

jest.mock('../../src/services/api', () => ({
  ActivityService: {
    createSession: (...args: unknown[]) => mockCreateSession(...args),
  },
}));

jest.mock('../../src/services/GpsSyncManager', () => ({
  GpsSyncManager: jest.fn().mockImplementation(() => ({
    startTracking: mockStartTracking,
    stopTracking: mockStopTracking,
    setUserId: mockSetUserId,
  })),
  PollingResolution: { BALANCED: 'balanced' },
  isRideTrackingActive: jest.fn(() => false),
  resumeTrackingAfterRelaunch: jest.fn(),
}));

import { startRideSession, stopRideSession } from '../../src/services/rideSessionService';

describe('rideSessionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateSession.mockResolvedValue(99);
    mockStartTracking.mockResolvedValue(undefined);
    mockStopTracking.mockResolvedValue({ finalized: true, pendingUpload: 0 });
  });

  test('startRideSession creates session then starts GPS tracking', async () => {
    const activityId = await startRideSession({ userId: 7, type: 'run', event_id: 3 });

    expect(activityId).toBe(99);
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'run',
        event_id: 3,
        start_time: expect.any(String),
      }),
    );
    expect(mockStartTracking).toHaveBeenCalledWith(99, 'balanced');
  });

  test('stopRideSession delegates to GpsSyncManager and returns upload state', async () => {
    mockStopTracking.mockResolvedValue({ finalized: false, pendingUpload: 4 });

    const result = await stopRideSession(7);

    expect(result).toEqual({ finalized: false, pendingUpload: 4 });
    expect(mockStopTracking).toHaveBeenCalledTimes(1);
  });

  test('startRideSession defaults type to ride', async () => {
    await startRideSession({ userId: null });

    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ride' }),
    );
  });
});
