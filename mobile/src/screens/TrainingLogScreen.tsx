import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { ActivityService, type ActivityItem } from '../services/api';
import { useI18n } from '../i18n/useI18n';
import { SkeletonBlock } from '../components/ui/SkeletonBlock';

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
      fontSize: 24,
      fontWeight: '700',
      color: c.primary,
      textTransform: 'uppercase',
    },
    card: {
      backgroundColor: c.parchment,
      margin: 16,
      marginBottom: 0,
      padding: 16,
      borderWidth: 2,
      borderColor: c.onBackground,
      borderRadius: 8,
    },
    label: { fontSize: 10, fontWeight: '700', color: c.secondary, textTransform: 'uppercase' },
    name: { fontSize: 18, fontWeight: '700', color: c.onBackground, marginTop: 4 },
    metric: { fontSize: 16, fontWeight: '600', color: c.primary, marginTop: 6 },
    status: { fontSize: 12, fontWeight: '700', marginTop: 8 },
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
  const c = theme.colors as Record<string, string>;
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
            <Text style={{ color: c.primary, marginBottom: 8 }}>← {t.training.back}</Text>
          </Pressable>
        ) : null}
        <Text style={s.headerTitle}>{t.training.title}</Text>
      </View>
      {loading ? (
        <SkeletonBlock height={120} style={{ margin: 16 }} />
      ) : (
        <ScrollView>
          {items.length === 0 ? (
            <Text style={s.empty}>{t.training.empty}</Text>
          ) : (
            items.map((a) => (
              <Pressable
                key={a.id}
                style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
                onPress={() => onOpenActivity?.(a.id)}
                disabled={!onOpenActivity}
              >
                <Text style={s.label}>{new Date(a.start_time).toLocaleDateString()}</Text>
                <Text style={s.name}>{a.type}</Text>
                <Text style={s.metric}>
                  {(a.distance / 1000).toFixed(1)} km
                  {a.duration ? ` · ${a.duration}` : ''}
                </Text>
                <Text
                  style={[
                    s.status,
                    {
                      color: a.is_verified
                        ? c.primary
                        : a.rejection_reason
                          ? c.error
                          : c.secondary,
                    },
                  ]}
                >
                  {statusLabel(a, t)}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};
