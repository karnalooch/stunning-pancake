/** Map axios / API error payloads to a user-visible message. */
export function formatApiError(err: unknown, fallback = 'Request failed'): string {
  if (!err || typeof err !== 'object') {
    return fallback;
  }
  const ax = err as {
    message?: string;
    response?: {
      data?: {
        error?: unknown;
        detail?: unknown;
        message?: unknown;
        hint?: unknown;
        code?: unknown;
      };
    };
  };
  const data = ax.response?.data;
  const pick = (v: unknown): string | null => {
    if (v == null || v === '' || v === 'None' || v === 'null') return null;
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.map(String).join('; ');
    if (typeof v === 'object' && v !== null) {
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    }
    return String(v);
  };
  return (
    pick(data?.error)
    || pick(data?.detail)
    || pick(data?.message)
    || pick(data?.hint)
    || (data?.code ? `Error (${String(data.code)})` : null)
    || pick(ax.message)
    || fallback
  );
}

/** True when wipe/sim status error field is absent or a Redis "None" sentinel. */
export function isAbsentError(error: unknown): boolean {
  return error == null || error === '' || error === 'None' || error === 'null';
}
