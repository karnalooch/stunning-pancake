import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Modal, Switch, Text, TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useI18n } from '../i18n/useI18n';
import { useImmersiveTheme } from '../hooks/useImmersiveTheme';
import { AppearanceSettingsPanel } from '../components/appearance/AppearanceSettingsPanel';
import { appearanceCopy } from '../components/appearance/copy';
import { RoadbookPage, RoadbookSection, RoadbookRow, RoadbookNotice } from '../components/roadbook/Surface';
import { getAppCopy } from '../components/roadbook/appCopy';
import { parsePreferenceNumber } from '../components/roadbook/preferencesInput';
import { PrimaryButton } from '../components/product';
import { PrivacyService, WearableService } from '../services/api';
import { RiderPreferencesService } from '../services/RiderPreferencesService';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';

type WearableStatus = Awaited<ReturnType<typeof WearableService.getStatus>>;
export function SettingsScreen({ embedded = false }: { embedded?: boolean }) {
  const { t, locale, toggleLocale } = useI18n();
  const copy = getAppCopy(locale);
  const appearance = appearanceCopy[locale === 'pl' ? 'pl' : 'en'];
  const { theme } = useUnistyles();
  const c = getSemanticColors(theme.colors);
  const { enabled: immersiveEnabled, toggle: toggleImmersive } = useImmersiveTheme();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [wearables, setWearables] = useState<WearableStatus | null>(null);
  const [privacyZoneCount, setPrivacyZoneCount] = useState<number | null>(null);
  const [wearableError, setWearableError] = useState(false);
  const [privacyError, setPrivacyError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [weightText, setWeightText] = useState(() => String(RiderPreferencesService.getWeightKg()));
  const [hrText, setHrText] = useState(() => String(RiderPreferencesService.getMaxHr()));
  const [haptics, setHaptics] = useState(() => RiderPreferencesService.isHapticsEnabled());
  const [voiceCues, setVoiceCues] = useState(() => RiderPreferencesService.isVoiceCuesEnabled());
  const alive = useRef(false);
  const request = useRef(0);
  const operation = useRef(false);
  const readStatus = useCallback(() => {
    const id = ++request.current;
    return Promise.allSettled([WearableService.getStatus(), PrivacyService.getZones()]).then(([wearableResult, privacyResult]) => {
      if (!alive.current || id !== request.current) return;
      setWearableError(wearableResult.status === 'rejected');
      if (wearableResult.status === 'fulfilled') setWearables(wearableResult.value);
      const validPrivacy = privacyResult.status === 'fulfilled' && Array.isArray(privacyResult.value);
      setPrivacyError(!validPrivacy);
      if (privacyResult.status === 'fulfilled' && Array.isArray(privacyResult.value)) setPrivacyZoneCount(privacyResult.value.length);
      setLoading(false);
    });
  }, []);
  useEffect(() => {
    alive.current = true;
    void readStatus();
    return () => { alive.current = false; request.current += 1; };
  }, [readStatus]);
  const refresh = () => { setLoading(true); return readStatus(); };
  const run = async (action: () => Promise<unknown>) => {
    if (operation.current) return;
    operation.current = true; setBusy(true); setError(null); setSaved(false);
    try { await action(); }
    catch { if (alive.current) setError(copy.actionError); }
    finally { operation.current = false; if (alive.current) setBusy(false); }
  };
  const openWearableAuth = (provider: 'strava' | 'garmin') => run(async () => {
    const payload = provider === 'strava' ? await WearableService.getStravaAuthUrl() : await WearableService.getGarminAuthUrl();
    if (!payload?.auth_url) throw new Error('Missing authorization URL');
    await Linking.openURL(payload.auth_url);
    // Opening OAuth is not evidence of a connection. Refresh explicitly after returning.
  });
  const saveNumber = (kind: 'weight' | 'hr') => {
    const value = kind === 'weight' ? parsePreferenceNumber(weightText, 30, 200) : parsePreferenceNumber(hrText, 100, 230, true);
    if (value === null) { setSaved(false); setError(kind === 'weight' ? copy.invalidWeight : copy.invalidHr); return; }
    try {
      if (kind === 'weight') { RiderPreferencesService.setWeightKg(value); setWeightText(String(value)); }
      else { RiderPreferencesService.setMaxHr(value); setHrText(String(value)); }
      setError(null); setSaved(true);
    } catch { setSaved(false); setError(copy.actionError); }
  };
  return <>
    <RoadbookPage title={t.settings.title} embedded={embedded} testID="roadbook-settings">
      <RoadbookRow label={appearance.title} detail={appearance.subtitle} onPress={() => setAppearanceOpen(true)} testID="settings-appearance" />
      {error ? <RoadbookNotice error title={error} testID="settings-operation-error" /> : null}
      {saved ? <Text accessibilityLiveRegion="polite" style={styles.body}>{copy.saved}</Text> : null}
      <RoadbookSection title={copy.preferences}>
        <RoadbookRow label={t.common.language} detail={locale === 'pl' ? t.common.polish : t.common.english} onPress={toggleLocale} testID="settings-language" />
        <View style={styles.row}><Text style={styles.label}>{t.settings.haptics}</Text><Switch testID="settings-haptics"
          accessibilityLabel={t.settings.haptics} value={haptics} onValueChange={(value) => {
            try { RiderPreferencesService.setHapticsEnabled(value); setHaptics(value); } catch { setError(copy.actionError); }
          }} /></View>
        <View style={styles.row}><Text style={styles.label}>{t.settings.voiceCues}</Text><Switch testID="settings-voice"
          accessibilityLabel={t.settings.voiceCues} value={voiceCues} onValueChange={(value) => {
            try { RiderPreferencesService.setVoiceCuesEnabled(value); setVoiceCues(value); } catch { setError(copy.actionError); }
          }} /></View>
        <View style={styles.row}><Text style={styles.label}>{t.settings.immersive}</Text><Switch testID="settings-immersive"
          accessibilityLabel={t.settings.immersive} value={immersiveEnabled} onValueChange={toggleImmersive} /></View>
      </RoadbookSection>
      <RoadbookSection title={copy.equipment}>
        <Text style={styles.label}>{t.settings.riderWeight} · {t.settings.kg}</Text>
        <View style={styles.fieldRow}><TextInput testID="settings-weight" accessibilityLabel={t.settings.riderWeight}
          keyboardType="decimal-pad" value={weightText} onChangeText={setWeightText} style={styles.input}
          placeholderTextColor={c.text.secondary} onSubmitEditing={() => saveNumber('weight')} />
          <PrimaryButton label={copy.save} onPress={() => saveNumber('weight')} testID="settings-save-weight" /></View>
        <Text style={styles.label}>{t.settings.maxHr} · {t.settings.bpm}</Text>
        <View style={styles.fieldRow}><TextInput testID="settings-max-hr" accessibilityLabel={t.settings.maxHr}
          keyboardType="number-pad" value={hrText} onChangeText={setHrText} style={styles.input}
          placeholderTextColor={c.text.secondary} onSubmitEditing={() => saveNumber('hr')} />
          <PrimaryButton label={copy.save} onPress={() => saveNumber('hr')} testID="settings-save-max-hr" /></View>
      </RoadbookSection>
      <RoadbookSection title={copy.integrations}>
        {wearableError ? <RoadbookNotice error title={copy.unknown} testID="settings-wearable-error" /> : null}
        {(['strava', 'garmin'] as const).map((provider) => {
          const status = wearables?.[provider];
          const label = provider === 'strava' ? t.settings.strava : t.settings.garmin;
          const detail = wearableError ? copy.unknown : !status ? t.common.loading
            : status.connected ? `${t.settings.connected}${status.last_sync ? ` · ${status.last_sync}` : ''}` : t.settings.notConnected;
          return <View key={provider} style={styles.stack}>
            <RoadbookRow label={label} detail={detail} testID={`settings-${provider}-status`} />
            <PrimaryButton label={`${t.settings.connect} · ${label}`} variant="secondary" disabled={busy}
              onPress={() => void openWearableAuth(provider)} testID={`settings-connect-${provider}`} />
          </View>;
        })}
        <PrimaryButton label={busy ? copy.busy : t.settings.syncNow} disabled={busy} testID="settings-sync"
          onPress={() => void run(async () => { await WearableService.sync(); await refresh(); })} />
        <PrimaryButton label={t.common.retry} variant="secondary" disabled={busy || loading}
          onPress={() => void refresh()} testID="settings-refresh-status" />
      </RoadbookSection>
      <RoadbookSection title={copy.privacy}>
        {privacyError ? <RoadbookNotice error title={copy.unknown} testID="settings-privacy-error" />
          : <RoadbookRow label={t.settings.privacyZones} detail={privacyZoneCount === null ? t.common.loading : String(privacyZoneCount)} />}
        <Text style={styles.label}>{t.settings.privacyHintTitle}</Text><Text style={styles.body}>{t.settings.privacyHintBody}</Text>
      </RoadbookSection>
      <RoadbookSection title={t.settings.garage}>
        {[t.settings.powerZones, t.settings.gearGarage, t.settings.achievements].map((label) =>
          <RoadbookRow key={label} label={label} detail={copy.unavailable} />)}
      </RoadbookSection>
    </RoadbookPage>
    <Modal visible={appearanceOpen} animationType="none" onRequestClose={() => setAppearanceOpen(false)}>
      {appearanceOpen ? <AppearanceSettingsPanel onClose={() => setAppearanceOpen(false)} /> : null}
    </Modal>
  </>;
}
const styles = StyleSheet.create((theme) => {
  const c = getSemanticColors(theme.colors);
  return {
    row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
    label: { ...PRODUCT_TYPOGRAPHY.bodyMedium, color: c.text.primary, flexShrink: 1 },
    body: { ...PRODUCT_TYPOGRAPHY.body, color: c.text.secondary }, stack: { gap: 10 },
    fieldRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
    input: { flexGrow: 1, flexBasis: 100, minHeight: 52, padding: 12, borderWidth: 1, borderRadius: 8,
      borderColor: c.border.strong, backgroundColor: c.surface.default, color: c.text.primary, ...PRODUCT_TYPOGRAPHY.body },
  };
});
