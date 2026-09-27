import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import * as Haptics from 'expo-haptics';

import { PrimaryButton } from '../components/product/PrimaryButton';
import { ProductCard } from '../components/product/ProductCard';
import { useI18n } from '../i18n/useI18n';
import { useImmersiveTheme } from '../hooks/useImmersiveTheme';
import { PrivacyService, WearableService } from '../services/api';
import { RiderPreferencesService } from '../services/RiderPreferencesService';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';

type SettingsSection = 'general' | 'sensors' | 'privacy' | 'garage';

const stylesheet = StyleSheet.create((theme) => {
  const semantic = getSemanticColors(theme.colors);
  return {
    container: {
      flex: 1,
      backgroundColor: semantic.canvas.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 12,
    },
    title: {
      ...PRODUCT_TYPOGRAPHY.title,
      color: semantic.text.primary,
    },
    nav: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    navContent: {
      gap: 8,
    },
    navButton: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: semantic.border.subtle,
      borderRadius: 12,
      paddingHorizontal: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: semantic.surface.default,
    },
    navButtonActive: {
      borderColor: semantic.selection.border,
      backgroundColor: semantic.selection.background,
    },
    navButtonText: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.text.secondary,
    },
    navButtonTextActive: {
      color: semantic.selection.content,
    },
    content: {
      paddingHorizontal: 16,
      paddingBottom: 40,
      gap: 12,
    },
    sectionTitle: {
      ...PRODUCT_TYPOGRAPHY.metricLabel,
      color: semantic.text.secondary,
      marginTop: 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    rowStack: {
      gap: 10,
    },
    label: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.text.primary,
      flexShrink: 1,
    },
    value: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.secondary,
      textAlign: 'right',
      flexShrink: 1,
    },
    valueActive: {
      color: semantic.selection.active,
    },
    statusSuccess: {
      color: semantic.status.success,
    },
    inputGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    input: {
      minWidth: 76,
      minHeight: 44,
      borderWidth: 1,
      borderColor: semantic.border.subtle,
      borderRadius: 10,
      paddingHorizontal: 12,
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.text.primary,
      textAlign: 'center',
      backgroundColor: semantic.surface.interactive,
    },
    actionStack: {
      gap: 10,
      marginTop: 2,
    },
  };
});

interface SettingsScreenProps {
  /** When true, stack header is provided by parent — hide local title bar. */
  embedded?: boolean;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ embedded = false }) => {
  const s = stylesheet;
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
    <View style={s.rowStack}>
      <Text style={s.sectionTitle}>{t.settings.general}</Text>
      <ProductCard variant="interactive" onPress={toggleLocale} accessibilityLabel={t.common.language}>
        <View style={s.row}>
          <Text style={s.label}>{t.common.language}</Text>
          <Text style={[s.value, s.valueActive]}>
            {locale === 'pl' ? t.common.polish : t.common.english}
          </Text>
        </View>
      </ProductCard>
      <ProductCard variant="interactive" onPress={toggleImmersive} accessibilityLabel={t.settings.immersive}>
        <View style={s.row}>
          <Text style={s.label}>{t.settings.immersive}</Text>
          <Text style={[s.value, s.valueActive]}>
            {immersiveEnabled ? t.settings.on : t.settings.off}
          </Text>
        </View>
      </ProductCard>
      <ProductCard
        variant="interactive"
        onPress={() => {
          const next = !haptics;
          setHaptics(next);
          RiderPreferencesService.setHapticsEnabled(next);
          if (next) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }}
        accessibilityLabel={t.settings.haptics}
      >
        <View style={s.row}>
          <Text style={s.label}>{t.settings.haptics}</Text>
          <Text style={[s.value, s.valueActive]}>{haptics ? t.settings.on : t.settings.off}</Text>
        </View>
      </ProductCard>
      <ProductCard
        variant="interactive"
        onPress={() => {
          const next = !voiceCues;
          setVoiceCues(next);
          RiderPreferencesService.setVoiceCuesEnabled(next);
        }}
        accessibilityLabel={t.settings.voiceCues}
      >
        <View style={s.row}>
          <Text style={s.label}>{t.settings.voiceCues}</Text>
          <Text style={[s.value, s.valueActive]}>{voiceCues ? t.settings.on : t.settings.off}</Text>
        </View>
      </ProductCard>
    </View>
  );

  const renderSensors = () => (
    <View style={s.rowStack}>
      <Text style={s.sectionTitle}>{t.settings.sensors}</Text>
      <ProductCard>
        <View style={s.row}>
          <Text style={s.label}>{t.settings.riderWeight}</Text>
          <View style={s.inputGroup}>
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
            <Text style={s.value}>{t.settings.kg}</Text>
          </View>
        </View>
      </ProductCard>
      <ProductCard>
        <View style={s.row}>
          <Text style={s.label}>{t.settings.maxHr}</Text>
          <View style={s.inputGroup}>
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
            <Text style={s.value}>{t.settings.bpm}</Text>
          </View>
        </View>
      </ProductCard>

      {[
        {
          key: 'strava',
          label: t.settings.strava,
          status: wearables?.strava,
          onConnect: () => void openWearableAuth('strava'),
        },
        {
          key: 'garmin',
          label: t.settings.garmin,
          status: wearables?.garmin,
          onConnect: () => void openWearableAuth('garmin'),
        },
      ].map((item) => (
        <ProductCard key={item.key}>
          <View style={s.rowStack}>
            <View style={s.row}>
              <Text style={s.label}>{item.label}</Text>
              <Text style={[s.value, item.status?.connected && s.statusSuccess]}>
                {fmtWearable(item.status?.connected ?? false, item.status?.last_sync)}
              </Text>
            </View>
            <PrimaryButton label={t.settings.connect} onPress={item.onConnect} variant="secondary" />
          </View>
        </ProductCard>
      ))}

      <View style={s.actionStack}>
        <PrimaryButton
          label={t.settings.syncNow}
          onPress={() => {
            WearableService.sync().catch(() => {});
          }}
        />
      </View>
    </View>
  );

  const renderPrivacy = () => (
    <View style={s.rowStack}>
      <Text style={s.sectionTitle}>{t.settings.privacy}</Text>
      <ProductCard>
        <View style={s.row}>
          <Text style={s.label}>{t.settings.privacyZones}</Text>
          <Text style={[s.value, s.valueActive]}>
            {privacyZoneCount == null ? t.common.loading : String(privacyZoneCount)}
          </Text>
        </View>
      </ProductCard>
      <ProductCard>
        <View style={s.rowStack}>
          <Text style={s.label}>{t.settings.privacyHintTitle}</Text>
          <Text style={s.value}>{t.settings.privacyHintBody}</Text>
        </View>
      </ProductCard>
    </View>
  );

  const renderGarage = () => (
    <View style={s.rowStack}>
      <Text style={s.sectionTitle}>{t.settings.garage}</Text>
      {[t.settings.powerZones, t.settings.gearGarage, t.settings.achievements].map((label) => (
        <ProductCard key={label}>
          <View style={s.row}>
            <Text style={s.label}>{label}</Text>
            <Text style={s.value}>{t.settings.comingSoon}</Text>
          </View>
        </ProductCard>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={s.container} edges={embedded ? [] : ['top']}>
      {!embedded && (
        <View style={s.header}>
          <Text style={s.title}>{t.settings.title}</Text>
        </View>
      )}
      <ScrollView
        horizontal
        style={s.nav}
        contentContainerStyle={s.navContent}
        showsHorizontalScrollIndicator={false}
      >
        {[
          { key: 'general', label: t.settings.general },
          { key: 'sensors', label: t.settings.sensors },
          { key: 'privacy', label: t.settings.privacy },
          { key: 'garage', label: t.settings.garage },
        ].map((item) => {
          const active = section === item.key;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [
                s.navButton,
                active && s.navButtonActive,
                pressed && { opacity: 0.82 },
              ]}
              onPress={() => setSection(item.key as SettingsSection)}
            >
              <Text style={[s.navButtonText, active && s.navButtonTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <ScrollView contentContainerStyle={s.content}>
        {section === 'general' && renderGeneral()}
        {section === 'sensors' && renderSensors()}
        {section === 'privacy' && renderPrivacy()}
        {section === 'garage' && renderGarage()}
      </ScrollView>
    </SafeAreaView>
  );
};
