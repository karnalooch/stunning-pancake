import React, { useEffect } from 'react';
import { Image, Alert } from 'react-native';
import { YStack, XStack, ScrollView, View } from 'tamagui';
import { observer, useObservable } from '@legendapp/state/react';
import { ActivityService, LeaderboardEntry } from '../services/api';

import { GameCard } from '../components/arcade/GameCard';
import { PixelText } from '../components/arcade/PixelText';
import { ArcadeButton } from '../components/arcade/ArcadeButton';
import { AthleteSprite } from '../components/AthleteSprite';

const rewardTrophy = require('../../assets/generated/reward_trophy.png');

export const LeaderboardScreen = observer(() => {
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
    <YStack flex={1} backgroundColor="#0B1D33" paddingTop="$10">
      <XStack paddingHorizontal="$4" justifyContent="space-between" alignItems="center" marginBottom="$4">
        <PixelText size={18} color="#D4A373" shadow>HIGH_SCORES</PixelText>
        <Image source={rewardTrophy} style={{ width: 28, height: 28 }} resizeMode="contain" />
      </XStack>

      {/* Podium TOP 3 — Metal Slug style */}
      <XStack justifyContent="center" alignItems="flex-end" gap="$2" marginBottom="$6" marginTop="$4" paddingHorizontal="$4">
        {/* Silver */}
        <YStack alignItems="center" flex={1}>
          <View backgroundColor="#C0C0C0" paddingHorizontal="$2" paddingVertical="$1" borderWidth={2} borderColor="#000000" marginBottom="$1">
            <PixelText color="#000000" size={7}>RANK_02</PixelText>
          </View>
          <GameCard variant="metal" padding={8} width="100%" alignItems="center" borderBottomWidth={4}>
            <AthleteSprite type="cyclist" state="action" size={45} />
            <PixelText color="#FFFFFF" marginTop="$2" size={10} shadow numberOfLines={1}>
              {ranking[1]?.username || '---'}
            </PixelText>
            <PixelText color="#9CA3AF" size={8} marginTop="$1">
              {ranking[1]?.points || 0}PTS
            </PixelText>
          </GameCard>
        </YStack>

        {/* Gold */}
        <YStack alignItems="center" flex={1.2}>
          <View backgroundColor="#D4A373" paddingHorizontal="$2" paddingVertical="$1" borderWidth={2} borderColor="#000000" marginBottom="$1">
            <PixelText color="#000000" size={7}>RANK_01</PixelText>
          </View>
          <GameCard variant="dark" padding={12} width="100%" alignItems="center" borderBottomWidth={6}>
            <AthleteSprite type="elite" state="action" size={60} />
            <PixelText color="#FFFFFF" marginTop="$2" size={12} shadow numberOfLines={1}>
              {ranking[0]?.username || '---'}
            </PixelText>
            <PixelText color="#D4A373" size={10} marginTop="$1">
              {ranking[0]?.points || 0} MAX
            </PixelText>
          </GameCard>
        </YStack>

        {/* Bronze */}
        <YStack alignItems="center" flex={1}>
          <View backgroundColor="#CD7F32" paddingHorizontal="$2" paddingVertical="$1" borderWidth={2} borderColor="#000000" marginBottom="$1">
            <PixelText color="#000000" size={7}>RANK_03</PixelText>
          </View>
          <GameCard variant="parchment" padding={8} width="100%" alignItems="center" borderBottomWidth={4}>
            <AthleteSprite type="runner" state="action" size={45} />
            <PixelText color="#000000" marginTop="$2" size={10} numberOfLines={1}>
              {ranking[2]?.username || '---'}
            </PixelText>
            <PixelText color="#8B7355" size={8} marginTop="$1">
              {ranking[2]?.points || 0}PTS
            </PixelText>
          </GameCard>
        </YStack>
      </XStack>

      {/* Rest of ranking */}
      <ScrollView flex={1} paddingHorizontal="$4" showsVerticalScrollIndicator={false}>
        <YStack gap="$3" paddingBottom="$30">
          {ranking.slice(3, 15).map((item, i) => (
            <GameCard key={i} variant="dark" padding={12}>
              <XStack alignItems="center" justifyContent="space-between">
                <XStack alignItems="center" gap="$3">
                  <PixelText color="#9CA3AF" size={10} width={30}>
                    #{i + 4}
                  </PixelText>
                  <AthleteSprite type={i % 2 === 0 ? 'runner' : 'cyclist'} state="idle" size={32} />
                  <YStack>
                    <PixelText color="#FFFFFF" size={12} shadow>{item.username}</PixelText>
                    <PixelText color="#D4A373" size={8} marginTop="$1">{item.points} PTS</PixelText>
                  </YStack>
                </XStack>
                <ArcadeButton label="VS" size="sm" variant="red" fullWidth={false} onPress={() => {}} />
              </XStack>
            </GameCard>
          ))}
        </YStack>
      </ScrollView>

      {/* Fixed My Rank HUD */}
      <GameCard
        variant="metal"
        position="absolute"
        bottom={0} left={0} right={0}
        padding={16}
      >
        <XStack alignItems="center" justifyContent="space-between">
          <XStack alignItems="center" gap="$3">
            <PixelText color="#D4A373" size={12} width={40}>
              #{myRank?.rank || '?'}
            </PixelText>
            <AthleteSprite type="runner" state="idle" size={36} />
            <YStack>
              <PixelText color="#FFFFFF" size={14} shadow>YOU (P1)</PixelText>
              <PixelText color="#D4A373" size={10} marginTop="$1">{myRank?.points || 0} PTS</PixelText>
            </YStack>
          </XStack>
          <ArcadeButton label="PROFILE" variant="blue" size="sm" fullWidth={false} onPress={() => {}} />
        </XStack>
      </GameCard>
    </YStack>
  );
});
