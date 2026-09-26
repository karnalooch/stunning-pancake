import React from 'react';
import { Text } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

export type ChromeIconId =
  | 'settings'
  | 'cityWars'
  | 'leaderboard'
  | 'quests'
  | 'clubs'
  | 'segments'
  | 'cityStar'
  | 'streak'
  | 'training'
  | 'map'
  | 'shop'
  | 'calendar'
  | 'completed'
  | 'share'
  | 'download'
  | 'performance';

const GLYPHS: Record<ChromeIconId, string> = {
  settings: '⚙',
  cityWars: '◆',
  leaderboard: '▥',
  quests: '✓',
  clubs: '◎',
  segments: '△',
  cityStar: '★',
  streak: '↗',
  training: '▤',
  map: '⌖',
  shop: '□',
  calendar: '▦',
  completed: '✓',
  share: '↗',
  download: '↓',
  performance: '▥',
};

interface ChromeIconProps {
  id: ChromeIconId;
  size?: number;
  baseSize?: number;
}

export const ChromeIcon: React.FC<ChromeIconProps> = ({ id, size = 20 }) => {
  const { theme } = useUnistyles();
  const c = theme.colors as Record<string, string>;
  return (
    <Text
      allowFontScaling={false}
      accessibilityElementsHidden
      style={{ fontSize: size, lineHeight: size + 2, color: c.onBackground ?? '#f3efe4' }}
    >
      {GLYPHS[id]}
    </Text>
  );
};
