import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { PrimaryButton, ProductCard, SportChip } from '../components/product';
import { useI18n } from '../i18n/useI18n';
import type { ActivitySportType } from '../services/api';
import { LAYOUT } from '../theme/layout';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';
import { ACTIVITY_SPORT_OPTIONS } from '../types/activitySport';

const stylesheet = StyleSheet.create((theme) => {
  const semantic = getSemanticColors(theme.colors);

  return {
    root: {
      flex: 1,
      backgroundColor: semantic.canvas.background,
    },
    content: {
      flex: 1,
      padding: LAYOUT.gutter,
      gap: LAYOUT.sectionGap,
      justifyContent: 'center',
    },
    title: {
      ...PRODUCT_TYPOGRAPHY.title,
      color: semantic.text.primary,
    },
    body: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.secondary,
    },
    card: {
      gap: 16,
    },
    sportRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
  };
});

interface StartRideScreenProps {
  onStartRide: (sport: ActivitySportType) => void;
  onOpenGpsWizard: () => void;
  isRecording: boolean;
  onGoToRide: () => void;
}

export const StartRideScreen: React.FC<StartRideScreenProps> = ({
  onStartRide,
  onOpenGpsWizard,
  isRecording,
  onGoToRide,
}) => {
  const { t, locale } = useI18n();
  const s = stylesheet;
  const [selectedSport, setSelectedSport] = useState<ActivitySportType>('BIKE');

  const handleStart = useCallback(() => {
    onStartRide(selectedSport);
  }, [onStartRide, selectedSport]);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.content}>
        <View>
          <Text style={s.title}>{t.tabs.startRide}</Text>
          <Text style={s.body}>
            {isRecording ? t.dashboard.inProgress : t.dashboard.ready}
          </Text>
        </View>

        <ProductCard variant="raised">
          <View style={s.card}>
            {isRecording ? (
              <PrimaryButton
                label={t.dashboard.goToRide}
                onPress={onGoToRide}
                testID="start-ride-go-live"
              />
            ) : (
              <>
                <View style={s.sportRow}>
                  {ACTIVITY_SPORT_OPTIONS.map((option) => (
                    <SportChip
                      key={option.type}
                      label={locale === 'pl' ? option.labelPl : option.labelEn}
                      selected={selectedSport === option.type}
                      onPress={() => setSelectedSport(option.type)}
                      testID={`start-ride-sport-${option.type.toLowerCase()}`}
                    />
                  ))}
                </View>
                <PrimaryButton
                  label={t.dashboard.startRide}
                  onPress={handleStart}
                  testID="start-ride-submit"
                />
              </>
            )}

            <PrimaryButton
              label={t.dashboard.gpsWizard}
              onPress={onOpenGpsWizard}
              variant="secondary"
              testID="start-ride-gps-diagnostics"
            />
          </View>
        </ProductCard>
      </View>
    </SafeAreaView>
  );
};
