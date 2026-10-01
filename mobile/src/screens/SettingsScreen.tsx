import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../i18n/useI18n';
import { appearanceCopy } from '../components/appearance/copy';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';
import { useAppearance } from '../theme/ThemeProvider';
import { SettingsScreen as SettingsSections } from './SettingsSections';
import { AppearanceSettingsPanel } from '../components/appearance/AppearanceSettingsPanel';

/** Preserve settings capabilities during issue 418; retire SettingsSections after their redesign. */
export function SettingsScreen({ embedded = false }: { embedded?: boolean }) {
  const [open, setOpen] = useState(false);
  const { palette: p } = useAppearance();
  const { t, locale } = useI18n();
  const copy = appearanceCopy[locale === 'pl' ? 'pl' : 'en'];
  return (
    <SafeAreaView edges={embedded ? [] : ['top']} style={{ flex: 1, backgroundColor: p.canvas }}>
      {!embedded && <Text style={{ ...PRODUCT_TYPOGRAPHY.displayEditorial, color: p.text, padding: 20 }}>{t.settings.title}</Text>}
      <View style={{ padding: 16 }}>
        <Pressable testID="settings-appearance" accessibilityRole="button" accessibilityLabel={copy.title}
          onPress={() => setOpen(true)} style={{ minHeight: 60, padding: 16, borderRadius: 14, backgroundColor: p.surface, borderColor: p.border, borderWidth: 1 }}>
          <Text style={{ color: p.text, ...PRODUCT_TYPOGRAPHY.bodyMedium }}>{copy.title}</Text>
          <Text style={{ color: p.muted, ...PRODUCT_TYPOGRAPHY.body, marginTop: 4 }}>{copy.subtitle}</Text>
        </Pressable>
      </View>
      <SettingsSections embedded />
      <Modal visible={open} animationType="none" onRequestClose={() => setOpen(false)}>
        {open && <AppearanceSettingsPanel onClose={() => setOpen(false)} />}
      </Modal>
    </SafeAreaView>
  );
}
