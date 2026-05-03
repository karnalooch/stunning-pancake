import React, { useEffect } from 'react';
import { Share } from 'react-native';
import { YStack, XStack, Text as TamaText, ScrollView, useTheme, View } from 'tamagui';
import { observer, useObservable } from '@legendapp/state/react';
import { ActivityService, ActivityItem } from '../services/api';

import { RetroCard } from '../components/RetroCard';
import { HD2DButton } from '../components/HD2DButton';
import { AthleteSprite } from '../components/AthleteSprite';

const verificationGrade = (score: number): { label: string; color: string } => {
  if (score >= 0.95) return { label: 'S', color: '#D4A373' };
  if (score >= 0.85) return { label: 'A', color: '#7BA05B' };
  if (score >= 0.70) return { label: 'B', color: '#60A5FA' };
  if (score >= 0.50) return { label: 'C', color: '#FFB800' };
  return { label: 'D', color: '#EF4444' };
};

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
          `Grade: ${verificationGrade(act.verification_score).label}`,
        ].join(' · '),
      });
    } catch (e) {
      console.warn('[Activities] Share failed:', e);
    }
  };

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop="$10" paddingHorizontal="$4">
      <XStack justifyContent="space-between" alignItems="center" marginBottom="$6">
        <TamaText fontFamily="$pixel" fontSize={18} color="$color">QUEST_LOG</TamaText>
        <TamaText fontFamily="$pixel" fontSize={8} color="$primary">
          {activities.length} MISSIONS RECORDED
        </TamaText>
      </XStack>

      <ScrollView showsVerticalScrollIndicator={false}>
        <YStack gap="$3" paddingBottom="$10">
          {state.loading.get() && activities.length === 0 && (
            <YStack padding="$10" alignItems="center">
              <AthleteSprite type="runner" state="action" size={60} />
              <TamaText color="$primary" fontFamily="$pixel" fontSize={10} marginTop="$4">
                SCANNING SESSION LOGS...
              </TamaText>
            </YStack>
          )}

          {!state.loading.get() && activities.length === 0 && (
            <YStack padding="$10" alignItems="center">
              <AthleteSprite type="ghost" state="idle" size={60} />
              <TamaText color="$color" opacity={0.5} fontFamily="$pixel" fontSize={10} marginTop="$4">
                NO MISSIONS COMPLETED YET
              </TamaText>
              <TamaText color="$primary" fontFamily="$pixel" fontSize={8} marginTop="$2">
                PRESS "START MISSION" TO BEGIN
              </TamaText>
            </YStack>
          )}

          {activities.map((act) => {
            const grade = verificationGrade(act.verification_score || 0);
            return (
              <RetroCard key={act.id} padding="$3">
                <XStack alignItems="center" gap="$3">
                  <View
                    backgroundColor="$backgroundStrong"
                    padding="$2"
                    borderWidth={2}
                    borderColor={grade.color}
                    alignItems="center"
                    justifyContent="center"
                    minWidth={44}
                    minHeight={44}
                  >
                    <TamaText
                      color={grade.color}
                      fontWeight="900"
                      fontSize={18}
                      fontFamily="$pixel"
                    >
                      {grade.label}
                    </TamaText>
                  </View>

                  <YStack flex={1}>
                    <TamaText color="$color" fontWeight="900" fontSize={14} fontFamily="$pixel">
                      {act.type?.toUpperCase() || 'UNKNOWN'} MISSION
                    </TamaText>
                    <TamaText color="$color" fontSize={10} opacity={0.6} fontFamily="$pixel" marginTop="$1">
                      {new Date(act.start_time).toLocaleDateString()} ·{' '}
                      {((act.distance || 0) / 1000).toFixed(2)} KM
                    </TamaText>
                  </YStack>

                  <HD2DButton
                    size="$2"
                    label="↗"
                    onPress={() => handleShare(act)}
                    backgroundColor="transparent"
                    paddingHorizontal="$2"
                  />
                </XStack>
              </RetroCard>
            );
          })}
        </YStack>
      </ScrollView>

      <TamaText textAlign="center" fontSize={8} color="$color" opacity={0.3} paddingVertical="$2" fontFamily="$pixel">
        QUEST LOG · RPG CHARACTER SHEET v2.0
      </TamaText>
    </YStack>
  );
});
