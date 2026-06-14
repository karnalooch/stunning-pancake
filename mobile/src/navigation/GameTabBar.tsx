/**
 * GameTabBar — STITCH BottomNavBar (Unistyles-integrated)
 *
 * 4-tab navigation: RIDE, COMPETE, EXPLORE, PROFILE.
 * PNG tab icons via assetRegistry (Grand Prix pack).
 */

import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useUnistyles } from 'react-native-unistyles';
import { useI18n } from '../i18n/useI18n';
import { PixelTabIcon } from '../components/navigation/PixelTabIcon';
import { SoundService } from '../services/SoundService';
import { HapticService } from '../services/HapticService';

const VISIBLE_TAB_NAMES = ['Ride', 'Compete', 'Explore', 'Profile'] as const;

export const GameTabBar: React.FC<BottomTabBarProps> = ({
  state,
  navigation,
}) => {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const c = theme.colors as Record<string, string>;
  const tabLabels = [t.tabs.ride, t.tabs.compete, t.tabs.explore, t.tabs.profile];
  const visibleRoutes = state.routes.filter((route) =>
    VISIBLE_TAB_NAMES.includes(route.name as (typeof VISIBLE_TAB_NAMES)[number]),
  );

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 20,
        paddingTop: 8,
        height: 80,
        backgroundColor: c.parchment,
        borderTopWidth: 2,
        borderTopColor: c.hudOutline,
        shadowColor: c.hudOutline,
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 1,
        shadowRadius: 0,
        elevation: 20,
      }}
    >
      {visibleRoutes.map((route) => {
        const routeIndex = state.routes.findIndex((r) => r.key === route.key);
        const isFocused = state.index === routeIndex;
        const labelIndex = VISIBLE_TAB_NAMES.indexOf(
          route.name as (typeof VISIBLE_TAB_NAMES)[number],
        );
        const label = labelIndex >= 0 ? tabLabels[labelIndex] : route.name;

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
            style={({ pressed }) => [
              {
                flex: 1,
                alignItems: 'center' as const,
                justifyContent: 'center' as const,
                paddingHorizontal: 4,
                paddingVertical: 4,
                borderRadius: 8,
                opacity: pressed ? 0.8 : 1,
              },
              isFocused && {
                backgroundColor: c.primaryContainer,
                borderWidth: 2,
                borderColor: c.hudOutline,
                transform: [{ translateY: -2 }],
                shadowColor: c.hudOutline,
                shadowOffset: { width: 2, height: 2 },
                shadowOpacity: 1,
                shadowRadius: 0,
                elevation: 4,
              },
            ]}
          >
            <PixelTabIcon
              routeName={route.name}
              focused={isFocused}
              activeColor={c.primary}
              inactiveColor={c.secondary}
            />
            <Text
              style={{
                fontSize: 8,
                fontFamily: 'PressStart2P',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                color: isFocused ? c.onPrimaryContainer : c.secondary,
                marginTop: 4,
              }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};
