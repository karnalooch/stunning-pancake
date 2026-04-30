import React, { useEffect } from 'react';
import { Share } from 'react-native';
import { Activity, TrendingUp, Share2 } from 'lucide-react-native';
import { YStack, XStack, Text as TamaText, ScrollView, useTheme, View } from 'tamagui';
import { observer, useObservable } from '@legendapp/state/react';
import { ActivityService } from '../services/api';

import { RetroCard } from '../components/RetroCard';
import { HD2DButton } from '../components/HD2DButton';
import { AthleteSprite } from '../components/AthleteSprite';

const ActivityIcon = Activity as any;
const TrendingIcon = TrendingUp as any;
const ShareIcon = Share2 as any;

export const ActivitiesScreen = observer(() => {
  const theme = useTheme();
  const state = useObservable({
    activities: [] as any[],
    loading: true
  });

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        state.loading.set(true);
        const data = await ActivityService.getHistory();
        state.activities.set(data);
      } catch (e) {
        console.error("History fetch error:", e);
      } finally {
        state.loading.set(false);
      }
    };
    fetchHistory();
  }, []);

  const activities = (state.activities.get() || []) as any[];

  const handleShare = async (act: any) => {
    try {
      await Share.share({
        message: `I just finished a ${act.type} session on SPORT! Distance: ${(act.distance / 1000).toFixed(2)} km. Verification Score: ${Math.round(act.verification_score * 100)}%. Join me!`,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const getVerificationColor = (score: number) => {
    if (score >= 0.9) return '#00FF94'; // success green
    if (score >= 0.7) return '#FFB800'; // warning
    return '#FF4B4B'; // error red
  };

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop="$10" paddingHorizontal="$4">
      <XStack justifyContent="space-between" alignItems="center" marginBottom="$6">
        <TamaText fontFamily="$pixel" fontSize={18} color="$color">MISSION_LOG</TamaText>
        <TrendingIcon size={24} color={theme.accent?.get()} />
      </XStack>

      <ScrollView showsVerticalScrollIndicator={false}>
        <YStack gap="$3" paddingBottom="$10">
          {activities.length === 0 && !state.loading.get() && (
            <YStack padding="$10" alignItems="center">
              <AthleteSprite type="runner" state="idle" size={60} />
              <TamaText color="$color" opacity={0.5} fontFamily="$pixel" fontSize={10} marginTop="$4">NO_SESSIONS_RECORDED</TamaText>
            </YStack>
          )}

          {activities.map((act: any) => (
            <RetroCard key={act.id} padding="$3">
              <XStack alignItems="center" gap="$3">
                {/* Activity Type Icon */}
                <View 
                  backgroundColor="$background" 
                  padding="$2" 
                  borderWidth={1} 
                  borderColor="$hd2d.outlineColor"
                  alignItems="center" 
                  justifyContent="center"
                >
                  <ActivityIcon size={20} color={theme.accent?.get()} />
                </View>
                
                {/* Session Info */}
                <YStack flex={1}>
                  <TamaText color="$color" fontWeight="900" fontSize={14} fontFamily="$pixel">
                    {(act.type || 'UNKNOWN').toUpperCase()} SESSION
                  </TamaText>
                  <TamaText color="$color" fontSize={10} opacity={0.6} fontFamily="$pixel" marginTop="$1">
                    {new Date(act.start_time).toLocaleDateString()} • {(act.distance / 1000).toFixed(2)} KM
                  </TamaText>
                </YStack>

                {/* Verification Score Badge */}
                <View 
                  backgroundColor="$background" 
                  paddingHorizontal="$2" 
                  paddingVertical="$1" 
                  borderWidth={1} 
                  borderColor={getVerificationColor(act.verification_score)}
                >
                  <TamaText 
                    color={getVerificationColor(act.verification_score)} 
                    fontSize={9} 
                    fontWeight="900" 
                    fontFamily="$pixel"
                  >
                    {Math.round(act.verification_score * 100)}%
                  </TamaText>
                </View>

                {/* Share Button */}
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

      {/* Footer */}
      <TamaText textAlign="center" fontSize={8} color="$color" opacity={0.4} paddingVertical="$2" fontFamily="$pixel">
        MISSION_LOG v3.0 // HD-2D ENGINE
      </TamaText>
    </YStack>
  );
});
