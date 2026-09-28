import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { DevEnvironmentBanner } from '../components/DevEnvironmentBanner';
import { GpsRecoveryBanner } from '../components/GpsRecoveryBanner';
import { PrimaryButton, ProductCard, SportChip } from '../components/product';
import { EdgeStateBanner } from '../components/ui/EdgeStateBanner';
import { useI18n } from '../i18n/useI18n';
import type { ActivitySportType } from '../services/api';
import type { RideEdgeMessage } from '../services/apiRetry';
import { LAYOUT } from '../theme/layout';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';
import { ACTIVITY_SPORT_OPTIONS } from '../types/activitySport';

const stylesheet = StyleSheet.create((theme) => {
  const semantic = getSemanticColors(theme.colors);

  return {
    container: {
      flex: 1,
      backgroundColor: semantic.canvas.background,
    },
    content: {
      padding: LAYOUT.gutter,
      paddingBottom: 120,
      gap: LAYOUT.sectionGap,
    },
    heading: {
      gap: 6,
      paddingTop: 8,
    },
    title: {
      ...PRODUCT_TYPOGRAPHY.title,
      color: semantic.text.primary,
    },
    subtitle: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.secondary,
    },
    cardContent: {
      gap: 16,
    },
    sportRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
  };
});

type StartRideScreenProps = {
  isRecording: boolean;
  onStartRide: (sport: ActivitySportType) => void;
  onGoToRide: () => void;
  gpsRecoveryVisible?: boolean;
  gpsRecoveryBusy?: boolean;
  onGpsRecoveryPress?: () => void;
  startRideError?: string | null;
  onDismissStartRideError?: () => void;
  rideEdgeMessage?: RideEdgeMessage | null;
  onDismissRideEdgeMessage?: () => void;
};

export const StartRideScreen: React.FC<StartRideScreenProps> = ({
  isRecording,
  onStartRide,
  onGoToRide,
  gpsRecoveryVisible = false,
  gpsRecoveryBusy = false,
  onGpsRecoveryPress,
  startRideError,
  onDismissStartRideError,
  rideEdgeMessage,
  onDismissRideEdgeMessage,
}) => {
  const s = stylesheet;
  const { t, locale } = useI18n();
  const [selectedSport, setSelectedSport] = useState<ActivitySportType>('BIKE');

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.heading}>
          <Text style={s.title}>{t.dashboard.startRide}</Text>
          <Text style={s.subtitle}>
            {isRecording ? t.dashboard.inProgress : t.dashboard.ready}
          </Text>
        </View>

        <DevEnvironmentBanner />

        {rideEdgeMessage ? (
          <EdgeStateBanner
            title={rideEdgeMessage.title}
            message={rideEdgeMessage.message}
            variant={rideEdgeMessage.variant}
            onDismiss={onDismissRideEdgeMessage}
          />
        ) : null}

        {startRideError ? (
          <EdgeStateBanner
            title={t.errors.startRide}
            message={startRideError}
            onDismiss={onDismissStartRideError}
          />
        ) : null}

        <GpsRecoveryBanner
          visible={gpsRecoveryVisible}
          busy={gpsRecoveryBusy}
          onPress={() => onGpsRecoveryPress?.()}
        />

        <ProductCard variant="raised">
          <View style={s.cardContent}>
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
                  onPress={() => onStartRide(selectedSport)}
                  testID="start-ride-primary"
                />
              </>
            )}
          </View>
        </ProductCard>
      </ScrollView>
    </SafeAreaView>
  );
};
