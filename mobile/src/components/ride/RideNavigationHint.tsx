import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

interface RideNavigationHintProps {
  text?: string | null;
  distanceM?: number | null;
}

const stylesheet = StyleSheet.create((theme) => {
  const c = theme.colors as Record<string, string>;
  return {
    container: {
      borderWidth: 2,
      borderColor: c.hudOutline,
      backgroundColor: c.hudPanel,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      shadowColor: c.hudOutline,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
      gap: 2,
    },
    title: {
      color: c.secondary,
      fontSize: 9,
      fontFamily: 'PressStart2P',
      textTransform: 'uppercase',
    },
    body: {
      color: c.hudOutline,
      fontSize: 11,
      fontFamily: 'VT323',
    },
  };
});

export const RideNavigationHint: React.FC<RideNavigationHintProps> = ({
  text,
  distanceM,
}) => {
  const { theme } = useUnistyles();
  const s = stylesheet;
  const c = theme.colors as Record<string, string>;
  if (!text) return null;

  const distanceLabel =
    distanceM != null && Number.isFinite(distanceM)
      ? `${Math.max(0, Math.round(distanceM))} m`
      : '—';

  return (
    <View style={s.container}>
      <Text style={s.title}>Navigation</Text>
      <Text style={[s.body, { color: c.hudOutline }]}>{text}</Text>
      <Text style={s.body}>Next in {distanceLabel}</Text>
    </View>
  );
};
