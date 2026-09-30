/**
 * Dev/capture-only visual workbench index.
 *
 * Rendered only behind `isVisionFixtures()` / `__DEV__`. It is never a
 * product destination. Stable test IDs are part of the visual-proof contract.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { PrimaryButton, ProductCard } from '../components/product';
import { ScrollContainer } from '../components/ScrollContainer';
import { VisualDesignGalleryScreen } from '../dev/VisualDesignGalleryScreen';
import { LAYOUT } from '../theme/layout';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';

export interface VisionGalleryEntry {
  label: string;
  onPress: () => void;
}

interface VisionGalleryScreenProps {
  entries: VisionGalleryEntry[];
}

const stylesheet = StyleSheet.create((theme) => {
  const semantic = getSemanticColors(theme.colors);
  return {
    content: {
      padding: LAYOUT.gutter,
      gap: 20,
    },
    header: {
      gap: 6,
    },
    title: {
      ...PRODUCT_TYPOGRAPHY.title,
      color: semantic.text.primary,
    },
    body: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.secondary,
    },
    fixtureList: {
      gap: 8,
    },
    spacer: {
      height: LAYOUT.tabBarBottomInset,
    },
  };
});

export const VisionGalleryScreen: React.FC<VisionGalleryScreenProps> = ({ entries }) => {
  const s = stylesheet;

  return (
    <ScrollContainer
      style={{ flex: 1 }}
      contentContainerStyle={s.content}
      testID="visual-workbench-scroll"
    >
      <View style={s.header} testID="visual-workbench-header">
        <Text style={s.title}>Visual Workbench</Text>
        <Text style={s.body}>
          Dev-only deterministic inspection. GitHub fixtures are authority; screenshots are evidence.
        </Text>
      </View>

      <VisualDesignGalleryScreen />

      <ProductCard variant="raised">
        <View style={s.fixtureList} testID="visual-workbench-screen-fixtures">
          <Text style={s.title}>Screen fixtures</Text>
          <Text style={s.body}>
            Open exact product surfaces with deterministic data for runtime review.
          </Text>
          {entries.map((entry) => (
            <PrimaryButton
              key={entry.label}
              label={entry.label}
              onPress={entry.onPress}
              variant="secondary"
              testID={`vision-gallery-${entry.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
            />
          ))}
        </View>
      </ProductCard>

      <View style={s.spacer} />
    </ScrollContainer>
  );
};
