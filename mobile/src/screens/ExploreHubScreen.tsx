import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { useI18n } from '../i18n/useI18n';
import { useImmersiveTheme } from '../hooks/useImmersiveTheme';
import { SceneBackground } from '../components/scene/SceneBackground';
import { ChromeIcon } from '../components/ui/ChromeIcon';
import { GameCard } from '../components/ui/GameCard';
import { LAYOUT } from '../theme/layout';

const stylesheet = StyleSheet.create((theme) => {
  const c = theme.colors as Record<string, string>;
  return {
    root: { flex: 1, backgroundColor: c.background },
    ctaRow: {
      flexDirection: 'row',
      gap: 10,
      margin: LAYOUT.gutter,
      marginBottom: LAYOUT.compactGap,
    },
    cta: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderWidth: 2,
      borderColor: c.onBackground,
      borderRadius: 8,
      backgroundColor: c.primaryContainer,
    },
    ctaText: {
      fontSize: 12,
      fontWeight: '700',
      color: c.onPrimaryContainer,
      textTransform: 'uppercase',
    },
    body: { flex: 1, paddingHorizontal: LAYOUT.gutter, paddingBottom: LAYOUT.gutter },
    hint: {
      marginTop: LAYOUT.compactGap,
      fontSize: 12,
      color: c.secondary,
      lineHeight: 18,
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
  const { enabled: immersiveEnabled } = useImmersiveTheme();

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {immersiveEnabled && <SceneBackground sceneId="onboarding" scrim="soft" />}
      <View style={s.ctaRow}>
        <Pressable
          style={({ pressed }) => [s.cta, pressed && { opacity: 0.85 }]}
          onPress={() => onOpenMap?.()}
          accessibilityRole="button"
          accessibilityLabel={t.explore.openMap}
        >
          <ChromeIcon id="map" size={18} />
          <Text style={s.ctaText}>{t.explore.openMap}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [s.cta, pressed && { opacity: 0.85 }]}
          onPress={() => onOpenMarketplace?.()}
          accessibilityRole="button"
          accessibilityLabel={t.explore.openMarketplace}
        >
          <ChromeIcon id="shop" size={18} />
          <Text style={s.ctaText}>{t.explore.openMarketplace}</Text>
        </Pressable>
      </View>
      <View style={s.body}>
        <GameCard texture="parchment_grain">
          <Text style={s.hint}>{t.explore.mapHint}</Text>
          <Text style={s.hint}>{t.explore.marketHint}</Text>
        </GameCard>
      </View>
    </SafeAreaView>
  );
};
