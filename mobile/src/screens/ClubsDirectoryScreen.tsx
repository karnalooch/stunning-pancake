import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUnistyles } from 'react-native-unistyles';
import { useMobileI18n } from '../i18n/useI18n';

export const ClubsDirectoryScreen: React.FC = () => {
  const { theme } = useUnistyles();
  const { t } = useMobileI18n();
  const c = theme.colors as Record<string, string>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: c.primary }}>{t.clubs.title}</Text>
        <Text style={{ fontSize: 14, color: c.secondary, marginTop: 8, textAlign: 'center' }}>{t.clubs.subtitle}</Text>
      </View>
    </SafeAreaView>
  );
};
