import React from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { TamaguiProvider, YStack, Text as TamaText, Input, Button as TamaButton, H1, Paragraph } from 'tamagui';
import { observer, useObservable } from '@legendapp/state/react';
import tamaguiConfig from './tamagui.config';

import { Home, History, Gift, User, Trophy } from 'lucide-react-native';
import { Theme } from './src/theme/Theme';

// Screens
import { TrackingScreen } from './src/screens/TrackingScreen';
import { ActivitiesScreen } from './src/screens/ActivitiesScreen';
import { RewardsScreen } from './src/screens/RewardsScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

const GEOFENCE_TASK_NAME = 'poi-geofence-task';

const HomeIcon = Home as any;
const HistoryIcon = History as any;
const GiftIcon = Gift as any;
const UserIcon = User as any;
const TrophyIcon = Trophy as any;

const Tab = createBottomTabNavigator();

export default observer(function App() {
  const auth = useObservable({
    isAuthenticated: false,
    mode: 'login' as 'login' | 'register'
  });

  const renderContent = () => {
    if (!auth.isAuthenticated.get()) {
      return (
        <YStack flex={1} backgroundColor="$background" justifyContent="center" padding="$6" gap="$4">
          <H1 textAlign="center" fontWeight="900" color="$white">
            SPORT<TamaText color="$blue10">.</TamaText>
          </H1>
          
          <YStack gap="$2" marginBottom="$4">
            <H1 fontSize={24} color="$white">
              {auth.mode.get() === 'login' ? 'Welcome Back' : 'Create Account'}
            </H1>
            <Paragraph color="$gray10">
              The high-performance sports engine.
            </Paragraph>
          </YStack>

          <Input 
            size="$5"
            placeholder="Email" 
            backgroundColor="$gray1" 
            borderWidth={1} 
            borderColor="$gray4"
            hoverStyle={{ borderColor: '$blue10' }}
            focusStyle={{ borderColor: '$blue10' }}
          />
          <Input 
            size="$5"
            placeholder="Password" 
            secureTextEntry 
            backgroundColor="$gray1" 
            borderWidth={1} 
            borderColor="$gray4"
          />

          <TamaButton 
            marginTop="$2"
            size="$5"
            backgroundColor="$blue10"
            onPress={() => auth.isAuthenticated.set(true)}
          >
            <TamaText fontWeight="900" color="white">
              {auth.mode.get() === 'login' ? 'SIGN IN' : 'REGISTER'}
            </TamaText>
          </TamaButton>

          <TamaButton 
            chromeless
            onPress={() => auth.mode.set(auth.mode.get() === 'login' ? 'register' : 'login')}
          >
            <TamaText color="$gray10" textAlign="center">
              {auth.mode.get() === 'login' ? "New here? Join the movement" : "Already a member? Login"}
            </TamaText>
          </TamaButton>
        </YStack>
      );
    }

    return (
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarStyle: { 
              backgroundColor: Theme.colors.card, 
              borderTopWidth: 0,
              height: 90,
              paddingBottom: 30
            },
            tabBarActiveTintColor: Theme.colors.primary,
            tabBarInactiveTintColor: Theme.colors.textMuted,
            tabBarIcon: ({ color, size }) => {
              if (route.name === 'Home') return <HomeIcon size={size} color={color} />;
              if (route.name === 'History') return <HistoryIcon size={size} color={color} />;
              if (route.name === 'Ranking') return <TrophyIcon size={size} color={color} />;
              if (route.name === 'Rewards') return <GiftIcon size={size} color={color} />;
              if (route.name === 'Profile') return <UserIcon size={size} color={color} />;
            },
          })}
        >
          <Tab.Screen name="Home" component={TrackingScreen} />
          <Tab.Screen name="History" component={ActivitiesScreen} />
          <Tab.Screen name="Ranking" component={LeaderboardScreen} />
          <Tab.Screen name="Rewards" component={RewardsScreen} />
          <Tab.Screen name="Profile">
            {() => <ProfileScreen onLogout={() => auth.isAuthenticated.set(false)} />}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    );
  };

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
      {renderContent()}
    </TamaguiProvider>
  );
});
