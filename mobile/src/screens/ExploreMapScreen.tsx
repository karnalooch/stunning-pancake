import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { POIService, type POI } from '../services/api';
import { useI18n } from '../i18n/useI18n';

const stylesheet = StyleSheet.create((theme) => {
  const c = theme.colors as Record<string, string>;
  return {
    container: { flex: 1, backgroundColor: c.background },
    header: { padding: 16, borderBottomWidth: 2, borderBottomColor: c.onBackground },
    title: { fontSize: 20, fontWeight: '700', color: c.primary, textTransform: 'uppercase' },
    hint: { fontSize: 12, color: c.secondary, marginTop: 4 },
    card: {
      marginHorizontal: 16,
      marginTop: 12,
      padding: 14,
      backgroundColor: c.parchment,
      borderWidth: 2,
      borderColor: c.onBackground,
      borderRadius: 8,
    },
    name: { fontSize: 16, fontWeight: '700', color: c.onBackground },
    meta: { fontSize: 12, color: c.secondary, marginTop: 4 },
    empty: { textAlign: 'center', color: c.secondary, marginTop: 32, padding: 16 },
  };
});

export const ExploreMapScreen: React.FC = () => {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const s = stylesheet;
  const c = theme.colors as Record<string, string>;
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    POIService.getPOIs()
      .then((data) => {
        const rows = Array.isArray(data) ? data : data?.results ?? [];
        setPois(rows);
      })
      .catch(() => setPois([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>{t.explore.poiTitle}</Text>
        <Text style={s.hint}>{t.explore.mapHint}</Text>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={c.primary} />
      ) : pois.length === 0 ? (
        <Text style={s.empty}>{t.explore.poiEmpty}</Text>
      ) : (
        <ScrollView>
          {pois.map((p) => (
            <View key={p.id} style={s.card}>
              <Text style={s.name}>{p.name}</Text>
              <Text style={s.meta}>{p.category}</Text>
              {p.description ? <Text style={s.meta}>{p.description}</Text> : null}
              <Text style={s.meta}>
                {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};
