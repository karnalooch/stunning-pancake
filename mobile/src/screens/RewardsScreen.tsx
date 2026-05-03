import React, { useEffect, useState } from 'react';
import { Alert, Image } from 'react-native';
import { YStack, XStack, Text as TamaText, ScrollView, View } from 'tamagui';
import { RewardsService, RewardPool } from '../services/api';

import { RetroCard } from '../components/RetroCard';
import { HD2DButton } from '../components/HD2DButton';
import { AthleteSprite } from '../components/AthleteSprite';

const rewardTrophy = require('../../assets/generated/reward_trophy.png');

export const RewardsScreen = () => {
  const [pools, setPools] = useState<RewardPool[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [balanceData, poolsData] = await Promise.all([
        RewardsService.getBalance(),
        RewardsService.getPools(),
      ]);
      setBalance(balanceData?.points ?? 0);
      setPools(Array.isArray(poolsData) ? poolsData : []);
    } catch (e) {
      console.warn('[Rewards] Fetch failed:', e);
      setError('Failed to sync with rewards engine.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRedeem = (poolId: number) => {
    Alert.alert('Redeem Voucher', 'Confirm redemption?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Redeem',
        onPress: async () => {
          try {
            await RewardsService.redeemVoucher(poolId);
            fetchData();
          } catch (e: any) {
            Alert.alert('Redemption Failed', e?.message || 'Insufficient points or out of stock.');
          }
        },
      },
    ]);
  };

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop="$10" paddingHorizontal="$4">
      <XStack justifyContent="space-between" alignItems="center" marginBottom="$6">
        <TamaText fontFamily="$pixel" fontSize={24} color="$color">MARKETPLACE</TamaText>
        <HD2DButton circular label="↻" onPress={fetchData} size="$3" />
      </XStack>

      {/* Balance Card */}
      <RetroCard backgroundColor="$primary" padding="$6" justifyContent="space-between" alignItems="center" marginBottom="$8" borderColor="$outlineColor">
        <YStack>
          <TamaText color="black" fontSize={8} fontWeight="900" letterSpacing={1.5} fontFamily="$pixel">
            AVAILABLE_CREDITS
          </TamaText>
          <TamaText color="black" fontSize={28} fontWeight="900" marginTop="$2" fontFamily="$pixel">
            {loading ? '...' : balance.toLocaleString()} XP
          </TamaText>
        </YStack>
        <Image source={rewardTrophy} style={{ width: 48, height: 48 }} resizeMode="contain" />
      </RetroCard>

      {error && (
        <RetroCard padding="$4" marginBottom="$4" backgroundColor="rgba(239,68,68,0.15)">
          <TamaText color="$warning" fontSize={10} fontWeight="800" fontFamily="$pixel">{error}</TamaText>
        </RetroCard>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        <YStack gap="$4" paddingBottom="$10">
          {loading && pools.length === 0 ? (
            <YStack padding="$10" alignItems="center">
              <AthleteSprite type="elite" state="action" size={60} />
              <TamaText color="$primary" marginTop="$4" fontWeight="800" fontFamily="$pixel">SCANNING MARKETPLACE...</TamaText>
            </YStack>
          ) : pools.length === 0 ? (
            <YStack padding="$10" alignItems="center">
              <AthleteSprite type="cyclist" state="idle" size={60} />
              <TamaText color="$color" opacity={0.5} fontFamily="$pixel" fontSize={10} marginTop="$4">NO_REWARDS_IN_SECTOR</TamaText>
              <TamaText color="$primary" fontFamily="$pixel" fontSize={8} marginTop="$2">COMPLETE MISSIONS TO EARN XP</TamaText>
            </YStack>
          ) : (
            pools.map((pool) => (
              <RetroCard key={pool.id} flexDirection="row" padding="$3" alignItems="center" gap="$4">
                <View backgroundColor="$background" padding="$2" borderWidth={1} borderColor="$outlineColor" alignItems="center" justifyContent="center">
                  <Image source={rewardTrophy} style={{ width: 20, height: 20 }} resizeMode="contain" />
                </View>

                <YStack flex={1}>
                  <TamaText color="$primary" fontSize={8} fontWeight="900" textTransform="uppercase" fontFamily="$pixel">
                    {pool.sponsor_name}
                  </TamaText>
                  <TamaText color="$color" fontWeight="900" fontSize={14} marginVertical="$1">{pool.title}</TamaText>
                  <TamaText color="$color" fontSize={8} fontFamily="$pixel" opacity={0.6}>STOCK: {pool.available}</TamaText>
                </YStack>

                <YStack alignItems="flex-end" gap="$2">
                  <View backgroundColor="$backgroundStrong" paddingHorizontal="$2" paddingVertical="$1" borderWidth={1} borderColor="$secondary">
                    <TamaText color="$secondary" fontSize={9} fontWeight="900" fontFamily="$pixel">{pool.points_required} XP</TamaText>
                  </View>
                  <HD2DButton
                    size="$2"
                    label="BUY"
                    onPress={() => handleRedeem(pool.id)}
                    disabled={balance < pool.points_required || pool.available === 0}
                    theme={balance >= pool.points_required ? 'green' : 'red'}
                  />
                </YStack>
              </RetroCard>
            ))
          )}
        </YStack>
      </ScrollView>
    </YStack>
  );
};
