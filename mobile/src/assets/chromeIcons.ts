import { ASSETS, type IconId } from './assetRegistry';

/** Grand Prix PNG mapping for in-screen chrome (replaces emoji). */
export const CHROME_ICONS = {
  settings: ASSETS.icons.power_gps,
  cityWars: ASSETS.icons.power_shield,
  leaderboard: ASSETS.icons.tab_ranking,
  quests: ASSETS.icons.tab_history,
  clubs: ASSETS.icons.tab_rewards,
  segments: ASSETS.icons.grade_s,
  cityStar: ASSETS.icons.currency_coin,
  streak: ASSETS.icons.currency_energy,
  training: ASSETS.icons.tab_history,
  map: ASSETS.icons.power_gps,
  shop: ASSETS.icons.tab_rewards,
  calendar: ASSETS.icons.tab_history,
  completed: ASSETS.icons.power_shield,
  share: ASSETS.icons.tab_rewards,
  download: ASSETS.icons.tab_history,
  performance: ASSETS.icons.power_speed,
} as const satisfies Record<string, (typeof ASSETS.icons)[IconId]>;

export type ChromeIconId = keyof typeof CHROME_ICONS;
