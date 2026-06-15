import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { pixelShadow } from '../../theme/pixelShadow';
import { FONTS } from '../../theme/fonts';

interface StackScreenHeaderProps {
  title: string;
  onBack: () => void;
}

const stylesheet = StyleSheet.create((theme) => {
  const c = theme.colors as Record<string, string>;
  return {
    safe: { backgroundColor: c.surfaceContainerLow },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 3,
      borderBottomColor: c.hudOutline,
      backgroundColor: c.surfaceContainerLow,
      gap: 12,
    },
    back: {
      minWidth: 48,
      minHeight: 48,
      justifyContent: 'center',
      alignItems: 'center',
    },
    backText: { fontSize: 24, color: c.primary, fontWeight: '700' },
    title: {
      flex: 1,
      fontSize: 14,
      fontFamily: FONTS.display,
      color: c.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
  };
});

export const StackScreenHeader: React.FC<StackScreenHeaderProps> = ({ title, onBack }) => {
  const s = stylesheet;
  const { theme } = useUnistyles();
  const c = theme.colors as Record<string, string>;
  const outline = c.hudOutline ?? '#111111';
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={[s.bar, pixelShadow(outline, 'sm')]}>
        <Pressable style={s.back} onPress={onBack} accessibilityRole="button" hitSlop={8}>
          <Text style={s.backText}>←</Text>
        </Pressable>
        <Text style={s.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </SafeAreaView>
  );
};
