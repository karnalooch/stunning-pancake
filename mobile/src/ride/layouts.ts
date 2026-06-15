import { getAppStorage } from '../bootstrap/storage';
import type { DataFieldLayout, RideProfileId, StoredDataFieldLayouts } from './types';

export const LAYOUT_SCHEMA_VERSION = 1;
const STORAGE_KEY = 'ride_data_field_layouts';

const ROAD_LAYOUT: DataFieldLayout = {
  schemaVersion: LAYOUT_SCHEMA_VERSION,
  profileId: 'road',
  slots: [
    { slotKey: 'r1c1', fieldId: 'distance', emphasis: 'normal' },
    { slotKey: 'r1c2', fieldId: 'speed', emphasis: 'hero' },
    { slotKey: 'r1c3', fieldId: 'avgSpeed', emphasis: 'normal' },
    { slotKey: 'r2c1', fieldId: 'time', emphasis: 'normal' },
    { slotKey: 'r2c2', fieldId: 'hr', emphasis: 'normal' },
    { slotKey: 'r2c3', fieldId: 'elevation', emphasis: 'normal' },
    { slotKey: 'r2c4', fieldId: 'heading', emphasis: 'normal' },
  ],
};

const TRAINING_LAYOUT: DataFieldLayout = {
  schemaVersion: LAYOUT_SCHEMA_VERSION,
  profileId: 'training',
  slots: [
    { slotKey: 'r1c1', fieldId: 'hr', emphasis: 'hero' },
    { slotKey: 'r1c2', fieldId: 'speed', emphasis: 'normal' },
    { slotKey: 'r1c3', fieldId: 'cadence', emphasis: 'normal' },
    { slotKey: 'r2c1', fieldId: 'distance', emphasis: 'normal' },
    { slotKey: 'r2c2', fieldId: 'time', emphasis: 'normal' },
    { slotKey: 'r2c3', fieldId: 'elevation', emphasis: 'normal' },
    { slotKey: 'r2c4', fieldId: 'gpsStatus', emphasis: 'normal' },
  ],
};

const RACE_LAYOUT: DataFieldLayout = {
  schemaVersion: LAYOUT_SCHEMA_VERSION,
  profileId: 'race',
  slots: [
    { slotKey: 'r1c1', fieldId: 'speed', emphasis: 'hero' },
    { slotKey: 'r1c2', fieldId: 'distance', emphasis: 'normal' },
    { slotKey: 'r1c3', fieldId: 'avgSpeed', emphasis: 'normal' },
    { slotKey: 'r2c1', fieldId: 'time', emphasis: 'normal' },
    { slotKey: 'r2c2', fieldId: 'lap', emphasis: 'normal' },
    { slotKey: 'r2c3', fieldId: 'elevation', emphasis: 'normal' },
    { slotKey: 'r2c4', fieldId: 'heading', emphasis: 'normal' },
  ],
};

export const DEFAULT_PROFILE_LAYOUTS: Record<RideProfileId, DataFieldLayout> = {
  road: ROAD_LAYOUT,
  training: TRAINING_LAYOUT,
  race: RACE_LAYOUT,
};

export function createDefaultStoredLayouts(): StoredDataFieldLayouts {
  return {
    schemaVersion: LAYOUT_SCHEMA_VERSION,
    activeProfile: 'road',
    profiles: { ...DEFAULT_PROFILE_LAYOUTS },
  };
}

function migrateStored(raw: unknown): StoredDataFieldLayouts {
  if (!raw || typeof raw !== 'object') return createDefaultStoredLayouts();
  const obj = raw as Partial<StoredDataFieldLayouts>;
  if (obj.schemaVersion !== LAYOUT_SCHEMA_VERSION) return createDefaultStoredLayouts();
  const profiles = { ...DEFAULT_PROFILE_LAYOUTS, ...(obj.profiles ?? {}) };
  const activeProfile =
    obj.activeProfile && profiles[obj.activeProfile] ? obj.activeProfile : 'road';
  return {
    schemaVersion: LAYOUT_SCHEMA_VERSION,
    activeProfile,
    profiles,
  };
}

export function loadStoredLayouts(): StoredDataFieldLayouts {
  const storage = getAppStorage();
  const raw = storage.getString(STORAGE_KEY);
  if (!raw) return createDefaultStoredLayouts();
  try {
    return migrateStored(JSON.parse(raw));
  } catch {
    return createDefaultStoredLayouts();
  }
}

export function saveStoredLayouts(stored: StoredDataFieldLayouts): void {
  const storage = getAppStorage();
  storage.set(STORAGE_KEY, JSON.stringify(stored));
}

export function getActiveLayout(stored: StoredDataFieldLayouts): DataFieldLayout {
  return stored.profiles[stored.activeProfile] ?? ROAD_LAYOUT;
}

export function splitLayoutRows(slots: DataFieldLayout['slots']): {
  row1: DataFieldLayout['slots'];
  row2: DataFieldLayout['slots'];
} {
  const row1 = slots.filter((s) => s.slotKey.startsWith('r1'));
  const row2 = slots.filter((s) => s.slotKey.startsWith('r2'));
  return { row1, row2 };
}
