import { getAppStorage } from '../bootstrap/storage';
import { trackEngagement } from '../services/EngagementAnalytics';

export const PROGRESSION_SCHEMA_VERSION = 1;
const STORAGE_KEY = 'game_progression_v1';

export interface ProgressionState {
  schemaVersion: number;
  xp: number;
  streakDays: number;
  /** YYYY-MM-DD of last recorded activity */
  lastActiveDate: string | null;
  totalRides: number;
}

const DEFAULT_STATE: ProgressionState = {
  schemaVersion: PROGRESSION_SCHEMA_VERSION,
  xp: 0,
  streakDays: 0,
  lastActiveDate: null,
  totalRides: 0,
};

export const XP_PER_LEVEL = 500;

export function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);
}

export function xpProgressInLevel(xp: number): { current: number; max: number; pct: number } {
  const level = levelFromXp(xp);
  const base = (level - 1) * XP_PER_LEVEL;
  const current = xp - base;
  const max = XP_PER_LEVEL;
  return { current, max, pct: Math.min(100, (current / max) * 100) };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function loadProgression(): ProgressionState {
  const storage = getAppStorage();
  const raw = storage.getString(STORAGE_KEY);
  if (!raw) return { ...DEFAULT_STATE };
  try {
    const parsed = JSON.parse(raw) as ProgressionState;
    if (parsed.schemaVersion !== PROGRESSION_SCHEMA_VERSION) return { ...DEFAULT_STATE, xp: parsed.xp ?? 0 };
    return parsed;
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveProgression(state: ProgressionState): void {
  getAppStorage().set(STORAGE_KEY, JSON.stringify(state));
}

export function addXp(amount: number): ProgressionState {
  const state = loadProgression();
  const prevLevel = levelFromXp(state.xp);
  state.xp = Math.max(0, state.xp + amount);
  const nextLevel = levelFromXp(state.xp);
  if (nextLevel > prevLevel) {
    trackEngagement('level_up', { level: nextLevel });
  }
  saveProgression(state);
  return state;
}

/** Call when user completes a ride or opens app on ride day. */
export function recordDailyActivity(): ProgressionState {
  const state = loadProgression();
  const today = todayIso();
  if (state.lastActiveDate === today) {
    saveProgression(state);
    return state;
  }
  if (state.lastActiveDate === yesterdayIso()) {
    state.streakDays += 1;
  } else if (state.lastActiveDate !== today) {
    state.streakDays = 1;
  }
  state.lastActiveDate = today;
  saveProgression(state);
  return state;
}

export function recordRideComplete(distanceKm: number, durationMinutes: number): ProgressionState {
  const state = loadProgression();
  state.totalRides += 1;
  const prevLevel = levelFromXp(state.xp);
  state.xp += Math.round(distanceKm * 10 + durationMinutes * 2);
  const nextLevel = levelFromXp(state.xp);
  if (nextLevel > prevLevel) {
    trackEngagement('level_up', { level: nextLevel });
  }
  const today = todayIso();
  if (state.lastActiveDate !== today) {
    if (state.lastActiveDate === yesterdayIso()) {
      state.streakDays += 1;
    } else {
      state.streakDays = 1;
    }
    state.lastActiveDate = today;
    trackEngagement('streak_day', { days: state.streakDays });
  }
  saveProgression(state);
  trackEngagement('ride_complete', {
    distance_km: Math.round(distanceKm * 10) / 10,
    duration_min: Math.round(durationMinutes),
  });
  return state;
}

export function awardQuestXp(amount: number): ProgressionState {
  return addXp(amount);
}
