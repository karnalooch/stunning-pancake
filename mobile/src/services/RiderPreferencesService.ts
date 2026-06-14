import { getAppStorage } from '../app/storage';

const WEIGHT_KEY = 'rider_weight_kg';
const MAX_HR_KEY = 'rider_max_hr';
const HAPTICS_KEY = 'haptics_enabled';
const VOICE_CUES_KEY = 'voice_cues_enabled';

const DEFAULTS = {
  weightKg: 72,
  maxHr: 192,
  haptics: true,
  voiceCues: true,
};

export const RiderPreferencesService = {
  getWeightKg(): number {
    const raw = getAppStorage().getString(WEIGHT_KEY);
    const n = raw ? Number(raw) : DEFAULTS.weightKg;
    return Number.isFinite(n) && n > 0 ? n : DEFAULTS.weightKg;
  },

  setWeightKg(kg: number): void {
    getAppStorage().set(WEIGHT_KEY, String(Math.max(30, Math.min(200, Math.round(kg)))));
  },

  getMaxHr(): number {
    const raw = getAppStorage().getString(MAX_HR_KEY);
    const n = raw ? Number(raw) : DEFAULTS.maxHr;
    return Number.isFinite(n) && n > 0 ? n : DEFAULTS.maxHr;
  },

  setMaxHr(bpm: number): void {
    getAppStorage().set(MAX_HR_KEY, String(Math.max(100, Math.min(230, Math.round(bpm)))));
  },

  isHapticsEnabled(): boolean {
    const raw = getAppStorage().getString(HAPTICS_KEY);
    if (raw === undefined) return DEFAULTS.haptics;
    return raw !== 'false';
  },

  setHapticsEnabled(enabled: boolean): void {
    getAppStorage().set(HAPTICS_KEY, enabled ? 'true' : 'false');
  },

  isVoiceCuesEnabled(): boolean {
    const raw = getAppStorage().getString(VOICE_CUES_KEY);
    if (raw === undefined) return DEFAULTS.voiceCues;
    return raw !== 'false';
  },

  setVoiceCuesEnabled(enabled: boolean): void {
    getAppStorage().set(VOICE_CUES_KEY, enabled ? 'true' : 'false');
  },
};
