const REDACTED = '[REDACTED]';
const MAX_DEPTH = 8;

const REDACT_KEYS = new Set([
  'authorization',
  'proxy_authorization',
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'password',
  'passwd',
  'secret',
  'secret_key',
  'api_key',
  'apikey',
  'cookie',
  'set_cookie',
  'session',
  'sessionid',
  'csrfmiddlewaretoken',
  'email',
  'username',
  'user_id',
  'userid',
  'device_id',
  'deviceid',
  'ip',
  'ip_address',
  'lat',
  'latitude',
  'lon',
  'lng',
  'longitude',
  'coordinates',
  'coordinate',
  'gps',
  'location',
  'position',
  'route_path',
  'polyline',
  'gpx',
  'geojson',
]);

const bearerPattern = /\bbearer\s+[A-Za-z0-9._~+/=-]+/gi;
const jwtPattern = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const urlCredentialsPattern = /(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi;
const geoUriPattern = /\bgeo:-?\d{1,3}(?:\.\d+)?,-?\d{1,3}(?:\.\d+)?(?:;[^\s]*)?/gi;
const coordinateSequencePattern = new RegExp(
  `(["']?(?:coordinates?|gps|location|position|route_path|polyline|gpx|geojson)["']?\\s*[:=]\\s*)\\[[^\\r\\n]*\\]`,
  'gi',
);
const keyValuePattern = new RegExp(
  `(["']?(?:${Array.from(REDACT_KEYS).join('|')})["']?\\s*[:=]\\s*["']?)(?!\\[REDACTED\\])[^\\s,;}"']+`,
  'gi',
);

let consoleRedactionInstalled = false;

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/-/g, '_');
}

export function redactString(value: string): string {
  return value
    .replace(bearerPattern, 'Bearer [REDACTED]')
    .replace(jwtPattern, REDACTED)
    .replace(urlCredentialsPattern, '$1[REDACTED]@')
    .replace(emailPattern, REDACTED)
    .replace(geoUriPattern, 'geo:[REDACTED]')
    .replace(coordinateSequencePattern, `$1${REDACTED}`)
    .replace(keyValuePattern, `$1${REDACTED}`);
}

export function redactValue(
  value: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet<object>(),
): unknown {
  if (depth >= MAX_DEPTH) return REDACTED;
  if (typeof value === 'string') return redactString(value);
  if (value === null || value === undefined || typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }
  if (value instanceof Error) return redactError(value);
  if (typeof value !== 'object') return redactString(String(value));

  if (seen.has(value)) return REDACTED;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    output[key] = REDACT_KEYS.has(normalizeKey(key))
      ? REDACTED
      : redactValue(item, depth + 1, seen);
  }
  return output;
}

export function redactError(error: unknown): Error {
  if (!(error instanceof Error)) return new Error(redactString(String(error)));

  const safe = new Error(redactString(error.message));
  safe.name = error.name;
  if (error.stack) safe.stack = redactString(error.stack);
  return safe;
}

export function redactConsoleArgs(args: unknown[]): unknown[] {
  return args.map((arg) => redactValue(arg));
}

export function installConsoleRedaction(): void {
  if (consoleRedactionInstalled) return;

  const target = console as unknown as Record<string, (...args: unknown[]) => void>;
  for (const method of ['log', 'info', 'warn', 'error', 'debug']) {
    const original = target[method]?.bind(console);
    if (!original) continue;
    target[method] = (...args: unknown[]) => original(...redactConsoleArgs(args));
  }
  consoleRedactionInstalled = true;
}

export { REDACTED };
