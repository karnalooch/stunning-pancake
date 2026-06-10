import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useI18n } from '../i18n/useI18n';
import { WearableService } from '../services/api';

const stylesheet = StyleSheet.create((theme) => {
  const c = theme.colors as Record<string, string>;
  return {
    ct: { flex: 1, backgroundColor: c.background },
    h: { padding: 16, borderBottomWidth: 4, borderBottomColor: c.onBackground },
    t: { fontSize: 24, fontWeight: '700', color: c.primary, textTransform: 'uppercase' },
    cd: {
      backgroundColor: c.parchment,
      margin: 12,
      padding: 16,
      borderWidth: 2,
      borderColor: c.onBackground,
      borderRadius: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    l: { fontSize: 14, fontWeight: '700', color: c.onBackground },
    v: { fontSize: 14, color: c.secondary },
  };
});

export const SettingsScreen: React.FC = () => {
  const { theme } = useUnistyles();
  const s = stylesheet;
  const c = theme.colors as Record<string, string>;
  const { t, locale, toggleLocale } = useI18n();
  const [wearables, setWearables] = useState<{
    strava: { connected: boolean; last_sync?: string };
    garmin: { connected: boolean; last_sync?: string };
  } | null>(null);

  useEffect(() => {
    WearableService.getStatus()
      .then(setWearables)
      .catch(() => setWearables(null));
  }, []);

  const fmtWearable = (connected: boolean, lastSync?: string) => {
    if (!connected) return t.settings.notConnected;
    if (lastSync) return `${t.settings.connected} · ${lastSync}`;
    return t.settings.connected;
  };

  const rows = [
    { l: t.settings.strava, v: fmtWearable(wearables?.strava?.connected ?? false, wearables?.strava?.last_sync), dot: wearables?.strava?.connected },
    { l: t.settings.garmin, v: fmtWearable(wearables?.garmin?.connected ?? false, wearables?.garmin?.last_sync), dot: wearables?.garmin?.connected },
    { l: t.settings.riderWeight, v: '72 KG' },
    { l: t.settings.maxHr, v: '192 BPM' },
    { l: t.settings.haptics, v: 'ON' },
  ];

  return (
    <SafeAreaView style={s.ct} edges={['top']}>
      <View style={s.h}>
        <Text style={s.t}>{t.settings.title}</Text>
      </View>
      <ScrollView>
        <Pressable style={s.cd} onPress={toggleLocale}>
          <Text style={s.l}>{t.common.language}</Text>
          <Text style={[s.v, { color: c.primary }]}>{locale === 'pl' ? t.common.polish : t.common.english}</Text>
        </Pressable>
        {rows.map((r, i) => (
          <View key={i} style={s.cd}>
            <Text style={s.l}>{r.l}</Text>
            <Text style={[s.v, r.dot && { color: c.primary }]}>{r.v}{r.dot ? ' ●' : ''}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};
