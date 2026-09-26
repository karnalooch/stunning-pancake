import { isOfflineTransportError } from '../../src/services/apiRetry';

describe('isOfflineTransportError', () => {
  test('accepts Axios transport failures without an HTTP response', () => {
    expect(
      isOfflineTransportError({
        isAxiosError: true,
        response: undefined,
      }),
    ).toBe(true);
  });

  test('rejects authoritative HTTP responses such as 404 and 403', () => {
    expect(
      isOfflineTransportError({
        isAxiosError: true,
        response: { status: 404 },
      }),
    ).toBe(false);

    expect(
      isOfflineTransportError({
        isAxiosError: true,
        response: { status: 403 },
      }),
    ).toBe(false);
  });

  test('rejects non-Axios failures so application bugs do not masquerade as offline mode', () => {
    expect(isOfflineTransportError(new Error('render contract bug'))).toBe(false);
  });
});
