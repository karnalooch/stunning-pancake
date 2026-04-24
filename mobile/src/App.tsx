/**
 * Root Navigation — SPORT Mobile App
 * =====================================
 * Constitution §3: UX Manifesto — App Navigation Structure
 * Constitution §8.2: TypeScript strict mode
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';

import { ActiveSessionScreen } from './screens/ActiveSessionScreen';
import { EventsScreen }        from './screens/EventsScreen';
import { LeaderboardScreen }   from './screens/LeaderboardScreen';

// ---------------------------------------------------------------------------
// TanStack Query client
// ---------------------------------------------------------------------------

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

type TabParamList = {
  Session:     undefined;
  Events:      undefined;
  Leaderboard: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

const SportTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background:  '#0a0e1a',
    card:        '#111827',
    text:        '#ffffff',
    border:      '#1e2a3a',
    primary:     '#00d2ff',
    notification: '#ff4d4d',
  },
};

const TabIcon = ({ emoji, focused }: { emoji: string; focused: boolean }) => (
  <View style={{ alignItems: 'center', justifyContent: 'center', opacity: focused ? 1 : 0.5 }}>
    <Text style={{ fontSize: 22 }}>{emoji}</Text>
  </View>
);

// ---------------------------------------------------------------------------
// App entry point
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer theme={SportTheme}>
        <Tab.Navigator
          screenOptions={{
            headerStyle:         { backgroundColor: '#111827' },
            headerTitleStyle:    { color: '#fff', fontWeight: '800' },
            tabBarStyle:         { backgroundColor: '#111827', borderTopColor: '#1e2a3a', height: 60 },
            tabBarLabelStyle:    { fontSize: 11, fontWeight: '700' },
            tabBarActiveTintColor:   '#00d2ff',
            tabBarInactiveTintColor: '#5a6a7a',
          }}
        >
          <Tab.Screen
            name="Session"
            component={ActiveSessionScreen}
            options={{
              title: 'Sesja',
              tabBarIcon: ({ focused }) => <TabIcon emoji="🏃" focused={focused} />,
            }}
          />
          <Tab.Screen
            name="Events"
            component={EventsScreen}
            options={{
              title: 'Eventy',
              tabBarIcon: ({ focused }) => <TabIcon emoji="🏆" focused={focused} />,
            }}
          />
          <Tab.Screen
            name="Leaderboard"
            options={{
              title: 'Ranking',
              tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} />,
            }}
          >
            {() => <LeaderboardScreen eventId={1} />}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </QueryClientProvider>
  );
}
