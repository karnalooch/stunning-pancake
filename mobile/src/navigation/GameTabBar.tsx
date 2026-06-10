/**
 * GameTabBar — STITCH BottomNavBar (Unistyles-integrated)
 * 
 * 4-tab navigation: RIDE, COMPETE, EXPLORE, PROFILE.
 * Fully reactive to stitch theme via Unistyles useUnistyles().
 */

import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useUnistyles } from 'react-native-unistyles';
import { stitchTheme } from '../theme/stitch';
import * as Haptics from 'expo-haptics';
import { useI18n } from '../i18n/useI18n';

const TAB_ICONS = ['🚴', '🏆', '🗺️', '👤'] as const;
export const GameTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const c = theme.colors as any;
  const tabLabels = [t.tabs.ride, t.tabs.compete, t.tabs.explore, t.tabs.profile];
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
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderTopWidth: 4,
        borderTopColor: c.onBackground,
        shadowColor: c.onBackground,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 1,
        shadowRadius: 0,
        elevation: 20,
      }}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const tabConfig = {
          icon: TAB_ICONS[index] ?? '📍',
          label: tabLabels[index] ?? (route.name as string),
        };

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
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
                borderColor: c.onBackground,
                transform: [{ translateY: -2 }],
                shadowColor: c.onBackground,
                shadowOffset: { width: 2, height: 2 },
                shadowOpacity: 1,
                shadowRadius: 0,
                elevation: 4,
              },
            ]}
          >
            <Text style={{ fontSize: 20, marginBottom: 2, opacity: isFocused ? 1 : 0.5 }}>
              {tabConfig.icon}
            </Text>
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                color: isFocused ? c.onPrimaryContainer : c.secondary,
              }}
            >
              {tabConfig.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};
