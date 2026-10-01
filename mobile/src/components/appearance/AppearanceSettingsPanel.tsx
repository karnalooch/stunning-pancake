import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../../i18n/useI18n';
import { appearanceCopy } from './copy';
import { useAppearance } from '../../theme/ThemeProvider';
import { BUILTIN_THEME_PACKS } from '../../theme/packs/builtins';
import {
  MAX_PACK_CHARACTERS, ThemePackError, exportThemePack, parseThemePack,
  resolveColorMode, resolvePalette, type ThemePack,
} from '../../theme/packs/themePack';

export function AppearanceSettingsPanel({ onClose }: { onClose: () => void }) {
  const { locale } = useI18n();
  const t = appearanceCopy[locale === 'pl' ? 'pl' : 'en'];
  const { store, snapshot, palette: p } = useAppearance();
  const system = useColorScheme();
  const [draft, setDraft] = useState(snapshot.preferences);
  const [selected, setSelected] = useState(() => store.getPack(snapshot.preferences.themeId));
  const [pending, setPending] = useState<ThemePack | null>(null);
  const [json, setJson] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const catalogue = [...BUILTIN_THEME_PACKS, ...snapshot.customPacks];
  const preview = resolvePalette(selected, resolveColorMode(draft.mode, system), draft.highContrast);
  const fail = (reason: unknown) => {
    const code = reason instanceof ThemePackError ? reason.code : 'format';
    setError(code === 'contrast' ? t.contrastError : t[code]);
    setNotice('');
  };
  const select = (pack: ThemePack) => {
    setSelected(pack);
    setDraft({ ...draft, themeId: pack.id });
    setPending(null);
    setNotice('');
    setError('');
  };
  const validateImport = () => {
    try {
      const pack = parseThemePack(json);
      if (catalogue.some((item) => item.id === pack.id)) throw new ThemePackError('duplicate');
      setPending(pack);
      setSelected(pack);
      setDraft({ ...draft, themeId: pack.id });
      setError('');
      setNotice('');
    } catch (reason) { fail(reason); }
  };
  const apply = () => {
    try {
      if (pending) store.installAndSelect(exportThemePack(pending), { mode: draft.mode, highContrast: draft.highContrast });
      else store.setPreferences({ ...draft, themeId: selected.id });
      setPending(null);
      setJson('');
      setError('');
      setNotice(store.getSnapshot().persistence === 'available' ? t.saved : t.temporary);
    } catch (reason) { fail(reason); }
  };
  const remove = () => Alert.alert(selected.name, t.removeConfirm, [
    { text: t.cancel, style: 'cancel' },
    { text: t.remove, style: 'destructive', onPress: () => {
      try {
        store.removePack(selected.id);
        const next = store.getSnapshot().preferences;
        setDraft(next);
        setSelected(store.getPack(next.themeId));
        setError('');
        setNotice(store.getSnapshot().persistence === 'available' ? t.saved : t.temporary);
      } catch (reason) { fail(reason); }
    } },
  ]);
  return (
    <SafeAreaView style={[s.root, { backgroundColor: p.canvas }]}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Pressable testID="appearance-close" accessibilityRole="button" onPress={onClose} style={s.back}>
          <Text style={[s.body, { color: p.action }]}>{t.back}</Text>
        </Pressable>
        <Text accessibilityRole="header" style={[s.title, { color: p.text }]}>{t.title}</Text>
        <Text style={[s.body, { color: p.muted }]}>{t.subtitle}</Text>
        {snapshot.persistence === 'unavailable' && <Text style={[s.body, { color: p.warning }]}>{t.temporary}</Text>}
        {snapshot.recovered && <Text style={[s.body, { color: p.warning }]}>{t.recovered}</Text>}
        <Text style={[s.section, { color: p.text }]}>{t.theme}</Text>
        <View style={s.options}>
          {catalogue.map((pack) => {
            const active = selected.id === pack.id;
            return (
              <Pressable key={pack.id} testID={`appearance-pack-${pack.id}`} accessibilityRole="button"
                accessibilityLabel={pack.name} accessibilityState={{ selected: active }} onPress={() => select(pack)}
                style={[s.option, { backgroundColor: p.surface, borderColor: active ? p.action : p.border, borderWidth: active ? 2 : 1 }]}>
                <View style={s.swatches} accessible={false}>
                  {[pack.light.action, pack.light.canvas, pack.dark.canvas].map((color, index) => (
                    <View key={index} style={[s.swatch, { backgroundColor: color, borderColor: p.border }]} />
                  ))}
                </View>
                <Text style={[s.label, { color: p.text }]}>{pack.name}{active ? ' ✓' : ''}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[s.section, { color: p.text }]}>{t.mode}</Text>
        <View style={s.options}>
          {(['light', 'dark', 'system'] as const).map((mode) => (
            <Pressable key={mode} testID={`appearance-mode-${mode}`} accessibilityRole="button"
              accessibilityState={{ selected: draft.mode === mode }} onPress={() => { setDraft({ ...draft, mode }); setNotice(''); }}
              style={[s.mode, { backgroundColor: draft.mode === mode ? p.action : p.surface, borderColor: p.border }]}>
              <Text style={[s.label, { color: draft.mode === mode ? p.onAction : p.text }]}>{t[mode]}</Text>
            </Pressable>
          ))}
        </View>
        <View style={s.row}>
          <Text style={[s.label, s.flex, { color: p.text }]}>{t.contrast}</Text>
          <Switch testID="appearance-high-contrast" accessibilityLabel={t.contrast} value={draft.highContrast}
            onValueChange={(highContrast) => { setDraft({ ...draft, highContrast }); setNotice(''); }} />
        </View>
        <View testID="appearance-preview" style={[s.preview, { backgroundColor: preview.canvas, borderColor: preview.border }]}>
          <Text style={[s.caption, { color: preview.muted }]}>{t.preview}</Text>
          <Text style={[s.section, { color: preview.text }]}>{selected.name}</Text>
          <Text style={[s.body, { color: preview.muted }]}>{t.speed}</Text>
          <Text style={[s.metric, { color: preview.text }]}>{locale === 'pl' ? '28,4' : '28.4'} <Text style={s.unit}>km/h</Text></Text>
          <View style={s.options}>
            <View style={s.previewCell}><Text style={[s.body, { color: preview.muted }]}>{t.distance}</Text><Text style={[s.value, { color: preview.text }]}>42.7 km</Text></View>
            <View style={s.previewCell}><Text style={[s.body, { color: preview.muted }]}>{t.time}</Text><Text style={[s.value, { color: preview.text }]}>01:23:12</Text></View>
          </View>
          <View style={[s.button, { backgroundColor: preview.action }]}>
            <Text style={[s.label, { color: preview.onAction }]}>{t.start}</Text>
          </View>
        </View>
        {!!error && <Text accessibilityRole="alert" testID="appearance-error" style={[s.body, { color: p.error }]}>{error}</Text>}
        {!!notice && <Text accessibilityLiveRegion="polite" testID="appearance-notice" style={[s.body, { color: p.text }]}>{notice}</Text>}
        <Pressable testID="appearance-apply" accessibilityRole="button" onPress={apply} style={[s.button, { backgroundColor: p.action }]}>
          <Text style={[s.label, { color: p.onAction }]}>{t.apply}</Text>
        </Pressable>
        <Pressable testID="appearance-cancel" accessibilityRole="button" onPress={onClose} style={[s.button, { borderColor: p.border, borderWidth: 1 }]}>
          <Text style={[s.label, { color: p.text }]}>{t.cancel}</Text>
        </Pressable>
        <Text style={[s.section, { color: p.text }]}>{t.importTitle}</Text>
        <Text style={[s.body, { color: p.muted }]}>{t.importHint}</Text>
        <TextInput testID="appearance-import-json" accessibilityLabel={t.importTitle} value={json} multiline
          autoCapitalize="none" autoCorrect={false} maxLength={MAX_PACK_CHARACTERS}
          onChangeText={(value) => {
            setJson(value); setError(''); setNotice('');
            if (pending) { setPending(null); setSelected(store.getPack(snapshot.preferences.themeId)); setDraft(snapshot.preferences); }
          }}
          style={[s.input, { backgroundColor: p.surface, borderColor: p.border, color: p.text }]} />
        <Pressable testID="appearance-import-preview" accessibilityRole="button" onPress={validateImport} style={[s.button, { borderColor: p.border, borderWidth: 1 }]}>
          <Text style={[s.label, { color: p.text }]}>{t.import}</Text>
        </Pressable>
        <Pressable testID="appearance-export" accessibilityRole="button" onPress={() => {
          void Share.share({ title: `${selected.id}.json`, message: exportThemePack(selected) })
            .catch(() => { setError(t.exportError); });
        }} style={[s.button, { borderColor: p.border, borderWidth: 1 }]}>
          <Text style={[s.label, { color: p.text }]}>{t.export}</Text>
        </Pressable>
        {!pending && snapshot.customPacks.some((pack) => pack.id === selected.id) && (
          <Pressable testID="appearance-remove" accessibilityRole="button" onPress={remove} style={s.button}>
            <Text style={[s.label, { color: p.error }]}>{t.remove}</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  root: { flex: 1 }, content: { padding: 20, gap: 14, paddingBottom: 36 },
  back: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start', minWidth: 64 },
  title: { fontSize: 34, fontWeight: '700' }, section: { fontSize: 20, fontWeight: '600', marginTop: 12 },
  body: { fontSize: 16, lineHeight: 24 }, caption: { fontSize: 13, lineHeight: 20 },
  label: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 56 }, flex: { flex: 1, textAlign: 'left' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: { flexGrow: 1, minWidth: 120, padding: 16, borderRadius: 14, gap: 12 },
  mode: { flexGrow: 1, minWidth: 84, minHeight: 52, padding: 12, borderRadius: 12, borderWidth: 1, justifyContent: 'center' },
  swatches: { flexDirection: 'row', gap: 7 }, swatch: { width: 24, height: 24, borderRadius: 12, borderWidth: 1 },
  preview: { padding: 20, borderRadius: 20, borderWidth: 1, gap: 12 },
  metric: { fontSize: 56, fontWeight: '700', fontVariant: ['tabular-nums'] }, unit: { fontSize: 18, fontWeight: '400' },
  previewCell: { flexGrow: 1, minWidth: 100, gap: 5 }, value: { fontSize: 23, fontWeight: '600', fontVariant: ['tabular-nums'] },
  button: { minHeight: 52, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 144, maxHeight: 260, borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 14, textAlignVertical: 'top' },
});
