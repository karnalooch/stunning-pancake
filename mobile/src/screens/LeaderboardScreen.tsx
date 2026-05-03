import React, { useEffect } from 'react';
import { Image, Alert } from 'react-native';
import { Crown, Swords } from 'lucide-react-native';
import { YStack, XStack, Text as TamaText, ScrollView, useTheme, View } from 'tamagui';
import { observer, useObservable } from '@legendapp/state/react';
import { ActivityService, LeaderboardEntry } from '../services/api';

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
    ranking: [] as LeaderboardEntry[],
    myRank: null as LeaderboardEntry | null,
    loading: true,
  });

  useEffect(() => {
    (async () => {
      try {
        state.loading.set(true);
        const data = await ActivityService.getLeaderboard('siedlce');
        state.ranking.set(Array.isArray(data) ? data : []);
      } catch (e) {
        console.warn('[Leaderboard] Fetch failed:', e);
      } finally {
        state.loading.set(false);
      }
    })();
  }, [state.category.get()]);

  const ranking = state.ranking.get() || [];
  const myRank = state.myRank.get();

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop="$10">
      <XStack paddingHorizontal="$4" justifyContent="space-between" alignItems="center" marginBottom="$4">
        <TamaText fontFamily="$pixel" fontSize={18} color="$color">RANKINGS</TamaText>
        <Image source={rewardTrophy} style={{ width: 28, height: 28 }} resizeMode="contain" />
      </XStack>

      {/* Podium TOP 3 — Metal Slug style */}
      <XStack justifyContent="center" alignItems="flex-end" gap="$2" marginBottom="$4" marginTop="$2">
        {/* Silver */}
        <YStack alignItems="center">
          <View backgroundColor="$silver" paddingHorizontal="$2" borderWidth={1} borderColor="$outlineColor" marginBottom="$1">
            <TamaText color="black" fontFamily="$pixel" fontSize={7}>RANK_02</TamaText>
          </View>
          <RetroCard padding="$2" alignItems="center" borderColor="$silver" borderBottomWidth={4}>
            <AthleteSprite type="cyclist" state="action" size={45} />
            <TamaText color="$color" marginTop="$2" fontSize={10} fontFamily="$pixel" numberOfLines={1} maxWidth={70}>
              {ranking[1]?.username || '---'}
            </TamaText>
            <TamaText color="$color" opacity={0.6} fontSize={8} fontFamily="$pixel">
              {ranking[1]?.points || 0}PTS
            </TamaText>
          </RetroCard>
        </YStack>

        {/* Gold */}
        <YStack alignItems="center">
          <CrownIcon size={20} color={theme.primary.get()} style={{ marginBottom: 4 }} />
          <RetroCard padding="$3" alignItems="center" borderColor="$primary" borderBottomWidth={6}>
            <AthleteSprite type="elite" state="action" size={55} />
            <TamaText color="$color" marginTop="$2" fontSize={12} fontFamily="$pixel" numberOfLines={1} maxWidth={80}>
              {ranking[0]?.username || '---'}
            </TamaText>
            <TamaText color="$primary" fontSize={8} fontFamily="$pixel">
              {ranking[0]?.points || 0}PTS_MAX
            </TamaText>
          </RetroCard>
        </YStack>

        {/* Bronze */}
        <YStack alignItems="center">
          <View backgroundColor="#CD7F32" paddingHorizontal="$2" borderWidth={1} borderColor="$outlineColor" marginBottom="$1">
            <TamaText color="black" fontFamily="$pixel" fontSize={7}>RANK_03</TamaText>
          </View>
          <RetroCard padding="$2" alignItems="center" borderColor="#CD7F32" borderBottomWidth={3}>
            <AthleteSprite type="runner" state="action" size={45} />
            <TamaText color="$color" marginTop="$2" fontSize={10} fontFamily="$pixel" numberOfLines={1} maxWidth={70}>
              {ranking[2]?.username || '---'}
            </TamaText>
            <TamaText color="$color" opacity={0.6} fontSize={8} fontFamily="$pixel">
              {ranking[2]?.points || 0}PTS
            </TamaText>
          </RetroCard>
        </YStack>
      </XStack>

      {/* Rest of ranking */}
      <ScrollView flex={1} paddingHorizontal="$4" showsVerticalScrollIndicator={false}>
        <YStack gap="$3" paddingBottom="$20">
          {ranking.slice(3, 15).map((item, i) => (
            <RetroCard key={i} padding="$3">
              <XStack alignItems="center" justifyContent="space-between">
                <XStack alignItems="center" gap="$3">
                  <TamaText color="$color" opacity={0.4} fontFamily="$pixel" fontSize={10} width={30}>
                    #{i + 4}
                  </TamaText>
                  <AthleteSprite type={i % 2 === 0 ? 'runner' : 'cyclist'} state="idle" size={32} />
                  <YStack>
                    <TamaText color="$color" fontSize={12} fontWeight="800">{item.username}</TamaText>
                    <TamaText color="$primary" fontFamily="$pixel" fontSize={8}>{item.points} PTS</TamaText>
                  </YStack>
                </XStack>
                <HD2DButton label="VS" size="$2" paddingHorizontal="$3" />
              </XStack>
            </RetroCard>
          ))}
        </YStack>
      </ScrollView>

      {/* Fixed My Rank HUD */}
      <RetroCard
        position="absolute"
        bottom={0}
        left={0}
        right={0}
        backgroundColor="$backgroundStrong"
        padding="$4"
        borderTopWidth={2}
        borderColor="$primary"
      >
        <XStack alignItems="center" justifyContent="space-between">
          <XStack alignItems="center" gap="$3">
            <TamaText color="$primary" fontFamily="$pixel" fontSize={10} width={40}>
              #{myRank?.rank || '?'}
            </TamaText>
            <AthleteSprite type="runner" state="idle" size={36} />
            <YStack>
              <TamaText color="$color" fontSize={14} fontWeight="900">YOU (ACTIVE)</TamaText>
              <TamaText color="$primary" fontFamily="$pixel" fontSize={10}>{myRank?.points || 0} PTS</TamaText>
            </YStack>
          </XStack>
          <HD2DButton label="PROFILE" theme="green" size="$3" />
        </XStack>
      </RetroCard>
    </YStack>
  );
});
