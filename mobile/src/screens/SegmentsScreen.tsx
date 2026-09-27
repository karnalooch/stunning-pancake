import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { ProductCard } from '../components/product/ProductCard';
import { EmptyState } from '../components/ui/EmptyState';
import { useI18n } from '../i18n/useI18n';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';

const stylesheet = StyleSheet.create((theme) => {
  const semantic = getSemanticColors(theme.colors);
  return {
    container: {
      flex: 1,
      backgroundColor: semantic.canvas.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 12,
      gap: 4,
    },
    title: {
      ...PRODUCT_TYPOGRAPHY.title,
      color: semantic.text.primary,
    },
    subtitle: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.secondary,
    },
    content: {
      paddingHorizontal: 16,
      paddingBottom: 40,
    },
  };
});

export const SegmentsScreen: React.FC = () => {
  const { t } = useI18n();
  const s = stylesheet;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>{t.segments.title}</Text>
        <Text style={s.subtitle}>{t.segments.subtitle}</Text>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <ProductCard>
          <EmptyState
            message={t.settings.comingSoon}
            hint={t.segments.subtitle}
          />
        </ProductCard>
      </ScrollView>
    </SafeAreaView>
  );
};
