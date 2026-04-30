import React, { useEffect } from 'react';
import { Image } from 'react-native';
import { Crown, Swords } from 'lucide-react-native';
import { YStack, XStack, Text as TamaText, ScrollView, useTheme, View } from 'tamagui';
import { observer, useObservable } from '@legendapp/state/react';
import { ActivityService } from '../services/api';

import { RetroCard } from '../components/RetroCard';
import { HD2DButton } from '../components/HD2DButton';
import { AthleteSprite } from '../components/AthleteSprite';

const CrownIcon = Crown as any;
const SwordsIcon = Swords as any;

const rewardTrophy = require('../../assets/generated/reward_trophy.png');

export const LeaderboardScreen = observer(() => {
  const theme = useTheme();
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
        <TamaText fontFamily="$pixel" fontSize={18} color="$color">RANKINGS</TamaText>
        <Image source={rewardTrophy} style={{ width: 28, height: 28 }} resizeMode="contain" />
      </XStack>

      <XStack paddingHorizontal="$4" gap="$2" marginBottom="$6">
        <HD2DButton 
          size="$3" 
          label="SIEDLCE"
          onPress={() => state.category.set('CITY')}
          backgroundColor={category === 'CITY' ? "$primary" : "transparent"}
          opacity={category === 'CITY' ? 1 : 0.5}
        />
        <HD2DButton 
          size="$3" 
          label="GLOBAL"
          onPress={() => state.category.set('GLOBAL')}
          backgroundColor={category === 'GLOBAL' ? "$primary" : "transparent"}
          opacity={category === 'GLOBAL' ? 1 : 0.5}
        />
      </XStack>

      <ScrollView flex={1} paddingHorizontal="$4" showsVerticalScrollIndicator={false}>
        <XStack justifyContent="center" alignItems="flex-end" gap="$2" marginBottom="$8" marginTop="$4">
          {/* Rank 2 - SILVER */}
          <YStack alignItems="center">
             <View backgroundColor="#C0C0C0" paddingHorizontal="$2" borderWidth={1} borderColor="black" marginBottom="$1">
               <TamaText color="black" fontFamily="$pixel" fontSize={7}>RANK_02</TamaText>
             </View>
             <RetroCard padding="$2" alignItems="center" borderColor="#C0C0C0" borderBottomWidth={4}>
               <AthleteSprite type="cyclist" state="action" size={45} />
               <TamaText color="$color" marginTop="$2" fontSize={10} fontFamily="$pixel" numberOfLines={1} maxWidth={70}>{ranking[1]?.username || '...'}</TamaText>
               <TamaText color="$color" opacity={0.6} fontSize={8} fontFamily="$pixel">{ranking[1]?.score_km || 0}KM</TamaText>
             </RetroCard>
          </YStack>

          {/* Rank 1 - GOLD */}
          <YStack alignItems="center">
             <CrownIcon size={20} color={theme.primary.get()} style={{ marginBottom: 4 }} />
             <RetroCard padding="$3" alignItems="center" borderColor={theme.primary.get()} scale={1.1} borderBottomWidth={6}>
               <AthleteSprite type="elite" state="action" size={55} />
               <TamaText color="$color" marginTop="$2" fontSize={12} fontFamily="$pixel" numberOfLines={1} maxWidth={80}>{ranking[0]?.username || '...'}</TamaText>
               <TamaText color={theme.primary.get()} fontSize={8} fontFamily="$pixel">{ranking[0]?.score_km || 0}KM_MAX</TamaText>
             </RetroCard>
          </YStack>

          {/* Rank 3 - BRONZE */}
          <YStack alignItems="center">
             <View backgroundColor="#CD7F32" paddingHorizontal="$2" borderWidth={1} borderColor="black" marginBottom="$1">
               <TamaText color="black" fontFamily="$pixel" fontSize={7}>RANK_03</TamaText>
             </View>
             <RetroCard padding="$2" alignItems="center" borderColor="#CD7F32" borderBottomWidth={3}>
               <AthleteSprite type="runner" state="action" size={45} />
               <TamaText color="$color" marginTop="$2" fontSize={10} fontFamily="$pixel" numberOfLines={1} maxWidth={70}>{ranking[2]?.username || '...'}</TamaText>
               <TamaText color="$color" opacity={0.6} fontSize={8} fontFamily="$pixel">{ranking[2]?.score_km || 0}KM</TamaText>
             </RetroCard>
          </YStack>
        </XStack>

        <YStack gap="$3" paddingBottom="$20">
          {ranking.slice(3).map((item: any, i: number) => (
            <RetroCard key={item.user_id} padding="$3">
              <XStack alignItems="center" justifyContent="space-between">
                <XStack alignItems="center" gap="$3">
                  <TamaText color="$color" opacity={0.4} fontFamily="$pixel" fontSize={10} width={30}>#{i + 4}</TamaText>
                  <AthleteSprite type={i % 2 === 0 ? 'runner' : 'cyclist'} state="idle" size={32} />
                  <YStack>
                    <TamaText color="$color" fontSize={12} fontWeight="800">{item.username}</TamaText>
                    <TamaText color="$primary" fontFamily="$pixel" fontSize={8}>{item.score_km} KM</TamaText>
                  </YStack>
                </XStack>
                <HD2DButton 
                  label="VS" 
                  size="$2" 
                  paddingHorizontal="$3"
                  icon={<SwordsIcon size={12} color="black" />}
                />
              </XStack>
            </RetroCard>
          ))}
        </YStack>
      </ScrollView>

      {/* FIXED MY RANK HUD */}
      <RetroCard 
        position="absolute" 
        bottom={0} 
        left={0} 
        right={0} 
        backgroundColor="$background" 
        padding="$4" 
        borderTopWidth={2} 
        borderColor="$primary"
      >
        <XStack alignItems="center" justifyContent="space-between">
           <XStack alignItems="center" gap="$3">
             <TamaText color="$primary" fontFamily="$pixel" fontSize={10} width={40}>#{myRank?.rank || '?'}</TamaText>
             <AthleteSprite type="runner" state="idle" size={36} />
             <YStack>
               <TamaText color="$color" fontSize={14} fontWeight="900">YOU (ACTIVE)</TamaText>
               <TamaText color="$primary" fontFamily="$pixel" fontSize={10}>{myRank?.score_km || 0} KM</TamaText>
             </YStack>
           </XStack>
           <HD2DButton label="PROFILE" theme="green" size="$3" />
        </XStack>
      </RetroCard>
    </YStack>
  );
});
