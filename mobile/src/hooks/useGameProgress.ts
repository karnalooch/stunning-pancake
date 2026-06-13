import { useCallback, useEffect, useState } from 'react';
import {
  loadProgression,
  recordDailyActivity,
  type ProgressionState,
  levelFromXp,
  xpProgressInLevel,
} from '../game/progression';
import { loadDailyQuests, markRideStarted, type DailyQuestState } from '../game/quests';

export function useGameProgress() {
  const [progression, setProgression] = useState<ProgressionState>(() => loadProgression());
  const [quests, setQuests] = useState<DailyQuestState>(() => loadDailyQuests());

  useEffect(() => {
    setProgression(recordDailyActivity());
    setQuests(loadDailyQuests());
  }, []);

  const refresh = useCallback(() => {
    setProgression(loadProgression());
    setQuests(loadDailyQuests());
  }, []);

  const onStartRide = useCallback(() => {
    setQuests(markRideStarted());
    refresh();
  }, [refresh]);

  const level = levelFromXp(progression.xp);
  const xpBar = xpProgressInLevel(progression.xp);

  return {
    progression,
    quests,
    level,
    xpBar,
    refresh,
    onStartRide,
  };
}
