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
