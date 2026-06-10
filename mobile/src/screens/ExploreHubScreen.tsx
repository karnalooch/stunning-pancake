import React, { useState } from 'react';
import { View, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useI18n } from '../i18n/useI18n';
import { MarketplaceScreen } from './MarketplaceScreen';
import { ExploreMapScreen } from './ExploreMapScreen';

const stylesheet = StyleSheet.create((theme) => {
  const c = theme.colors as Record<string, string>;
  return {
    root: { flex: 1, backgroundColor: c.background },
    tabs: {
      flexDirection: 'row',
      margin: 16,
      marginBottom: 0,
      borderWidth: 2,
      borderColor: c.onBackground,
      borderRadius: 8,
      overflow: 'hidden',
    },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: c.surface },
    tabOn: { backgroundColor: c.primaryContainer },
    tabText: { fontSize: 12, fontWeight: '700', color: c.secondary, textTransform: 'uppercase' },
    tabTextOn: { color: c.onPrimaryContainer },
    body: { flex: 1 },
  };
});

export const ExploreHubScreen: React.FC = () => {
  const { t } = useI18n();
  const s = stylesheet;
  const [tab, setTab] = useState<'shop' | 'map'>('shop');

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.tabs}>
        <Pressable
          style={[s.tab, tab === 'shop' && s.tabOn]}
          onPress={() => setTab('shop')}
        >
          <Text style={[s.tabText, tab === 'shop' && s.tabTextOn]}>{t.explore.shop}</Text>
        </Pressable>
        <Pressable
          style={[s.tab, tab === 'map' && s.tabOn]}
          onPress={() => setTab('map')}
        >
          <Text style={[s.tabText, tab === 'map' && s.tabTextOn]}>{t.explore.map}</Text>
        </Pressable>
      </View>
      <View style={s.body}>
        {tab === 'shop' ? <MarketplaceScreen embedded /> : <ExploreMapScreen />}
      </View>
    </SafeAreaView>
  );
};
