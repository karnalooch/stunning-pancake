import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import * as Haptics from 'expo-haptics';
import { useI18n } from '../i18n/useI18n';
import { PrivacyService, WearableService } from '../services/api';
import { useImmersiveTheme } from '../hooks/useImmersiveTheme';
import { RiderPreferencesService } from '../services/RiderPreferencesService';

type SettingsSection = 'general' | 'sensors' | 'privacy' | 'garage';

const stylesheet = StyleSheet.create((theme) => {
  const c = theme.colors as Record<string, string>;
  return {
    ct: { flex: 1, backgroundColor: c.background },
    h: { padding: 16, borderBottomWidth: 4, borderBottomColor: c.onBackground },
    t: { fontSize: 24, fontWeight: '700', color: c.primary, textTransform: 'uppercase' },
    nav: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 2,
      borderBottomColor: c.hudOutline,
      flexDirection: 'row',
      gap: 8,
    },
    navBtn: {
      borderWidth: 2,
      borderColor: c.hudOutline,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: c.surface,
    },
    navBtnActive: {
      backgroundColor: c.primaryContainer,
      transform: [{ translateY: -1 }],
    },
    navBtnText: {
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      color: c.onBackground,
    },
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
    sectionTitle: {
      marginHorizontal: 12,
      marginTop: 12,
      fontSize: 11,
      fontWeight: '700',
      color: c.secondary,
      textTransform: 'uppercase',
    },
    stepRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    stepBtn: {
      width: 32,
      height: 32,
      borderWidth: 2,
      borderColor: c.onBackground,
      borderRadius: 4,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },
    stepBtnText: { fontSize: 18, fontWeight: '700', color: c.onBackground },
    input: {
      minWidth: 72,
      borderWidth: 2,
      borderColor: c.hudOutline,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 16,
      fontWeight: '700',
      color: c.onBackground,
      textAlign: 'center',
      backgroundColor: c.surface,
    },
    actionBtn: {
      marginHorizontal: 12,
      marginBottom: 8,
      borderWidth: 2,
      borderColor: c.hudOutline,
      borderRadius: 6,
      backgroundColor: c.primaryContainer,
      paddingHorizontal: 14,
      paddingVertical: 12,
      alignItems: 'center',
    },
    actionBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: c.onPrimaryContainer,
      textTransform: 'uppercase',
    },
  };
});

interface SettingsScreenProps {
  /** When true, stack header is provided by parent — hide local title bar. */
  embedded?: boolean;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ embedded = false }) => {
  const { theme } = useUnistyles();
  const s = stylesheet;
  const c = theme.colors as Record<string, string>;
  const { t, locale, toggleLocale } = useI18n();
  const { enabled: immersiveEnabled, toggle: toggleImmersive } = useImmersiveTheme();
  const [section, setSection] = useState<SettingsSection>('general');
  const [wearables, setWearables] = useState<{
    strava: { connected: boolean; last_sync?: string };
    garmin: { connected: boolean; last_sync?: string };
  } | null>(null);
  const [privacyZoneCount, setPrivacyZoneCount] = useState<number | null>(null);
  const [weightKg, setWeightKg] = useState(RiderPreferencesService.getWeightKg());
  const [maxHr, setMaxHr] = useState(RiderPreferencesService.getMaxHr());
  const [haptics, setHaptics] = useState(RiderPreferencesService.isHapticsEnabled());
  const [voiceCues, setVoiceCues] = useState(RiderPreferencesService.isVoiceCuesEnabled());

  useEffect(() => {
    WearableService.getStatus()
      .then(setWearables)
      .catch(() => setWearables(null));
    PrivacyService.getZones()
      .then((rows) => setPrivacyZoneCount(Array.isArray(rows) ? rows.length : 0))
      .catch(() => setPrivacyZoneCount(null));
  }, []);

  const fmtWearable = (connected: boolean, lastSync?: string) => {
    if (!connected) return t.settings.notConnected;
    if (lastSync) return `${t.settings.connected} · ${lastSync}`;
    return t.settings.connected;
  };

  const openWearableAuth = async (provider: 'strava' | 'garmin') => {
    try {
      const payload =
        provider === 'strava'
          ? await WearableService.getStravaAuthUrl()
          : await WearableService.getGarminAuthUrl();
      if (payload?.auth_url) {
        await Linking.openURL(payload.auth_url);
      }
    } catch {
      // Keep screen resilient: user still sees status cards.
    }
  };

  const renderGeneral = () => (
    <>
      <Text style={s.sectionTitle}>{t.settings.general}</Text>
      <Pressable style={s.cd} onPress={toggleLocale}>
        <Text style={s.l}>{t.common.language}</Text>
        <Text style={[s.v, { color: c.primary }]}>{locale === 'pl' ? t.common.polish : t.common.english}</Text>
      </Pressable>
      <Pressable style={s.cd} onPress={toggleImmersive}>
        <Text style={s.l}>{t.settings.immersive}</Text>
        <Text style={[s.v, { color: c.primary }]}>{immersiveEnabled ? t.settings.on : t.settings.off}</Text>
      </Pressable>
      <Pressable
        style={s.cd}
        onPress={() => {
          const next = !haptics;
          setHaptics(next);
          RiderPreferencesService.setHapticsEnabled(next);
          if (next) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }}
      >
        <Text style={s.l}>{t.settings.haptics}</Text>
        <Text style={[s.v, { color: c.primary }]}>{haptics ? t.settings.on : t.settings.off}</Text>
      </Pressable>
      <Pressable
        style={s.cd}
        onPress={() => {
          const next = !voiceCues;
          setVoiceCues(next);
          RiderPreferencesService.setVoiceCuesEnabled(next);
        }}
      >
        <Text style={s.l}>{t.settings.voiceCues}</Text>
        <Text style={[s.v, { color: c.primary }]}>{voiceCues ? t.settings.on : t.settings.off}</Text>
      </Pressable>
    </>
  );

  const renderSensors = () => (
    <>
      <Text style={s.sectionTitle}>{t.settings.sensors}</Text>
      <View style={s.cd}>
        <Text style={s.l}>{t.settings.riderWeight}</Text>
        <TextInput
          style={s.input}
          keyboardType="numeric"
          value={String(weightKg)}
          onChangeText={(v) => {
            const n = Number(v.replace(/[^0-9]/g, ''));
            if (!Number.isFinite(n)) return;
            const clamped = Math.max(30, Math.min(200, n));
            setWeightKg(clamped);
            RiderPreferencesService.setWeightKg(clamped);
          }}
          accessibilityLabel={t.settings.riderWeight}
        />
        <Text style={s.v}>{t.settings.kg}</Text>
      </View>

      <View style={s.cd}>
        <Text style={s.l}>{t.settings.maxHr}</Text>
        <TextInput
          style={s.input}
          keyboardType="numeric"
          value={String(maxHr)}
          onChangeText={(v) => {
            const n = Number(v.replace(/[^0-9]/g, ''));
            if (!Number.isFinite(n)) return;
            const clamped = Math.max(100, Math.min(230, n));
            setMaxHr(clamped);
            RiderPreferencesService.setMaxHr(clamped);
          }}
          accessibilityLabel={t.settings.maxHr}
        />
        <Text style={s.v}>{t.settings.bpm}</Text>
      </View>
      {[
        {
          l: t.settings.strava,
          v: fmtWearable(wearables?.strava?.connected ?? false, wearables?.strava?.last_sync),
          dot: wearables?.strava?.connected,
          onConnect: () => void openWearableAuth('strava'),
        },
        {
          l: t.settings.garmin,
          v: fmtWearable(wearables?.garmin?.connected ?? false, wearables?.garmin?.last_sync),
          dot: wearables?.garmin?.connected,
          onConnect: () => void openWearableAuth('garmin'),
        },
      ].map((r, i) => (
        <View key={i} style={s.cd}>
          <Text style={s.l}>{r.l}</Text>
          <Text style={[s.v, r.dot && { color: c.primary }]}>{r.v}{r.dot ? ' ●' : ''}</Text>
          <Pressable style={s.actionBtn} onPress={r.onConnect}>
            <Text style={s.actionBtnText}>{t.settings.connect}</Text>
          </Pressable>
        </View>
      ))}
      <Pressable
        style={s.actionBtn}
        onPress={() => {
          WearableService.sync().catch(() => {});
        }}
      >
        <Text style={s.actionBtnText}>{t.settings.syncNow}</Text>
      </Pressable>
    </>
  );

  const renderPrivacy = () => (
    <>
      <Text style={s.sectionTitle}>{t.settings.privacy}</Text>
      <View style={s.cd}>
        <Text style={s.l}>{t.settings.privacyZones}</Text>
        <Text style={[s.v, { color: c.primary }]}>
          {privacyZoneCount == null ? t.common.loading : String(privacyZoneCount)}
        </Text>
      </View>
      <View style={s.cd}>
        <Text style={s.l}>{t.settings.privacyHintTitle}</Text>
        <Text style={s.v}>{t.settings.privacyHintBody}</Text>
      </View>
    </>
  );

  const renderGarage = () => (
    <>
      <Text style={s.sectionTitle}>{t.settings.garage}</Text>
      <View style={s.cd}>
        <Text style={s.l}>{t.settings.powerZones}</Text>
        <Text style={s.v}>{t.settings.comingSoon}</Text>
      </View>
      <View style={s.cd}>
        <Text style={s.l}>{t.settings.gearGarage}</Text>
        <Text style={s.v}>{t.settings.comingSoon}</Text>
      </View>
      <View style={s.cd}>
        <Text style={s.l}>{t.settings.achievements}</Text>
        <Text style={s.v}>{t.settings.comingSoon}</Text>
      </View>
    </>
  );

  return (
    <SafeAreaView style={s.ct} edges={embedded ? [] : ['top']}>
      {!embedded && (
        <View style={s.h}>
          <Text style={s.t}>{t.settings.title}</Text>
        </View>
      )}
      <ScrollView horizontal style={s.nav} showsHorizontalScrollIndicator={false}>
        {[
          { key: 'general', label: t.settings.general },
          { key: 'sensors', label: t.settings.sensors },
          { key: 'privacy', label: t.settings.privacy },
          { key: 'garage', label: t.settings.garage },
        ].map((item) => (
          <Pressable
            key={item.key}
            style={({ pressed }) => [
              s.navBtn,
              section === item.key && s.navBtnActive,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => setSection(item.key as SettingsSection)}
          >
            <Text style={s.navBtnText}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView>
        {section === 'general' && renderGeneral()}
        {section === 'sensors' && renderSensors()}
        {section === 'privacy' && renderPrivacy()}
        {section === 'garage' && renderGarage()}
      </ScrollView>
    </SafeAreaView>
  );
};
