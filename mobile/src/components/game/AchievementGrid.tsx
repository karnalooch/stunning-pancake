import React from 'react';
import { Image, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { PixelText } from '../PixelText';
import { achievementIcon } from '../../assets/visionAssets';

export interface AchievementItem {
  id: string;
  label: string;
  unlocked: boolean;
}

interface AchievementBadgeProps {
  item: AchievementItem;
  size?: number;
}

/** Single hex-style achievement medal; greyed when locked. */
export const AchievementBadge: React.FC<AchievementBadgeProps> = ({ item, size = 64 }) => {
  const { theme } = useUnistyles();
  const c = theme.colors as Record<string, string>;
  const icon = achievementIcon(item.id);
  const tint = item.unlocked ? c.goldAmber : c.disabledSurface;
  const ink = item.unlocked ? c.onBackground : c.onDisabled;

  return (
    <View style={{ width: size, alignItems: 'center', opacity: item.unlocked ? 1 : 0.55 }}>
      <View
        style={{
          width: size * 0.78,
          height: size * 0.78,
          borderWidth: 2,
          borderColor: c.hudOutline,
          backgroundColor: tint,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate: '45deg' }],
        }}
      >
        {icon ? (
          <Image
            source={icon}
            style={{ width: size * 0.6, height: size * 0.6, transform: [{ rotate: '-45deg' }] }}
            resizeMode="contain"
          />
        ) : (
          <PixelText style={{ fontSize: 8, color: ink, transform: [{ rotate: '-45deg' }] }}>
            {item.label.slice(0, 3)}
          </PixelText>
        )}
      </View>
      <PixelText style={{ fontSize: 6, color: ink, marginTop: 6, textAlign: 'center' }} numberOfLines={1}>
        {item.label}
      </PixelText>
    </View>
  );
};

interface AchievementGridProps {
  items: AchievementItem[];
  columns?: number;
}

/** RPG achievement sheet grid (vision/12_profile.png). */
export const AchievementGrid: React.FC<AchievementGridProps> = ({ items, columns = 5 }) => {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 }}>
      {items.map((item) => (
        <View key={item.id} style={{ width: `${100 / columns}%`, alignItems: 'center' }}>
          <AchievementBadge item={item} />
        </View>
      ))}
    </View>
  );
};
