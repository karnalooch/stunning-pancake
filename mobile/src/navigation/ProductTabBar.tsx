import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useUnistyles } from 'react-native-unistyles';
import { useI18n } from '../i18n/useI18n';
import { HapticService } from '../services/HapticService';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';
import { getAppCopy } from '../components/roadbook/appCopy';
import { ProductTabIcon } from './ProductTabIcon';

export const VISIBLE_TAB_NAMES = ['Today', 'Discover', 'Club', 'You'] as const;
type Destination = typeof VISIBLE_TAB_NAMES[number];

export const ProductTabBar: React.FC<BottomTabBarProps> = ({ state, navigation, insets }) => {
  const { theme } = useUnistyles();
  const { locale } = useI18n();
  const c = getSemanticColors(theme.colors);
  const copy = getAppCopy(locale);
  const labels: Record<Destination, string> = { Today: copy.ride, Discover: copy.discover, Club: copy.club, You: copy.you };
  return <View testID="roadbook-tab-bar" style={{ paddingHorizontal: 8, paddingTop: 8,
    paddingBottom: Math.max(8, insets.bottom), flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: c.navigation.shell, borderTopWidth: 1, borderColor: c.border.subtle }}>
    {state.routes.filter((route) => VISIBLE_TAB_NAMES.includes(route.name as Destination)).map((route) => {
      const name = route.name as Destination;
      const selected = state.routes[state.index]?.key === route.key;
      const color = selected ? c.navigation.active : c.navigation.inactive;
      return <Pressable key={route.key} testID={`tab-${name.toLowerCase()}`} accessibilityRole="tab"
        accessibilityLabel={labels[name]} accessibilityState={{ selected }}
        onPress={() => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!selected && !event.defaultPrevented) {
            HapticService.trigger('tab_switch');
            navigation.navigate(route.name, route.params);
          }
        }}
        onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
        style={({ pressed }) => ({ flex: 1, minHeight: 56, paddingVertical: 8, paddingHorizontal: 4,
          alignItems: 'center', justifyContent: 'center', gap: 5,
          backgroundColor: pressed ? c.surface.raised : c.navigation.shell,
          borderTopWidth: 2, borderTopColor: selected ? color : c.navigation.shell })}>
        <ProductTabIcon routeName={name} color={color} size={22} />
        <Text style={{ ...PRODUCT_TYPOGRAPHY.metricLabel, color, textAlign: 'center' }}>{labels[name]}</Text>
      </Pressable>;
    })}
  </View>;
};
