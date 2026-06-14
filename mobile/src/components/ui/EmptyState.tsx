import React from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { ChromeIcon } from './ChromeIcon';
import type { ChromeIconId } from '../../assets/chromeIcons';

interface EmptyStateProps {
  message: string;
  hint?: string;
  icon?: ChromeIconId;
  style?: ViewStyle;
}

const stylesheet = StyleSheet.create((theme) => {
  const c = theme.colors as Record<string, string>;
  return {
    root: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 24,
      paddingHorizontal: 16,
      gap: 8,
    },
    message: {
      fontSize: 14,
      fontWeight: '700',
      color: c.onBackground,
      textAlign: 'center',
    },
    hint: {
      fontSize: 12,
      fontWeight: '600',
      color: c.secondary,
      textAlign: 'center',
      lineHeight: 18,
    },
  };
});

export const EmptyState: React.FC<EmptyStateProps> = ({ message, hint, icon, style }) => {
  const s = stylesheet;
  return (
    <View style={[s.root, style]}>
      {icon ? <ChromeIcon id={icon} size={32} /> : null}
      <Text style={s.message}>{message}</Text>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
};
