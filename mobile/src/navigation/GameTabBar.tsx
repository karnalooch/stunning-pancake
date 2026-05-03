import React from 'react';
import { View, Pressable, Image } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { PixelText } from './PixelText';
import * as Haptics from 'expo-haptics';

const NAV_ICONS: Record<string, any> = {
  Home: require('../../../assets/generated/nav_home.png'),
  History: require('../../../assets/generated/nav_history.png'),
  Ranking: require('../../../assets/generated/nav_ranking.png'),
  Rewards: require('../../../assets/generated/nav_rewards.png'),
  Profile: require('../../../assets/generated/nav_profile.png'),
};

export const GameTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: '#0B1D33', // Deep Sea Dark
      borderTopWidth: 3,
      borderTopColor: '#D4A373', // Gold
      height: 75,
      paddingBottom: 20, // safe area offset approximation
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 20,
    }}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate(route.name);
          }
        };

        const iconSource = NAV_ICONS[route.name as keyof typeof NAV_ICONS];

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 10,
              // Background highlight for focused tab
              backgroundColor: isFocused ? 'rgba(212, 163, 115, 0.15)' : 'transparent',
              borderTopWidth: isFocused ? 2 : 0,
              borderTopColor: '#D4A373',
              marginTop: isFocused ? -3 : 0, // pull up slightly
            }}
          >
            {iconSource ? (
              <Image 
                source={iconSource} 
                style={{ 
                  width: 24, 
                  height: 24, 
                  opacity: isFocused ? 1 : 0.4,
                  tintColor: isFocused ? undefined : '#8B7355' // Muted gold if not focused
                }} 
                resizeMode="contain" 
              />
            ) : null}
            <PixelText 
              color={isFocused ? '#D4A373' : '#8B7355'} 
              size={8} 
              style={{ marginTop: 4 }}
            >
              {label as string}
            </PixelText>
          </Pressable>
        );
      })}
    </View>
  );
};
