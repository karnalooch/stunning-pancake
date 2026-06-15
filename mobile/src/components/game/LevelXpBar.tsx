import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { PixelIcon } from '../ui/PixelIcon';
import { CURRENCY_ICONS } from '../../assets/tabIcons';
import { TextureBackground } from '../ui/TextureBackground';
import { FONTS } from '../../theme/fonts';

interface LevelXpBarProps {
  level: number;
  xpCurrent: number;
  xpMax: number;
  pct: number;
}

export const LevelXpBar: React.FC<LevelXpBarProps> = ({
  level,
  xpCurrent,
  xpMax,
  pct,
}) => {
  const { theme } = useUnistyles();
  const c = theme.colors as Record<string, string>;

  return (
    <TextureBackground
      texture="parchment_grain"
      opacity={0.07}
      style={[styles.wrap, { borderColor: c.hudOutline, backgroundColor: c.parchment }]}
    >
      <View style={styles.header}>
        <PixelIcon source={CURRENCY_ICONS.xp} size={16} baseSize={16} />
        <Text style={[styles.level, { color: c.primary, fontFamily: FONTS.display }]}>LVL {level}</Text>
      </View>
      <View style={[styles.track, { borderColor: c.hudOutline, backgroundColor: c.surfaceContainerHigh }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: c.primaryFixed }]} />
      </View>
      <Text style={[styles.xp, { color: c.secondary, fontFamily: 'VT323', fontSize: 14 }]}>
        {xpCurrent}/{xpMax} XP
      </Text>
    </TextureBackground>
  );
};

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 2,
    borderRadius: 8,
    padding: 8,
    gap: 4,
    minWidth: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  level: {
    fontSize: 10,
    textAlign: 'center',
  },
  track: {
    height: 10,
    borderWidth: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: { height: '100%' },
  xp: {
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
