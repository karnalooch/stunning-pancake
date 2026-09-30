import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { ProductCard } from '../components/product';
import { RideActionBar } from '../components/ride/RideActionBar';
import { useI18n } from '../i18n/useI18n';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';

const stylesheet = StyleSheet.create((theme) => {
  const c = theme.colors as Record<string, string>;
  const semantic = getSemanticColors(theme.colors);

  return {
    overlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 30,
      justifyContent: 'flex-end',
      padding: 16,
      backgroundColor: c.ridePausedScrim,
    },
    cardWrap: {
      width: '100%',
      maxWidth: 440,
      alignSelf: 'center',
    },
    content: {
      gap: 20,
    },
    copy: {
      gap: 8,
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

interface Props {
  onResume: () => void;
  onStop: () => void;
}

export const RidePausedScreen: React.FC<Props> = ({ onResume, onStop }) => {
  const s = stylesheet;
  const { t } = useI18n();

  return (
    <SafeAreaView
      testID="ride-paused-screen"
      style={s.overlay}
      edges={['bottom']}
    >
      <View style={s.cardWrap}>
        <ProductCard variant="raised" testID="ride-paused-card">
          <View style={s.content}>
            <View style={s.copy}>
              <Text style={s.eyebrow}>{t.ride.actions.pause}</Text>
              <Text style={s.title} allowFontScaling>
                {t.ride.paused.title}
              </Text>
              <Text style={s.body} allowFontScaling>
                {t.ride.actions.stopConfirm}
              </Text>
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
    </SafeAreaView>
  );
};
