import TabHome from '../../assets/generated/icons/tab_home.svg';
import TabRanking from '../../assets/generated/icons/tab_ranking.svg';
import TabRewards from '../../assets/generated/icons/tab_rewards.svg';
import TabProfile from '../../assets/generated/icons/tab_profile.svg';

import type { FC } from 'react';
import type { SvgProps } from 'react-native-svg';

export type TabRouteName = 'Ride' | 'Compete' | 'Explore' | 'Profile';

export const PIXEL_TAB_ICONS: Record<TabRouteName, FC<SvgProps>> = {
  Ride: TabHome,
  Compete: TabRanking,
  Explore: TabRewards,
  Profile: TabProfile,
};

export const TAB_EMOJI_FALLBACK: Record<TabRouteName, string> = {
  Ride: '🚴',
  Compete: '🏆',
  Explore: '🗺️',
  Profile: '👤',
};
