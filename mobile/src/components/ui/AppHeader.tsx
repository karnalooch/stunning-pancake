import React from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { APP_BRAND_NAME } from '../../theme/brand';
import { pixelShadow } from '../../theme/pixelShadow';
import { ChromeIcon } from './ChromeIcon';
import type { ChromeIconId } from '../../assets/chromeIcons';
import { TextureBackground } from './TextureBackground';

export type AppHeaderAction = {
  icon?: ChromeIconId;
  label?: string;
  onPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
};

export type AppHeaderProps = {
  title?: string;
  showBrand?: boolean;
  rightAction?: AppHeaderAction;
  rightSlot?: React.ReactNode;
  style?: ViewStyle;
  children?: React.ReactNode;
};

const stylesheet = StyleSheet.create((theme) => {
  const c = theme.colors as Record<string, string>;
  return {
    safe: { backgroundColor: c.surfaceContainerLow },
    bar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: c.surfaceContainerLow,
      borderBottomWidth: 3,
      borderBottomColor: c.hudOutline,
    },
    left: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 3,
      borderColor: c.hudOutline,
      backgroundColor: c.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: c.primary,
      textTransform: 'uppercase',
      letterSpacing: -0.5,
    },
    actionBtn: {
      minWidth: 48,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: c.hudOutline,
      borderRadius: 6,
      backgroundColor: c.surface,
      paddingHorizontal: 10,
    },
    actionLabel: {
      fontSize: 9,
      fontFamily: 'PressStart2P',
      color: c.primary,
      textTransform: 'uppercase',
    },
  };
});

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  showBrand = true,
  rightAction,
  rightSlot,
  style,
  children,
}) => {
  const { theme } = useUnistyles();
  const s = stylesheet;
  const c = theme.colors as Record<string, string>;
  const outline = c.hudOutline ?? '#111111';
  const displayTitle = title ?? (showBrand ? APP_BRAND_NAME : '');

  return (
    <SafeAreaView style={[s.safe, style]} edges={['top']}>
      <TextureBackground texture="wood_grain" opacity={0.05} style={[s.bar, pixelShadow(outline, 'sm')]}>
        <View style={s.left}>
          {children}
          <Text style={s.title} numberOfLines={1}>
            {displayTitle}
          </Text>
        </View>
        {rightSlot}
        {rightAction ? (
          <Pressable
            style={({ pressed }) => [s.actionBtn, pressed && { opacity: 0.85 }]}
            onPress={rightAction.onPress}
            testID={rightAction.testID}
            accessibilityRole="button"
            accessibilityLabel={rightAction.accessibilityLabel ?? rightAction.label}
            hitSlop={8}
          >
            {rightAction.icon ? (
              <ChromeIcon id={rightAction.icon} size={22} />
            ) : (
              <Text style={s.actionLabel}>{rightAction.label}</Text>
            )}
          </Pressable>
        ) : null}
      </TextureBackground>
    </SafeAreaView>
  );
};
