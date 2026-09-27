import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { PrimaryButton, ProductCard } from '../components/product';
import { useI18n } from '../i18n/useI18n';
import { LAYOUT } from '../theme/layout';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';

const stylesheet = StyleSheet.create((theme) => {
  const semantic = getSemanticColors(theme.colors);

  return {
    root: {
      flex: 1,
      backgroundColor: semantic.canvas.background,
    },
    header: {
      minHeight: 72,
      paddingHorizontal: LAYOUT.gutter,
      paddingVertical: 12,
      justifyContent: 'center',
      backgroundColor: semantic.surface.raised,
      borderBottomWidth: 1,
      borderBottomColor: semantic.border.subtle,
    },
    title: {
      ...PRODUCT_TYPOGRAPHY.title,
      color: semantic.text.primary,
    },
    content: {
      padding: LAYOUT.gutter,
      gap: LAYOUT.sectionGap,
      paddingBottom: 112,
    },
    cardContent: {
      gap: 12,
    },
    cardTitle: {
      ...PRODUCT_TYPOGRAPHY.title,
      fontSize: 20,
      lineHeight: 26,
      color: semantic.text.primary,
    },
    hint: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.secondary,
    },
  };
});

interface ExploreHubScreenProps {
  onOpenMap?: () => void;
  onOpenMarketplace?: () => void;
}

export const ExploreHubScreen: React.FC<ExploreHubScreenProps> = ({
  onOpenMap,
  onOpenMarketplace,
}) => {
  const { t } = useI18n();
  const s = stylesheet;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>{t.tabs.explore}</Text>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <ProductCard variant="raised" testID="explore-map-card">
          <View style={s.cardContent}>
            <Text style={s.cardTitle}>{t.explore.map}</Text>
            <Text style={s.hint}>{t.explore.mapHint}</Text>
            <PrimaryButton
              label={t.explore.openMap}
              onPress={() => onOpenMap?.()}
              testID="explore-open-map"
            />
          </View>
        </ProductCard>

        <ProductCard testID="explore-marketplace-card">
          <View style={s.cardContent}>
            <Text style={s.cardTitle}>{t.explore.shop}</Text>
            <Text style={s.hint}>{t.explore.marketHint}</Text>
            <PrimaryButton
              label={t.explore.openMarketplace}
              onPress={() => onOpenMarketplace?.()}
              variant="secondary"
              testID="explore-open-marketplace"
            />
          </View>
        </ProductCard>
      </ScrollView>
    </SafeAreaView>
  );
};
