import React, { useEffect } from 'react';
import { Share } from 'react-native';
import { Activity, TrendingUp } from 'lucide-react-native';
import { YStack, XStack, Text as TamaText, ScrollView, useTheme, View } from 'tamagui';
import { observer, useObservable } from '@legendapp/state/react';
import { ActivityService, ActivityItem } from '../services/api';

import { RetroCard } from '../components/RetroCard';
import { HD2DButton } from '../components/HD2DButton';
import { AthleteSprite } from '../components/AthleteSprite';

const ActivityIcon = Activity as any;
const TrendingIcon = TrendingUp as any;

export const ActivitiesScreen = observer(() => {
  const theme = useTheme();
  const state = useObservable({
    activities: [] as ActivityItem[],
    loading: true,
  });

  useEffect(() => {
    (async () => {
      try {
        state.loading.set(true);
        const data = await ActivityService.getHistory();
        state.activities.set(Array.isArray(data) ? data : []);
      } catch (e) {
        console.warn('[Activities] Fetch failed:', e);
      } finally {
        state.loading.set(false);
      }
    })();
  }, []);

  const activities = state.activities.get() || [];

  const handleShare = async (act: ActivityItem) => {
    try {
      await Share.share({
        message: [
          `${act.type} session on SPORT!`,
          `Distance: ${((act.distance || 0) / 1000).toFixed(2)} km`,
          `Verified: ${Math.round((act.verification_score || 0) * 100)}%`,
        ].join(' · '),
      });
    } catch (e) {
      console.warn('[Activities] Share failed:', e);
    }
  };

  const verificationColor = (score: number) => {
    if (score >= 0.9) return '#10B981';
    if (score >= 0.7) return '#FFB800';
    return '#EF4444';
  };

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop="$10" paddingHorizontal="$4">
      <XStack justifyContent="space-between" alignItems="center" marginBottom="$6">
        <TamaText fontFamily="$pixel" fontSize={18} color="$color">MISSION_LOG</TamaText>
        <TrendingIcon size={24} color={theme.accent?.get()} />
      </XStack>

      <ScrollView showsVerticalScrollIndicator={false}>
        <YStack gap="$3" paddingBottom="$10">
          {state.loading.get() && activities.length === 0 && (
            <YStack padding="$10" alignItems="center">
              <AthleteSprite type="runner" state="idle" size={60} />
              <TamaText color="$color" opacity={0.5} fontFamily="$pixel" fontSize={10} marginTop="$4">
                LOADING_SESSIONS...
              </TamaText>
            </YStack>
          )}

          {!state.loading.get() && activities.length === 0 && (
            <YStack padding="$10" alignItems="center">
              <AthleteSprite type="runner" state="idle" size={60} />
              <TamaText color="$color" opacity={0.5} fontFamily="$pixel" fontSize={10} marginTop="$4">
                NO_SESSIONS_RECORDED
              </TamaText>
            </YStack>
          )}

          {activities.map((act) => (
            <RetroCard key={act.id} padding="$3">
              <XStack alignItems="center" gap="$3">
                <View
                  backgroundColor="$backgroundStrong"
                  padding="$2"
                  borderWidth={1}
                  borderColor="$outlineColor"
                  alignItems="center"
                  justifyContent="center"
                >
                  <ActivityIcon size={20} color={theme.accent?.get()} />
                </View>

                <YStack flex={1}>
                  <TamaText color="$color" fontWeight="900" fontSize={14} fontFamily="$pixel">
                    {act.type?.toUpperCase() || 'UNKNOWN'} SESSION
                  </TamaText>
                  <TamaText color="$color" fontSize={10} opacity={0.6} fontFamily="$pixel" marginTop="$1">
                    {new Date(act.start_time).toLocaleDateString()} ·{' '}
                    {((act.distance || 0) / 1000).toFixed(2)} KM
                  </TamaText>
                </YStack>

                <View
                  backgroundColor="$backgroundStrong"
                  paddingHorizontal="$2"
                  paddingVertical="$1"
                  borderWidth={1}
                  borderColor={verificationColor(act.verification_score || 0)}
                >
                  <TamaText
                    color={verificationColor(act.verification_score || 0)}
                    fontSize={9}
                    fontWeight="900"
                    fontFamily="$pixel"
                  >
                    {Math.round((act.verification_score || 0) * 100)}%
                  </TamaText>
                </View>

                <HD2DButton
                  size="$2"
                  label="↗"
                  onPress={() => handleShare(act)}
                  backgroundColor="transparent"
                  paddingHorizontal="$2"
                />
              </XStack>
            </RetroCard>
          ))}
        </YStack>
      </ScrollView>

      <TamaText textAlign="center" fontSize={8} color="$color" opacity={0.3} paddingVertical="$2" fontFamily="$pixel">
        MISSION_LOG · HD-2D DEEP SEA EDITION
      </TamaText>
    </YStack>
  );
});
