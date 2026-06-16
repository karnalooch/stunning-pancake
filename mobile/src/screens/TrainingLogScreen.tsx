import React, { useEffect, useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { ActivityService, type ActivityItem } from '../services/api';
import { useI18n } from '../i18n/useI18n';
import { SkeletonBlock } from '../components/ui/SkeletonBlock';
import { OrnateFrame } from '../components/ui/OrnateFrame';
import { PixelText } from '../components/PixelText';
import { getVisionActivityHistoryFixture, isVisionFixtures } from '../bootstrap/visionFixtures';

const stylesheet = StyleSheet.create((theme) => {
  const c = theme.colors as Record<string, string>;
  return {
    container: { flex: 1, backgroundColor: c.background },
    header: {
      padding: 16,
      borderBottomWidth: 4,
      borderBottomColor: c.onBackground,
      backgroundColor: c.surface,
    },
    headerTitle: {
      fontSize: 16,
      color: c.primary,
      textTransform: 'uppercase',
    },
    cardWrap: { margin: 16, marginBottom: 0 },
    label: { fontSize: 10, color: c.secondary, textTransform: 'uppercase' },
    name: { fontSize: 14, color: c.onBackground, marginTop: 4 },
    metric: { fontSize: 16, color: c.primary, marginTop: 6 },
    status: { fontSize: 12, marginTop: 8 },
    empty: { textAlign: 'center', color: c.secondary, marginTop: 32 },
  };
});

function statusLabel(
  item: ActivityItem,
  t: ReturnType<typeof useI18n.getState>['t'],
): string {
  if (item.is_verified) return t.training.verified;
  if (item.rejection_reason) return `${t.training.rejected}: ${item.rejection_reason}`;
  return t.training.pending;
}

interface TrainingLogScreenProps {
  onBack?: () => void;
  onOpenActivity?: (activityId: number) => void;
}

export const TrainingLogScreen: React.FC<TrainingLogScreenProps> = ({ onBack, onOpenActivity }) => {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const s = stylesheet;
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fixture = getVisionActivityHistoryFixture(isVisionFixtures());
    if (fixture) {
      setItems(fixture as unknown as ActivityItem[]);
      setLoading(false);
      return;
    }
    ActivityService.getHistory()
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        {onBack ? (
          <Pressable onPress={onBack}>
            <PixelText color="primary" size="sm">← {t.training.back}</PixelText>
          </Pressable>
        ) : null}
        <PixelText style={s.headerTitle}>{t.training.title}</PixelText>
      </View>
      {loading ? (
        <SkeletonBlock height={120} style={{ margin: 16 }} />
      ) : (
        <ScrollView>
          {items.length === 0 ? (
            <PixelText size="sm" color="secondary">{t.training.empty}</PixelText>
          ) : (
            items.map((a) => (
              <Pressable
                key={a.id}
                style={({ pressed }) => [s.cardWrap, pressed && { opacity: 0.85 }]}
                onPress={() => onOpenActivity?.(a.id)}
                disabled={!onOpenActivity}
              >
                <OrnateFrame>
                  <PixelText style={s.label}>{new Date(a.start_time).toLocaleDateString()}</PixelText>
                  <PixelText style={s.name}>{a.type}</PixelText>
                  <PixelText size="lg" color="primary">
                    {(a.distance / 1000).toFixed(1)} km
                    {a.duration ? ` · ${a.duration}` : ''}
                  </PixelText>
                  <PixelText
                    size="sm"
                    color={
                      a.is_verified
                        ? 'primary'
                        : a.rejection_reason
                          ? 'error'
                          : 'secondary'
                    }
                  >
                    {statusLabel(a, t)}
                  </PixelText>
                </OrnateFrame>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};
