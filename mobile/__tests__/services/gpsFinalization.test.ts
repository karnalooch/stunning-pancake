import { finalizeActivityWithRetry } from '../../src/services/gpsFinalization';

describe('finalizeActivityWithRetry', () => {
  test('returns true only after the server accepts finalization', async () => {
    const postFinalize = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({});
    const capture = jest.fn();
    const sleep = jest.fn().mockResolvedValue(undefined);

    await expect(
      finalizeActivityWithRetry(42, 1234, 5, { postFinalize, capture, sleep }),
    ).resolves.toBe(true);

    expect(postFinalize).toHaveBeenCalledTimes(2);
    expect(capture).not.toHaveBeenCalled();
  });

  test('returns false and captures when every retry fails', async () => {
    const postFinalize = jest.fn().mockRejectedValue(new Error('still offline'));
    const capture = jest.fn();
    const sleep = jest.fn().mockResolvedValue(undefined);

    await expect(
      finalizeActivityWithRetry(42, 1234, 3, { postFinalize, capture, sleep }),
    ).resolves.toBe(false);

    expect(postFinalize).toHaveBeenCalledTimes(3);
    expect(capture).toHaveBeenCalledWith(expect.any(Error), 'GPS_FINALIZE_FAILED');
  });
});
