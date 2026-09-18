const mockPost = jest.fn();
const mockInitializeGpsStorage = jest.fn();
const mockLoadPendingSession = jest.fn();
const mockSavePendingSession = jest.fn();
const mockClearPendingSession = jest.fn();

jest.mock('../../src/services/apiClient', () => ({
  api: { post: (...args: unknown[]) => mockPost(...args) },
}));

jest.mock('../../src/services/gpsEncryptedStorage', () => ({
  initializeGpsStorage: () => mockInitializeGpsStorage(),
}));

jest.mock('../../src/services/gpsSyncStorage', () => ({
  loadPendingSession: (...args: unknown[]) => mockLoadPendingSession(...args),
  savePendingSession: (...args: unknown[]) => mockSavePendingSession(...args),
  clearPendingSession: (...args: unknown[]) => mockClearPendingSession(...args),
}));

import { createSessionWithDurability } from '../../src/services/sessionDurability';

describe('T74 durable session create intent', () => {
  const storage = { id: 'encrypted-storage' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockInitializeGpsStorage.mockResolvedValue(storage);
    mockLoadPendingSession.mockReturnValue(null);
    mockPost.mockResolvedValue({ data: { id: 42 } });
  });

  test('persists a new intent before the network request', async () => {
    await expect(
      createSessionWithDurability({
        type: 'BIKE',
        start_time: '2026-09-17T20:00:00.000Z',
      }),
    ).resolves.toBe(42);

    expect(mockSavePendingSession).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledTimes(1);
    const saveOrder = mockSavePendingSession.mock.invocationCallOrder[0];
    const postOrder = mockPost.mock.invocationCallOrder[0];
    expect(saveOrder).toBeDefined();
    expect(postOrder).toBeDefined();
    if (saveOrder === undefined || postOrder === undefined) {
      throw new Error('expected both persistence and network calls to be recorded');
    }
    expect(saveOrder).toBeLessThan(postOrder);
    expect(mockClearPendingSession).toHaveBeenCalledWith(storage);
  });

  test('reuses the unresolved original start_time instead of overwriting it', async () => {
    mockLoadPendingSession.mockReturnValue({
      type: 'BIKE',
      start_time: '2026-09-17T20:00:00.000Z',
      created_at: 1,
      attempts: 1,
    });

    await expect(
      createSessionWithDurability({
        type: 'BIKE',
        start_time: '2026-09-17T20:05:00.000Z',
      }),
    ).resolves.toBe(42);

    expect(mockSavePendingSession).not.toHaveBeenCalled();
    expect(mockPost).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ start_time: '2026-09-17T20:00:00.000Z' }),
    );
  });

  test('fails closed when a different ride is requested while intent is unresolved', async () => {
    mockLoadPendingSession.mockReturnValue({
      type: 'BIKE',
      start_time: '2026-09-17T20:00:00.000Z',
      event_id: 7,
      created_at: 1,
      attempts: 1,
    });

    await expect(
      createSessionWithDurability({
        type: 'RUN',
        start_time: '2026-09-17T20:05:00.000Z',
        event_id: 7,
      }),
    ).rejects.toThrow('Pending session recovery required');

    expect(mockPost).not.toHaveBeenCalled();
    expect(mockSavePendingSession).not.toHaveBeenCalled();
  });
});
