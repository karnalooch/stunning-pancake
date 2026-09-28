import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useUnistyles } from 'react-native-unistyles';

import { useI18n } from '../i18n/useI18n';
import { HapticService } from '../services/HapticService';
import { SoundService } from '../services/SoundService';
import { getSemanticColors } from '../theme/semantic';
import { ProductTabIcon, type ProductTabName } from './ProductTabIcon';

const VISIBLE_TAB_NAMES: readonly ProductTabName[] = [
  'Today',
  'Discover',
  'StartRide',
  'Club',
  'You',
];

export const ProductTabBar: React.FC<BottomTabBarProps> = ({
  state,
  navigation,
}) => {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const semantic = getSemanticColors(theme.colors);
  const labels: Record<ProductTabName, string> = {
    Today: t.tabs.today,
    Discover: t.tabs.discover,
    StartRide: t.tabs.startRide,
    Club: t.tabs.club,
    You: t.tabs.you,
  };

  const visibleRoutes = state.routes.filter((route) =>
    VISIBLE_TAB_NAMES.includes(route.name as ProductTabName),
  );

  return (
    <View
      style={{
        minHeight: 84,
        paddingHorizontal: 8,
        paddingTop: 8,
        paddingBottom: 18,
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: semantic.navigation.shell,
        borderTopWidth: 1,
        borderTopColor: semantic.border.strong,
      }}
    >
      {visibleRoutes.map((route) => {
        const routeName = route.name as ProductTabName;
        const routeIndex = state.routes.findIndex((item) => item.key === route.key);
        const isFocused = state.index === routeIndex;
        const isStartRide = routeName === 'StartRide';
        const iconColor = isStartRide
          ? semantic.text.onAction
          : isFocused
            ? semantic.navigation.active
            : semantic.navigation.inactive;

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
            accessibilityRole="button"
            accessibilityLabel={labels[routeName]}
            accessibilityState={isFocused ? { selected: true } : {}}
            testID={`tab-${routeName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`}
            onPress={onPress}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 52,
              marginHorizontal: 2,
              paddingHorizontal: 2,
              paddingVertical: isStartRide ? 8 : 5,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              borderRadius: isStartRide ? 18 : 12,
              backgroundColor: isStartRide
                ? pressed
                  ? semantic.action.primaryPressed
                  : semantic.action.primary
                : 'transparent',
              borderTopWidth: !isStartRide && isFocused ? 2 : 0,
              borderTopColor: semantic.navigation.active,
              transform: isStartRide ? [{ translateY: -7 }] : undefined,
              opacity: pressed && !isStartRide ? 0.72 : 1,
            })}
          >
            <ProductTabIcon routeName={routeName} color={iconColor} size={isStartRide ? 24 : 22} />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
              style={{
                fontSize: 11,
                lineHeight: 14,
                fontWeight: isFocused || isStartRide ? '700' : '500',
                color: iconColor,
                textAlign: 'center',
              }}
            >
              {labels[routeName]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};
