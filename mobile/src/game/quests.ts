import { getAppStorage } from '../bootstrap/storage';
import { awardQuestXp } from './progression';
import { triggerEngine, TriggerPriority } from '../services/TriggerEngine';
import { trackEngagement } from '../services/EngagementAnalytics';

export type QuestMetric = 'distance_km' | 'duration_min' | 'ride_started';

export interface DailyQuest {
  id: string;
  title: string;
  description: string;
  metric: QuestMetric;
  target: number;
  progress: number;
  xpReward: number;
  completed: boolean;
}

export interface DailyQuestState {
  date: string;
  quests: DailyQuest[];
}

const STORAGE_KEY = 'daily_quests_v1';

const QUEST_TEMPLATES: Omit<DailyQuest, 'progress' | 'completed'>[] = [
  {
    id: 'daily_distance_5',
    title: 'Road Warrior',
    description: 'Ride 5 km today',
    metric: 'distance_km',
    target: 5,
    xpReward: 75,
  },
  {
    id: 'daily_duration_30',
    title: 'Endurance',
    description: 'Ride 30 minutes',
    metric: 'duration_min',
    target: 30,
    xpReward: 50,
  },
  {
    id: 'daily_start_ride',
    title: 'Kick Off',
    description: 'Start a ride session',
    metric: 'ride_started',
    target: 1,
    xpReward: 25,
  },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function freshQuests(): DailyQuest[] {
  return QUEST_TEMPLATES.map((q) => ({
    ...q,
    progress: 0,
    completed: false,
  }));
}

export function loadDailyQuests(): DailyQuestState {
  const storage = getAppStorage();
  const raw = storage.getString(STORAGE_KEY);
  const today = todayIso();
  if (!raw) {
    return { date: today, quests: freshQuests() };
  }
  try {
    const parsed = JSON.parse(raw) as DailyQuestState;
    if (parsed.date !== today) {
      return { date: today, quests: freshQuests() };
    }
    return parsed;
  } catch {
    return { date: today, quests: freshQuests() };
  }
}

function saveDailyQuests(state: DailyQuestState): void {
  getAppStorage().set(STORAGE_KEY, JSON.stringify(state));
}

function completeQuest(quest: DailyQuest): void {
  quest.completed = true;
  quest.progress = quest.target;
  awardQuestXp(quest.xpReward);
  trackEngagement('quest_complete', { quest_id: quest.id, xp: quest.xpReward });
  triggerEngine.push({
    id: `quest_${quest.id}_${todayIso()}`,
    title: 'QUEST COMPLETE',
    message: `${quest.title} — +${quest.xpReward} XP`,
    character: 'cyclist',
    priority: TriggerPriority.HIGH,
    category: 'CELEBRATION',
  });
}

export function updateQuestProgress(
  metric: QuestMetric,
  value: number,
): DailyQuestState {
  const state = loadDailyQuests();
  for (const quest of state.quests) {
    if (quest.completed || quest.metric !== metric) continue;
    quest.progress =
      metric === 'ride_started' ? 1 : Math.min(quest.target, Math.max(quest.progress, value));
    if (quest.progress >= quest.target) {
      completeQuest(quest);
    }
  }
  saveDailyQuests(state);
  return state;
}

export function markRideStarted(): DailyQuestState {
  return updateQuestProgress('ride_started', 1);
}

export function syncRideQuestProgress(distanceKm: number, durationMin: number): DailyQuestState {
  let state = loadDailyQuests();
  state = updateQuestProgress('distance_km', distanceKm);
  state = updateQuestProgress('duration_min', durationMin);
  return state;
}
