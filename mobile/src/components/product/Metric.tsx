import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { getSemanticColors } from '../../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../../theme/typography';

interface MetricProps {
  value: string;
  label: string;
  testID?: string;
}

const stylesheet = StyleSheet.create((theme) => {
  const semantic = getSemanticColors(theme.colors);

  return {
    root: {
      gap: 2,
    },
    value: {
      ...PRODUCT_TYPOGRAPHY.metric,
      color: semantic.text.primary,
    },
    label: {
      ...PRODUCT_TYPOGRAPHY.metricLabel,
      color: semantic.text.secondary,
    },
  };
});

export const Metric: React.FC<MetricProps> = ({ value, label, testID }) => {
  const s = stylesheet;

  return (
    <View testID={testID} style={s.root}>
      <Text style={s.value}>{value}</Text>
      <Text style={s.label}>{label}</Text>
    </View>
  );
};
