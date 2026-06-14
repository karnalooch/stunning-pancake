import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { isMmkvFallbackActive } from '../services/mmkvSupport';

const stylesheet = StyleSheet.create((theme) => {
  const c = theme.colors as Record<string, string>;
  return {
    banner: {
      backgroundColor: c.tertiaryFixed ?? c.tertiaryContainer,
      borderWidth: 2,
      borderColor: c.onBackground,
      borderRadius: 6,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginHorizontal: 16,
      marginBottom: 8,
    },
    title: {
      fontSize: 12,
      fontWeight: '800',
      color: c.onBackground,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    body: {
      fontSize: 11,
      fontWeight: '600',
      color: c.onBackground,
      lineHeight: 16,
    },
  };
});

/** Shown in __DEV__ when Remote JS Debugging breaks MMKV + POST requests. */
export const DevEnvironmentBanner: React.FC = () => {
  const s = stylesheet;
  if (!__DEV__ || !isMmkvFallbackActive()) return null;

  return (
    <View style={s.banner} accessibilityRole="alert">
      <Text style={s.title}>Tryb debugowania JS</Text>
      <Text style={s.body}>
        Wyłącz Remote JS Debugging w menu deweloperskim (potrząśnij telefonem → Stop
        Debugging). Inaczej POST do API i zapis MMKV nie działają — jazda i onboarding
        mogą się resetować.
      </Text>
    </View>
  );
};
