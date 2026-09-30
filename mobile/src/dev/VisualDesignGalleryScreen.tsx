import React, { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { APPROVED_ASSETS } from '../assets/approvedAssets';
import { EdgeStateBanner } from '../components/ui/EdgeStateBanner';
import { Metric, PrimaryButton, ProductCard, SportChip } from '../components/product';
import { RideActionBar } from '../components/ride/RideActionBar';
import { RideNavigationHint } from '../components/ride/RideNavigationHint';
import { RideStatusBar } from '../components/ride/RideStatusBar';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';
import { VISUAL_WORKBENCH_FIXTURES } from './visualWorkbenchFixtures';

const noop = () => undefined;

const stylesheet = StyleSheet.create((theme) => {
  const semantic = getSemanticColors(theme.colors);

  return {
    root: {
      gap: 20,
    },
    section: {
      gap: 10,
    },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    title: {
      ...PRODUCT_TYPOGRAPHY.title,
      color: semantic.text.primary,
    },
    sectionTitle: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.text.primary,
    },
    eyebrow: {
      ...PRODUCT_TYPOGRAPHY.metricLabel,
      color: semantic.text.secondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    body: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.secondary,
    },
    metricRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 16,
    },
    heroMetric: {
      gap: 3,
      alignItems: 'flex-start',
    },
    heroValue: {
      ...PRODUCT_TYPOGRAPHY.metric,
      color: semantic.text.primary,
      fontSize: 44,
      lineHeight: 48,
      fontVariant: ['tabular-nums'],
    },
    heroUnit: {
      ...PRODUCT_TYPOGRAPHY.metricLabel,
      color: semantic.text.secondary,
      textTransform: 'uppercase',
    },
    brandImage: {
      width: '100%',
      aspectRatio: 640 / 264,
      borderRadius: 12,
    },
    markerImage: {
      width: 48,
      height: 48,
    },
    assetOff: {
      minHeight: 96,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: semantic.border.subtle,
      borderRadius: 12,
      padding: 14,
      justifyContent: 'center',
      gap: 4,
    },
  };
});

/**
 * Repo-native visual component workbench.
 *
 * This is dev/fixture tooling, never a product destination. Fixture values and
 * test IDs are intentionally stable because Maestro/runtime screenshots use
 * this surface as review evidence.
 *
 * Storybook may wrap the same components/fixtures later; GitHub remains the
 * source of truth for fixtures and accepted component state.
 */
export const VisualDesignGalleryScreen: React.FC = () => {
  const s = stylesheet;
  const [brandEnabled, setBrandEnabled] = useState(true);
  const fixture = VISUAL_WORKBENCH_FIXTURES;

  return (
    <View style={s.root} testID="visual-workbench">
      <View style={s.section} testID="visual-workbench-intro">
        <Text style={s.title}>4VELO Visual Workbench</Text>
        <Text style={s.body}>
          Production components, deterministic fixtures, map/data/control/brand planes.
        </Text>
      </View>

      <View style={s.section} testID="visual-workbench-actions">
        <Text style={s.eyebrow}>Control plane · product actions</Text>
        <PrimaryButton label="Rozpocznij jazdę" onPress={noop} testID="workbench-primary" />
        <PrimaryButton
          label="Opcje jazdy"
          onPress={noop}
          variant="secondary"
          testID="workbench-secondary"
        />
        <PrimaryButton
          label="Zakończ"
          onPress={noop}
          variant="destructive"
          testID="workbench-destructive"
        />
      </View>

      <View style={s.section} testID="visual-workbench-sports">
        <Text style={s.eyebrow}>Start Ride · selection</Text>
        <View style={s.row}>
          <SportChip label="Rower" selected onPress={noop} />
          <SportChip label="Gravel" selected={false} onPress={noop} />
          <SportChip label="MTB" selected={false} onPress={noop} />
        </View>
      </View>

      <View style={s.section} testID="visual-workbench-data-plane">
        <Text style={s.eyebrow}>Data plane · moving</Text>
        <ProductCard variant="raised">
          <View style={s.heroMetric}>
            <Text style={s.heroValue}>31.4</Text>
            <Text style={s.heroUnit}>km/h · średnia</Text>
          </View>
          <View style={s.metricRow}>
            <Metric value="42.8 km" label="Dystans" />
            <Metric value="1:22:17" label="Czas" />
            <Metric value="+438 m" label="Przewyższenie" />
          </View>
        </ProductCard>
      </View>

      <View style={s.section} testID="visual-workbench-guidance">
        <Text style={s.eyebrow}>Map plane · guidance</Text>
        <RideNavigationHint
          text={fixture.guidance.text}
          distanceM={fixture.guidance.distanceM}
        />
        <RideStatusBar
          gpsLocked
          batteryPct={fixture.batteryPct}
          clockText={fixture.clock}
        />
        <RideStatusBar
          gpsLocked={false}
          batteryPct={fixture.batteryPct}
          clockText={fixture.clock}
        />
      </View>

      <View style={s.section} testID="visual-workbench-ride-controls">
        <Text style={s.eyebrow}>Control plane · active</Text>
        <RideActionBar
          isPaused={false}
          onPause={noop}
          onResume={noop}
          onStop={noop}
        />
        <Text style={s.eyebrow}>Control plane · paused</Text>
        <RideActionBar
          isPaused
          onPause={noop}
          onResume={noop}
          onStop={noop}
        />
      </View>

      <View style={s.section} testID="visual-workbench-truth-states">
        <Text style={s.eyebrow}>Truth states</Text>
        <EdgeStateBanner
          variant="warning"
          title="GPS degraded"
          message="Nagrywanie trwa. Dokładność pozycji jest chwilowo obniżona."
        />
        <EdgeStateBanner
          variant="offline"
          title="Offline"
          message="Punkty pozostają w zaszyfrowanym outboxie do bezpiecznej synchronizacji."
        />
        <EdgeStateBanner
          variant="success"
          title="Durable success"
          message="Aktywność i telemetria zostały trwale zapisane."
        />
        <EdgeStateBanner
          variant="warning"
          title="Pending finalization"
          message="Nie pokazuj celebracji, dopóki finalizacja nie jest trwała."
        />
      </View>

      <View style={s.section} testID="visual-workbench-brand-plane">
        <Text style={s.eyebrow}>Brand / emotion plane · optional</Text>
        <PrimaryButton
          label={brandEnabled ? 'Wyłącz brand art' : 'Włącz brand art'}
          variant="secondary"
          onPress={() => setBrandEnabled((value) => !value)}
          testID="workbench-toggle-brand"
        />
        {brandEnabled ? (
          <>
            <Image
              source={APPROVED_ASSETS.homeHeroDay}
              resizeMode="cover"
              style={s.brandImage}
              testID="workbench-brand-hero"
            />
            <Image
              source={APPROVED_ASSETS.rideMarkerRider}
              resizeMode="contain"
              style={s.markerImage}
              testID="workbench-brand-marker"
            />
          </>
        ) : (
          <View style={s.assetOff} testID="workbench-asset-off">
            <Text style={s.sectionTitle}>Asset-off PASS target</Text>
            <Text style={s.body}>
              Hierarchia, metryki, guidance i kontrolki powyżej muszą pozostać kompletne bez ilustracji.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};
