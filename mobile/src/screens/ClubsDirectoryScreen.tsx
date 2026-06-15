import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUnistyles } from 'react-native-unistyles';
import { useI18n } from '../i18n/useI18n';
import { EmptyState } from '../components/ui/EmptyState';

export const ClubsDirectoryScreen: React.FC = () => {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const c = theme.colors as Record<string, string>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <EmptyState message={t.clubs.empty} hint={t.clubs.subtitle} icon="clubs" />
      </ScrollView>
    </SafeAreaView>
  );
};
