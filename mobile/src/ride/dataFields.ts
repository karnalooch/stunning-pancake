export type DataFieldId =
  | 'speed'
  | 'avgSpeed'
  | 'distance'
  | 'time'
  | 'hr'
  | 'elevation'
  | 'heading'
  | 'power'
  | 'cadence'
  | 'grade'
  | 'eta'
  | 'lap'
  | 'gpsStatus';

export interface DataFieldDefinition {
  id: DataFieldId;
  labelKey: string;
  defaultLabel: string;
  unit?: string;
  format: (value: unknown) => string;
}

function num(value: unknown, digits = 1): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

function int(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '—';
  return String(Math.round(n));
}

function duration(value: unknown): string {
  const total = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(total) || total < 0) return '—';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function heading(value: unknown): string {
  const deg = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(deg)) return '—';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
  const idx = Math.round(deg / 45) % 8;
  return dirs[idx] ?? '—';
}

export const DATA_FIELD_REGISTRY: Record<DataFieldId, DataFieldDefinition> = {
  speed: {
    id: 'speed',
    labelKey: 'ride.fields.speed',
    defaultLabel: 'Speed',
    unit: 'km/h',
    format: (v) => num(v, 1),
  },
  avgSpeed: {
    id: 'avgSpeed',
    labelKey: 'ride.fields.avgSpeed',
    defaultLabel: 'Avg speed',
    unit: 'km/h',
    format: (v) => num(v, 1),
  },
  distance: {
    id: 'distance',
    labelKey: 'ride.fields.distance',
    defaultLabel: 'Distance',
    unit: 'km',
    format: (v) => num(v, 1),
  },
  time: {
    id: 'time',
    labelKey: 'ride.fields.time',
    defaultLabel: 'Time',
    format: duration,
  },
  hr: {
    id: 'hr',
    labelKey: 'ride.fields.hr',
    defaultLabel: 'Heart rate',
    unit: 'bpm',
    format: (v) => (v == null ? '—' : int(v)),
  },
  elevation: {
    id: 'elevation',
    labelKey: 'ride.fields.elevation',
    defaultLabel: 'Elevation',
    unit: 'm',
    format: (v) => {
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n)) return '—';
      return n >= 0 ? `+${Math.round(n)}` : String(Math.round(n));
    },
  },
  heading: {
    id: 'heading',
    labelKey: 'ride.fields.heading',
    defaultLabel: 'Heading',
    format: heading,
  },
  power: {
    id: 'power',
    labelKey: 'ride.fields.power',
    defaultLabel: 'Power',
    unit: 'W',
    format: (v) => (v == null ? '—' : int(v)),
  },
  cadence: {
    id: 'cadence',
    labelKey: 'ride.fields.cadence',
    defaultLabel: 'Cadence',
    unit: 'rpm',
    format: (v) => (v == null ? '—' : int(v)),
  },
  grade: {
    id: 'grade',
    labelKey: 'ride.fields.grade',
    defaultLabel: 'Grade',
    unit: '%',
    format: (v) => (v == null ? '—' : num(v, 1)),
  },
  eta: {
    id: 'eta',
    labelKey: 'ride.fields.eta',
    defaultLabel: 'ETA',
    format: (v) => (v == null ? '—' : String(v)),
  },
  lap: {
    id: 'lap',
    labelKey: 'ride.fields.lap',
    defaultLabel: 'Lap',
    format: (v) => (v == null ? '—' : String(v)),
  },
  gpsStatus: {
    id: 'gpsStatus',
    labelKey: 'ride.fields.gps',
    defaultLabel: 'GPS',
    format: (v) => (v ? '!' : 'OK'),
  },
};

export const DATA_FIELD_IDS = Object.keys(DATA_FIELD_REGISTRY) as DataFieldId[];

export function resolveFieldValue(
  fieldId: DataFieldId,
  metrics: import('./types').RideMetricsSnapshot,
): unknown {
  switch (fieldId) {
    case 'speed':
      return metrics.speedMs * 3.6;
    case 'avgSpeed':
      return metrics.avgSpeedKmh;
    case 'distance':
      return metrics.distanceKm;
    case 'time':
      return metrics.elapsedSeconds;
    case 'hr':
      return metrics.heartRateBpm;
    case 'elevation':
      return metrics.elevationGainM;
    case 'heading':
      return metrics.headingDeg;
    case 'gpsStatus':
      return metrics.gpsPending;
    default:
      return null;
  }
}
