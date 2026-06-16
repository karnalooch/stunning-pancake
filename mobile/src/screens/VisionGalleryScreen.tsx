/**
 * VisionGalleryScreen — dev/capture-only index of every screen.
 *
 * Rendered only behind `isVisionFixtures()` / `__DEV__`. Gives the parity
 * harness deterministic navigation targets (deep link `fourvelo://vision-gallery`)
 * so each screen can be screenshotted without walking the full product flow.
 */
import React from 'react';
import { View } from 'react-native';
import { Column } from '../components/Column';
import { PixelText } from '../components/PixelText';
import { ArcadeButton } from '../components/ArcadeButton';
import { ScrollContainer } from '../components/ScrollContainer';
import { LAYOUT } from '../theme/layout';

export interface VisionGalleryEntry {
  label: string;
  onPress: () => void;
}

interface VisionGalleryScreenProps {
  entries: VisionGalleryEntry[];
}

export const VisionGalleryScreen: React.FC<VisionGalleryScreenProps> = ({ entries }) => {
  return (
    <ScrollContainer style={{ flex: 1 }} contentContainerStyle={{ padding: LAYOUT.gutter }}>
      <Column gap={12}>
        <PixelText size="lg" style={{ marginBottom: 8 }}>
          VISION GALLERY
        </PixelText>
        <PixelText size="xs" color="muted" style={{ marginBottom: 8 }}>
          Tryb przechwytywania — ekrany z danymi fixtures do porównań 1:1.
        </PixelText>
        {entries.map((entry) => (
          <ArcadeButton
            key={entry.label}
            label={entry.label}
            onPress={entry.onPress}
            variant="secondary"
            size="md"
            testID={`vision-gallery-${entry.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
          />
        ))}
        <View style={{ height: LAYOUT.tabBarBottomInset }} />
      </Column>
    </ScrollContainer>
  );
};
