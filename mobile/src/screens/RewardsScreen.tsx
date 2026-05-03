import React, { useEffect, useState } from 'react';
import { Alert, Image } from 'react-native';
import { YStack, XStack, ScrollView, View } from 'tamagui';
import { RewardsService, RewardPool } from '../services/api';

import { GameCard } from '../components/arcade/GameCard';
import { PixelText } from '../components/arcade/PixelText';
import { ArcadeButton } from '../components/arcade/ArcadeButton';
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
    Alert.alert('Buy Item', 'Spend XP to purchase this item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Buy',
        onPress: async () => {
          try {
            await RewardsService.redeemVoucher(poolId);
            fetchData();
          } catch (e: any) {
            Alert.alert('Transaction Failed', e?.message || 'Not enough XP or item out of stock.');
          }
        },
      },
    ]);
  };

  return (
    <YStack flex={1} backgroundColor="#0B1D33" paddingTop="$10" paddingHorizontal="$4">
      <XStack justifyContent="space-between" alignItems="center" marginBottom="$6">
        <PixelText size={20} color="#D4A373" shadow>ITEM_SHOP</PixelText>
        <ArcadeButton variant="ghost" label="REFRESH" onPress={fetchData} size="sm" fullWidth={false} />
      </XStack>

      {/* Balance Card */}
      <GameCard variant="dark" padding={20} marginBottom="$8">
        <XStack justifyContent="space-between" alignItems="center">
          <YStack>
            <PixelText color="#D4A373" size={10} shadow>YOUR WALLET</PixelText>
            <PixelText color="#FFFFFF" size={28} shadow style={{ marginTop: 8 }}>
              {loading ? '...' : balance.toLocaleString()} XP
            </PixelText>
          </YStack>
          <Image source={rewardTrophy} style={{ width: 48, height: 48 }} resizeMode="contain" />
        </XStack>
      </GameCard>

      {error && (
        <GameCard variant="metal" padding={12} marginBottom="$4">
          <PixelText color="#EF4444" size={10} shadow>{error}</PixelText>
        </GameCard>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        <YStack gap="$4" paddingBottom="$10">
          {loading && pools.length === 0 ? (
            <YStack padding="$10" alignItems="center">
              <AthleteSprite type="elite" state="action" size={60} />
              <PixelText color="#D4A373" size={10} style={{ marginTop: 16 }}>SCANNING MARKETPLACE...</PixelText>
            </YStack>
          ) : pools.length === 0 ? (
            <YStack padding="$10" alignItems="center">
              <AthleteSprite type="cyclist" state="idle" size={60} />
              <PixelText color="#9CA3AF" size={10} style={{ marginTop: 16 }}>NO ITEMS IN STOCK</PixelText>
              <PixelText color="#7BA05B" size={8} style={{ marginTop: 8 }}>COMPLETE MISSIONS TO EARN XP</PixelText>
            </YStack>
          ) : (
            pools.map((pool) => (
              <GameCard key={pool.id} variant="metal" padding={12}>
                <XStack alignItems="center" gap="$4">
                  <View backgroundColor="#0B1D33" padding="$2" borderWidth={2} borderColor="#D4A373" alignItems="center" justifyContent="center">
                    <Image source={rewardTrophy} style={{ width: 24, height: 24 }} resizeMode="contain" />
                  </View>

                  <YStack flex={1}>
                    <PixelText color="#7BA05B" size={8} shadow>{pool.sponsor_name}</PixelText>
                    <PixelText color="#FFFFFF" size={14} shadow style={{ marginVertical: 6 }}>{pool.title}</PixelText>
                    <PixelText color="#9CA3AF" size={8}>STOCK: {pool.available}</PixelText>
                  </YStack>

                  <YStack alignItems="flex-end" gap="$2">
                    <View backgroundColor="#0B1D33" paddingHorizontal="$2" paddingVertical="$1" borderWidth={2} borderColor="#D4A373">
                      <PixelText color="#D4A373" size={10} shadow>{pool.points_required} XP</PixelText>
                    </View>
                    <ArcadeButton
                      size="sm"
                      label="BUY"
                      variant={balance >= pool.points_required && pool.available > 0 ? 'green' : 'red'}
                      fullWidth={false}
                      disabled={balance < pool.points_required || pool.available === 0}
                      onPress={() => handleRedeem(pool.id)}
                    />
                  </YStack>
                </XStack>
              </GameCard>
            ))
          )}
        </YStack>
      </ScrollView>
    </YStack>
  );
};