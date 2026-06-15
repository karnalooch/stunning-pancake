import React from 'react';
import { View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { PixelText } from '../PixelText';
import { CrestIcon } from '../ui/CrestIcon';

interface Side {
  name: string;
  score: number;
}

interface VersusBarProps {
  left: Side;
  right: Side;
}

/** City Wars VS bar with crests + split score progress (vision/05_compete_hub.png). */
export const VersusBar: React.FC<VersusBarProps> = ({ left, right }) => {
  const { theme } = useUnistyles();
  const c = theme.colors as Record<string, string>;
  const total = Math.max(1, left.score + right.score);
  const leftPct = Math.max(1, Math.round((left.score / total) * 100));

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <CrestIcon tenant={left.name} size={28} />
          <View>
            <PixelText size="sm" style={{ color: c.primary }}>{left.name.toUpperCase()}</PixelText>
            <PixelText size="md" style={{ color: c.primary }}>{left.score}</PixelText>
          </View>
        </View>
        <PixelText size="md" style={{ color: c.rival }}>VS</PixelText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
          <View style={{ alignItems: 'flex-end' }}>
            <PixelText size="sm" style={{ color: c.onBackground }}>{right.name.toUpperCase()}</PixelText>
            <PixelText size="md" style={{ color: c.onBackground }}>{right.score}</PixelText>
          </View>
          <CrestIcon tenant={right.name} size={28} />
        </View>
      </View>
      <View
        style={{
          height: 14,
          flexDirection: 'row',
          borderWidth: 2,
          borderColor: c.hudOutline,
          backgroundColor: c.outlineVariant,
          overflow: 'hidden',
        }}
      >
        <View style={{ width: `${leftPct}%`, backgroundColor: c.primary }} />
        <View style={{ flex: 1, backgroundColor: c.rival }} />
      </View>
    </View>
  );
};
