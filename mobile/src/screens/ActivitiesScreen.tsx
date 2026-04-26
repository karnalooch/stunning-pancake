import React, { useEffect } from 'react';
import { Share } from 'react-native';
import { Activity, TrendingUp, Share2 } from 'lucide-react-native';
import { YStack, XStack, Text as TamaText, H1, H2, Paragraph, ScrollView, Button as TamaButton } from 'tamagui';
import { observer, useObservable } from '@legendapp/state/react';
import { ActivityService } from '../services/api';

const ActivityIcon = Activity as any;
const TrendingIcon = TrendingUp as any;
const ShareIcon = Share2 as any;

export const ActivitiesScreen = observer(() => {
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

  const handleShare = async (act: any) => {
    try {
      await Share.share({
        message: `I just finished a ${act.type} session on SPORT! Distance: ${(act.distance / 1000).toFixed(2)} km. Verification Score: ${Math.round(act.verification_score * 100)}%. Join me!`,
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop="$10" paddingHorizontal="$4">
      <XStack justifyContent="space-between" alignItems="center" marginBottom="$8">
        <TamaText fontWeight="900" fontSize={28} color="white">History</TamaText>
        <TrendingIcon size={24} color="#00D1FF" />
      </XStack>

      <ScrollView>
        <YStack gap="$4" paddingBottom="$10">
          {state.activities.get().map((act: any) => (
            <XStack key={act.id} backgroundColor="$gray1" padding="$4" borderRadius="$4" alignItems="center" gap="$4">
              <YStack backgroundColor="$gray2" padding="$2.5" borderRadius="$3" alignItems="center" justifyContent="center">
                <ActivityIcon size={20} color="#00D1FF" />
              </YStack>
              
              <YStack flex={1}>
                <TamaText color="white" fontWeight="700" fontSize={16}>{act.type} SESSION</TamaText>
                <TamaText color="$gray10" fontSize={12} marginTop="$1">
                  {new Date(act.start_time).toLocaleDateString()} • {(act.distance / 1000).toFixed(2)} km
                </TamaText>
              </YStack>

              <YStack backgroundColor="rgba(0, 209, 255, 0.1)" paddingHorizontal="$2" paddingVertical="$1" borderRadius="$2">
                <TamaText color="#00D1FF" fontSize={10} fontWeight="900">{Math.round(act.verification_score * 100)}%</TamaText>
              </YStack>

              <TamaButton chromeless padding="$2" onPress={() => handleShare(act)}>
                 <ShareIcon size={18} color="#00D1FF" />
              </TamaButton>
            </XStack>
          ))}
        </YStack>
      </ScrollView>
    </YStack>
  );
});
