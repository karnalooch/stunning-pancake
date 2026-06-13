import type { DataFieldId } from './dataFields';

export type RideProfileId = 'road' | 'training' | 'race';

export type FieldEmphasis = 'normal' | 'hero';

export interface DataFieldSlot {
  slotKey: string;
  fieldId: DataFieldId;
  emphasis: FieldEmphasis;
}

export interface DataFieldLayout {
  schemaVersion: number;
  profileId: RideProfileId;
  slots: DataFieldSlot[];
}

export interface StoredDataFieldLayouts {
  schemaVersion: number;
  activeProfile: RideProfileId;
  profiles: Record<RideProfileId, DataFieldLayout>;
}

/** Live values fed into DataFieldGrid formatters. */
export interface RideMetricsSnapshot {
  speedMs: number;
  distanceKm: number;
  avgSpeedKmh: number | null;
  elapsedSeconds: number;
  heartRateBpm: number | null;
  elevationGainM: number;
  headingDeg: number | null;
  gpsPending: boolean;
}
