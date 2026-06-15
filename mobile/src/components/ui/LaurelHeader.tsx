import React from 'react';
import { View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { PixelText } from '../PixelText';

interface LaurelHeaderProps {
  title: string;
  /** Optional right-side badge (e.g. level chip). */
  right?: React.ReactNode;
}

/** Centered laurel-flanked title bar (vision compete/profile headers). */
export const LaurelHeader: React.FC<LaurelHeaderProps> = ({ title, right }) => {
  const { theme } = useUnistyles();
  const c = theme.colors as Record<string, string>;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        gap: 10,
      }}
    >
      <PixelText style={{ fontSize: 16, color: c.gpForestGreen }}>{'\u2748'}</PixelText>
      <PixelText size="lg" style={{ color: c.onBackground, textTransform: 'uppercase' }}>
        {title}
      </PixelText>
      <PixelText style={{ fontSize: 16, color: c.gpForestGreen }}>{'\u2748'}</PixelText>
      {right ? <View style={{ position: 'absolute', right: 0 }}>{right}</View> : null}
    </View>
  );
};
