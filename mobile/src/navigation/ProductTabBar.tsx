import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { StyleSheet } from 'react-native-unistyles';

import { useI18n } from '../i18n/useI18n';
import { HapticService } from '../services/HapticService';
import { SoundService } from '../services/SoundService';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';

const VISIBLE_TAB_NAMES = ['Today', 'Discover', 'StartRide', 'Club', 'You'] as const;

const GLYPHS: Record<(typeof VISIBLE_TAB_NAMES)[number], string> = {
  Today: '●',
  Discover: '⌖',
  StartRide: '▲',
  Club: '◆',
  You: '◉',
};

const stylesheet = StyleSheet.create((theme) => {
  const semantic = getSemanticColors(theme.colors);

  return {
    root: {
      minHeight: 76,
      paddingHorizontal: 8,
      paddingTop: 8,
      paddingBottom: 16,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 4,
      backgroundColor: semantic.navigation.shell,
      borderTopWidth: 1,
      borderTopColor: semantic.border.strong,
    },
    item: {
      flex: 1,
      minHeight: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      gap: 2,
    },
    itemPressed: {
      opacity: 0.78,
    },
    itemFocused: {
      backgroundColor: semantic.navigation.activeBackground,
    },
    startItem: {
      minHeight: 58,
      backgroundColor: semantic.action.primary,
    },
    startItemPressed: {
      backgroundColor: semantic.action.primaryPressed,
    },
    glyph: {
      fontSize: 18,
      lineHeight: 20,
      color: semantic.navigation.inactiveContent,
    },
    glyphFocused: {
      color: semantic.navigation.activeContent,
    },
    glyphStart: {
      color: semantic.text.onAction,
    },
    label: {
      ...PRODUCT_TYPOGRAPHY.metricLabel,
      fontSize: 10,
      lineHeight: 12,
      color: semantic.navigation.inactiveContent,
      textAlign: 'center',
    },
    labelFocused: {
      color: semantic.navigation.activeContent,
    },
    labelStart: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      fontSize: 10,
      lineHeight: 12,
      color: semantic.text.onAction,
    },
  };
});

export const ProductTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const { t } = useI18n();
  const s = stylesheet;
  const labels: Record<(typeof VISIBLE_TAB_NAMES)[number], string> = {
    Today: t.tabs.today,
    Discover: t.tabs.discover,
    StartRide: t.tabs.startRide,
    Club: t.tabs.club,
    You: t.tabs.you,
  };

  const visibleRoutes = state.routes.filter((route) =>
    VISIBLE_TAB_NAMES.includes(route.name as (typeof VISIBLE_TAB_NAMES)[number]),
  );

  return (
    <View style={s.root}>
      {visibleRoutes.map((route) => {
        const name = route.name as (typeof VISIBLE_TAB_NAMES)[number];
        const routeIndex = state.routes.findIndex((candidate) => candidate.key === route.key);
        const isFocused = state.index === routeIndex;
        const isStart = name === 'StartRide';
        const label = labels[name];

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            HapticService.trigger('tab_switch');
            void SoundService.play('ui_click');
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            testID={`tab-${name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: isFocused }}
            style={({ pressed }) => [
              s.item,
              isFocused && !isStart && s.itemFocused,
              isStart && s.startItem,
              pressed && !isStart && s.itemPressed,
              pressed && isStart && s.startItemPressed,
            ]}
          >
            <Text
              allowFontScaling={false}
              accessibilityElementsHidden
              style={[
                s.glyph,
                isFocused && !isStart && s.glyphFocused,
                isStart && s.glyphStart,
              ]}
            >
              {GLYPHS[name]}
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={[
                s.label,
                isFocused && !isStart && s.labelFocused,
                isStart && s.labelStart,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};
