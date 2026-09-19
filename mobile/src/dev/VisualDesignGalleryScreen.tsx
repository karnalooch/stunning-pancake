import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Metric, PrimaryButton, ProductCard, SportChip } from '../components/product';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';

const stylesheet = StyleSheet.create((theme) => {
  const semantic = getSemanticColors(theme.colors);

  return {
    root: {
      gap: 16,
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
    body: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.secondary,
    },
    metricRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 16,
    },
  };
});

/**
 * Deterministic Frozen UI v1.2 component inspection surface.
 * Keep fixture values static: this screen is visual-regression input.
 */
export const VisualDesignGalleryScreen: React.FC = () => {
  const s = stylesheet;

  return (
    <View style={s.root} testID="visual-design-gallery">
      <View style={s.section}>
        <Text style={s.title}>Grand Prix Modern</Text>
        <Text style={s.body}>
          Product chrome uses semantic roles. Pixel typography and arcade chrome stay outside routine UI.
        </Text>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Actions</Text>
        <PrimaryButton label="Rozpocznij jazdę" onPress={() => undefined} testID="gallery-primary" />
        <PrimaryButton
          label="Opcje jazdy"
          onPress={() => undefined}
          variant="secondary"
          testID="gallery-secondary"
        />
        <PrimaryButton
          label="Zakończ"
          onPress={() => undefined}
          variant="destructive"
          testID="gallery-destructive"
        />
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Sport selection</Text>
        <View style={s.row}>
          <SportChip label="Rower" selected onPress={() => undefined} />
          <SportChip label="Gravel" selected={false} onPress={() => undefined} />
          <SportChip label="MTB" selected={false} onPress={() => undefined} />
        </View>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Product surfaces</Text>
        <ProductCard variant="raised">
          <View style={s.metricRow}>
            <Metric value="42.8 km" label="Ten tydzień" />
            <Metric value="2 h 14 min" label="Czas jazdy" />
          </View>
        </ProductCard>
        <ProductCard variant="selected">
          <Text style={s.sectionTitle}>Wybrany kontekst</Text>
          <Text style={s.body}>Warm amber selection, never generic green.</Text>
        </ProductCard>
      </View>
    </View>
  );
};
