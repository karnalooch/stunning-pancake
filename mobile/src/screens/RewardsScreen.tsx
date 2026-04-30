import React, { useEffect, useState } from 'react';
import { Image } from 'react-native';
import { MapPin, Tag, RefreshCcw } from 'lucide-react-native';
import { YStack, XStack, Text as TamaText, ScrollView, Button as TamaButton, Spinner, View } from 'tamagui';
import { RewardsService } from '../services/api';

const MapPinIcon = MapPin as any;
const TagIcon = Tag as any;
const RefreshIcon = RefreshCcw as any;

const rewardTrophy = require('../../assets/generated/reward_trophy.png');

import { RetroCard } from '../components/RetroCard';
import { HD2DButton } from '../components/HD2DButton';

export const RewardsScreen = () => {
  const [pools, setPools] = useState<any[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [balanceData, poolsData] = await Promise.all([
        RewardsService.getBalance(),
        RewardsService.getPools()
      ]);
      setBalance(balanceData.points);
      setPools(poolsData);
    } catch (e) {
      console.error("[Rewards] Fetch error:", e);
      setError("Failed to sync with rewards engine.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRedeem = async (poolId: number) => {
    try {
      await RewardsService.redeemVoucher(poolId);
      fetchData();
    } catch (e) {
      alert("Redemption failed. Insufficient points or out of stock.");
    }
  };

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop="$10" paddingHorizontal="$4">
      <XStack justifyContent="space-between" alignItems="center" marginBottom="$6">
        <TamaText fontFamily="$pixel" fontSize={24} color="$color">MARKETPLACE</TamaText>
        <HD2DButton 
          circular 
          label={loading ? "..." : "R"}
          onPress={fetchData} 
          size="$3"
        />
      </XStack>
      
      <RetroCard 
        backgroundColor="$primary" 
        padding="$6" 
        justifyContent="space-between" 
        alignItems="center" 
        marginBottom="$8"
        borderColor="black"
      >
        <YStack>
          <TamaText color="black" fontSize={8} fontWeight="900" letterSpacing={1.5} fontFamily="$pixel">AVAILABLE_CREDITS</TamaText>
          <TamaText color="black" fontSize={28} fontWeight="900" marginTop="$2" fontFamily="$pixel">
            {loading ? '...' : balance.toLocaleString()} XP
          </TamaText>
        </YStack>
        <Image source={rewardTrophy} style={{ width: 48, height: 48 }} resizeMode="contain" />
      </RetroCard>

      {error && (
        <RetroCard theme="red" padding="$4" marginBottom="$4">
          <TamaText color="white" fontSize={10} fontWeight="800" fontFamily="$pixel">{error}</TamaText>
        </RetroCard>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        <YStack gap="$4" paddingBottom="$10">
          {loading && pools.length === 0 ? (
            <YStack padding="$10" alignItems="center">
              <Spinner size="large" color="$primary" />
              <TamaText color="$primary" marginTop="$4" fontWeight="800" fontFamily="$pixel">SYNCING...</TamaText>
            </YStack>
          ) : pools.length === 0 ? (
            <YStack padding="$10" alignItems="center">
              <TamaText color="$color" opacity={0.5} fontFamily="$pixel" fontSize={10}>NO_REWARDS_IN_SECTOR</TamaText>
            </YStack>
          ) : (
            pools.map((pool) => (
              <RetroCard 
                key={pool.id} 
                flexDirection="row" 
                padding="$3" 
                alignItems="center" 
                gap="$4" 
              >
                <View 
                  backgroundColor="$background" 
                  padding="$2" 
                  borderWidth={1} 
                  borderColor="$hd2d.outlineColor"
                  alignItems="center" 
                  justifyContent="center"
                >
                  <Image source={rewardTrophy} style={{ width: 20, height: 20 }} resizeMode="contain" />
                </View>
                
                <YStack flex={1}>
                  <TamaText color="$primary" fontSize={8} fontWeight="900" textTransform="uppercase" fontFamily="$pixel">{pool.sponsor_name}</TamaText>
                  <TamaText color="$color" fontWeight="900" fontSize={14} marginVertical="$1">{pool.title}</TamaText>
                  <XStack alignItems="center" gap="$1">
                    <MapPinIcon size={10} color="$color" opacity={0.5} />
                    <TamaText color="$color" fontSize={8} fontFamily="$pixel" opacity={0.6}>STOCK: {pool.available}</TamaText>
                  </XStack>
                </YStack>

                <YStack alignItems="flex-end" gap="$2">
                  <View 
                    backgroundColor="$background" 
                    paddingHorizontal="$2" 
                    paddingVertical="$1" 
                    borderWidth={1} 
                    borderColor="$secondary"
                  >
                    <TamaText color="$secondary" fontSize={9} fontWeight="900" fontFamily="$pixel">{pool.points_required} XP</TamaText>
                  </View>
                  <HD2DButton 
                    size="$2" 
                    label="REDEEM"
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
