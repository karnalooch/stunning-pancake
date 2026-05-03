import React, { useEffect } from 'react';
import { Share, Image } from 'react-native';
import { YStack, XStack, ScrollView, View } from 'tamagui';
import { observer, useObservable } from '@legendapp/state/react';
import { ActivityService, ActivityItem } from '../services/api';

import { GameCard } from '../components/arcade/GameCard';
import { PixelText } from '../components/arcade/PixelText';
import { ArcadeButton } from '../components/arcade/ArcadeButton';
import { AthleteSprite } from '../components/AthleteSprite';

const GRADE_ICONS: Record<string, any> = {
  S: require('../../assets/generated/grade_s.png'),
  A: require('../../assets/generated/grade_a.png'),
};

const verificationGrade = (score: number): { label: string; color: string } => {
  if (score >= 0.95) return { label: 'S', color: '#D4A373' }; // Gold
  if (score >= 0.85) return { label: 'A', color: '#7BA05B' }; // Green
  if (score >= 0.70) return { label: 'B', color: '#60A5FA' }; // Blue
  if (score >= 0.50) return { label: 'C', color: '#FFB800' }; // Yellow
  return { label: 'D', color: '#EF4444' }; // Red
};

export const ActivitiesScreen = observer(() => {
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
    <YStack flex={1} backgroundColor="#0B1D33" paddingTop="$10" paddingHorizontal="$4">
      <XStack justifyContent="space-between" alignItems="center" marginBottom="$6">
        <PixelText size={18} color="#D4A373" shadow>QUEST_LOG</PixelText>
        <PixelText size={8} color="#7BA05B">
          {activities.length} MISSIONS RECORDED
        </PixelText>
      </XStack>

      <ScrollView showsVerticalScrollIndicator={false}>
        <YStack gap="$4" paddingBottom="$10">
          {state.loading.get() && activities.length === 0 && (
            <YStack padding="$10" alignItems="center">
              <AthleteSprite type="runner" state="action" size={60} />
              <PixelText size={10} color="#D4A373" style={{ marginTop: 16 }}>
                SCANNING SESSION LOGS...
              </PixelText>
            </YStack>
          )}

          {!state.loading.get() && activities.length === 0 && (
            <YStack padding="$10" alignItems="center">
              <AthleteSprite type="ghost" state="idle" size={60} />
              <PixelText size={10} color="#9CA3AF" style={{ marginTop: 16 }}>
                NO MISSIONS COMPLETED YET
              </PixelText>
              <PixelText size={8} color="#7BA05B" style={{ marginTop: 8 }}>
                GO TO HOME TO BEGIN
              </PixelText>
            </YStack>
          )}

          {activities.map((act) => {
            const grade = verificationGrade(act.verification_score || 0);
            return (
              <GameCard key={act.id} variant="metal" padding={12}>
                <XStack alignItems="center" gap="$3">
                  <View
                    backgroundColor="#0B1D33"
                    borderWidth={2}
                    borderColor={grade.color}
                    alignItems="center"
                    justifyContent="center"
                    width={48}
                    height={48}
                  >
                    {GRADE_ICONS[grade.label] ? (
                      <Image source={GRADE_ICONS[grade.label]} style={{ width: 32, height: 32 }} resizeMode="contain" />
                    ) : (
                      <PixelText color={grade.color} size={20} shadow>
                        {grade.label}
                      </PixelText>
                    )}
                  </View>

                  <YStack flex={1}>
                    <PixelText size={12} color="#FFFFFF" shadow>
                      {act.type?.toUpperCase() || 'UNKNOWN'} MISSION
                    </PixelText>
                    <PixelText size={8} color="#9CA3AF" style={{ marginTop: 6 }}>
                      {new Date(act.start_time).toLocaleDateString()} · {((act.distance || 0) / 1000).toFixed(2)} KM
                    </PixelText>
                  </YStack>

                  <ArcadeButton
                    size="sm"
                    label="SHARE"
                    variant="blue"
                    fullWidth={false}
                    onPress={() => handleShare(act)}
                  />
                </XStack>
              </GameCard>
            );
          })}
        </YStack>
      </ScrollView>

      <PixelText size={8} color="#9CA3AF" style={{ textAlign: 'center', opacity: 0.5, paddingVertical: 12 }}>
        QUEST LOG · RPG CHARACTER SHEET v2.0
      </PixelText>
    </YStack>
  );
});
