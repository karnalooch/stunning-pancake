import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { getSemanticColors } from '../../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../../theme/typography';

interface RideNavigationHintProps {
  text?: string | null;
  distanceM?: number | null;
}

const stylesheet = StyleSheet.create((theme) => {
  const c = theme.colors as Record<string, string>;
  const semantic = getSemanticColors(theme.colors);
  return {
    container: {
      borderWidth: 1,
      borderColor: c.hudOutline,
      backgroundColor: c.hudPanel,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 3,
    },
    title: {
      ...PRODUCT_TYPOGRAPHY.metricLabel,
      color: semantic.text.secondary,
      textTransform: 'uppercase',
    },
    body: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: c.hudOutline,
    },
  };
});

export const RideNavigationHint: React.FC<RideNavigationHintProps> = ({
  text,
  distanceM,
}) => {
  const s = stylesheet;
  if (!text) return null;

  const distanceLabel =
    distanceM != null && Number.isFinite(distanceM)
      ? `${Math.max(0, Math.round(distanceM))} m`
      : '—';

  return (
    <View style={s.container}>
      <Text style={s.title}>Navigation</Text>
      <Text style={s.body}>{text}</Text>
      <Text style={s.body}>Next in {distanceLabel}</Text>
    </View>
  );
};
