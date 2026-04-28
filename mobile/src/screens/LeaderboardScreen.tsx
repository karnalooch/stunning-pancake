import React, { useEffect } from 'react';
import { Trophy, Crown } from 'lucide-react-native';
import { YStack, XStack, Text as TamaText, H1, H2, Paragraph, ScrollView, Circle, Button as TamaButton } from 'tamagui';
import { observer, useObservable } from '@legendapp/state/react';
import { ActivityService } from '../services/api';

const TrophyIcon = Trophy as any;
const CrownIcon = Crown as any;

export const LeaderboardScreen = observer(() => {
  const state = useObservable({
    category: 'CITY' as 'CITY' | 'GLOBAL',
    ranking: [] as any[],
    myRank: null as any,
    loading: true
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        state.loading.set(true);
        const data = await ActivityService.getLeaderboard('siedlce');
        state.ranking.set(data.leaderboard || []);
        
        const rankData = await ActivityService.getMyRank('siedlce');
        state.myRank.set(rankData);
      } catch (e) {
        console.error("Failed to fetch ranking", e);
      } finally {
        state.loading.set(false);
      }
    };
    fetchData();
  }, [state.category.get()]);

  const category = state.category.get();
  const ranking = (state.ranking.get() || []) as any[];
  const myRank = state.myRank.get();

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop="$10">
      <XStack paddingHorizontal="$4" justifyContent="space-between" alignItems="center" marginBottom="$4">
        <TamaText fontWeight="900" fontSize={28} color="white">Rankings</TamaText>
        <TrophyIcon size={28} color="#FBBF24" />
      </XStack>

      <XStack paddingHorizontal="$4" gap="$2" marginBottom="$6">
        <TamaButton 
          size="$3" 
          borderRadius="$10" 
          backgroundColor={category === 'CITY' ? "$blue10" : "$gray1"}
          onPress={() => state.category.set('CITY')}
        >
          <TamaText fontWeight="800" fontSize={13} color={category === 'CITY' ? "white" : "$gray10"}>Siedlce</TamaText>
        </TamaButton>
        <TamaButton 
          size="$3" 
          borderRadius="$10" 
          backgroundColor={category === 'GLOBAL' ? "$blue10" : "$gray1"}
          onPress={() => state.category.set('GLOBAL')}
        >
          <TamaText fontWeight="800" fontSize={13} color={category === 'GLOBAL' ? "white" : "$gray10"}>Global</TamaText>
        </TamaButton>
      </XStack>

      <XStack justifyContent="center" alignItems="flex-end" gap="$4" marginBottom="$8">
        {/* Rank 2 */}
        <YStack alignItems="center">
           <TamaText color="$gray10" fontWeight="900" marginBottom="$1">2</TamaText>
           <Circle size={60} borderWidth={3} borderColor="$gray8" backgroundColor="$gray1">
             <TamaText color="white" fontSize={24} fontWeight="900">{ranking[1]?.username?.[0] || '?'}</TamaText>
           </Circle>
           <TamaText color="white" marginTop="$2" fontSize={13} fontWeight="700">{ranking[1]?.username || '...'}</TamaText>
           <TamaText color="$gray10" fontSize={11} fontWeight="800">{ranking[1]?.score_km || 0} km</TamaText>
        </YStack>

        {/* Rank 1 */}
        <YStack alignItems="center" marginTop="$-5">
           <CrownIcon size={24} color="#FBBF24" style={{ marginBottom: 4 }} />
           <Circle size={80} borderWidth={3} borderColor="#FBBF24" backgroundColor="$gray1">
             <TamaText color="white" fontSize={32} fontWeight="900">{ranking[0]?.username?.[0] || '?'}</TamaText>
           </Circle>
           <TamaText color="white" marginTop="$2" fontSize={15} fontWeight="900">{ranking[0]?.username || '...'}</TamaText>
           <TamaText color="#FBBF24" fontSize={11} fontWeight="800">{ranking[0]?.score_km || 0} km</TamaText>
        </YStack>

        {/* Rank 3 */}
        <YStack alignItems="center">
           <TamaText color="$gray10" fontWeight="900" marginBottom="$1">3</TamaText>
           <Circle size={60} borderWidth={3} borderColor="#B45309" backgroundColor="$gray1">
             <TamaText color="white" fontSize={24} fontWeight="900">{ranking[2]?.username?.[0] || '?'}</TamaText>
           </Circle>
           <TamaText color="white" marginTop="$2" fontSize={13} fontWeight="700">{ranking[2]?.username || '...'}</TamaText>
           <TamaText color="$gray10" fontSize={11} fontWeight="800">{ranking[2]?.score_km || 0} km</TamaText>
        </YStack>
      </XStack>

      <ScrollView flex={1} paddingHorizontal="$4" paddingBottom="$10">
        <YStack gap="$2" paddingBottom="$10">
          {ranking.slice(3).map((item: any, i: number) => (
            <XStack key={item.user_id} alignItems="center" paddingVertical="$3" borderBottomWidth={1} borderBottomColor="$gray1">
              <TamaText color="$gray8" width={40} fontWeight="900" fontSize={12}>#{i + 4}</TamaText>
              <Circle size={32} backgroundColor="$gray2" marginRight="$3">
                <TamaText color="white" fontSize={10} fontWeight="800">{item.username?.[0]}</TamaText>
              </Circle>
              <TamaText color="white" fontWeight="600" fontSize={14}>{item.username}</TamaText>
              <YStack flex={1} alignItems="flex-end">
                <TamaText color="white" fontWeight="800" fontSize={12}>{item.score_km} km</TamaText>
              </YStack>
            </XStack>
          ))}
        </YStack>
      </ScrollView>

      <XStack position="absolute" bottom={0} left={0} right={0} backgroundColor="$gray1" padding="$5" borderTopWidth={1} borderTopColor="$gray2" alignItems="center">
         <TamaText color="$gray8" width={40} fontWeight="900" fontSize={12}>#{myRank?.rank || '?'}</TamaText>
         <Circle size={32} backgroundColor="$blue10" marginRight="$3">
           <TamaText color="white" fontSize={10} fontWeight="800">ME</TamaText>
         </Circle>
         <TamaText color="white" fontWeight="600" fontSize={14}>You (Current Stats)</TamaText>
         <YStack flex={1} alignItems="flex-end">
            <TamaText color="white" fontWeight="800" fontSize={12}>{myRank?.score_km || 0} km</TamaText>
         </YStack>
      </XStack>
    </YStack>
  );
});
