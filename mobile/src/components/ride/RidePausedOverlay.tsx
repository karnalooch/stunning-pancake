import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { ProductCard } from '../product';
import { getSemanticColors } from '../../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../../theme/typography';
import { RideActionBar } from './RideActionBar';
import { useI18n } from '../../i18n/useI18n';

interface RidePausedOverlayProps {
  onResume: () => void;
  onStop: () => void;
}

const stylesheet = StyleSheet.create((theme) => {
  const c = theme.colors as Record<string, string>;
  const semantic = getSemanticColors(theme.colors);

  return {
    scrim: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 20,
      justifyContent: 'flex-end',
      paddingHorizontal: 12,
      paddingBottom: 12,
      backgroundColor: c.ridePausedScrim,
    },
    card: {
      gap: 18,
    },
    copy: {
      gap: 6,
    },
    eyebrow: {
      ...PRODUCT_TYPOGRAPHY.metricLabel,
      color: semantic.status.warning,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    title: {
      ...PRODUCT_TYPOGRAPHY.title,
      color: semantic.text.primary,
    },
    body: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.secondary,
    },
  };
});

/**
 * In-place PAUSED state for Active Ride.
 *
 * The Ride map/data planes remain mounted underneath the scrim. This is not a
 * navigation destination; semantic lifecycle authority lives in RideController.
 */
export const RidePausedOverlay: React.FC<RidePausedOverlayProps> = ({
  onResume,
  onStop,
}) => {
  const s = stylesheet;
  const { t } = useI18n();

  return (
    <View
      testID="ride-paused-overlay"
      style={s.scrim}
      accessibilityViewIsModal
    >
      <ProductCard variant="raised" testID="ride-paused-card">
        <View style={s.card}>
          <View style={s.copy}>
            <Text style={s.eyebrow}>{t.ride.actions.pause}</Text>
            <Text style={s.title}>{t.ride.paused.title}</Text>
            <Text style={s.body}>{t.ride.actions.stopConfirm}</Text>
          </View>
          <RideActionBar
            isPaused
            onResume={onResume}
            onStop={onStop}
            resumeTestID="ride-paused-resume"
            stopTestID="ride-paused-stop"
          />
        </View>
      </ProductCard>
    </View>
  );
};
