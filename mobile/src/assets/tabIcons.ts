import { ASSETS } from './assetRegistry';
import type { RideRank } from '../game/ranks';

export type TabRouteName = 'Ride' | 'Compete' | 'Explore' | 'Profile';

export const PIXEL_TAB_ICONS = {
  Ride: ASSETS.icons.tab_home,
  Compete: ASSETS.icons.tab_ranking,
  Explore: ASSETS.icons.tab_rewards,
  Profile: ASSETS.icons.tab_profile,
} as const satisfies Record<TabRouteName, number>;

export const GRADE_ICONS: Record<RideRank, number> = {
  S: ASSETS.icons.grade_s,
  A: ASSETS.icons.grade_a,
  B: ASSETS.icons.grade_b,
  C: ASSETS.icons.grade_c,
};

export const CURRENCY_ICONS = {
  xp: ASSETS.icons.currency_xp,
  coin: ASSETS.icons.currency_coin,
  energy: ASSETS.icons.currency_energy,
} as const;

export const POWER_ICONS = {
  speed: ASSETS.icons.power_speed,
  shield: ASSETS.icons.power_shield,
  double_xp: ASSETS.icons.power_double_xp,
  gps: ASSETS.icons.power_gps,
} as const;
