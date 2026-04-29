import React, { useEffect, useState } from 'react';
import { Gift, MapPin, Tag, RefreshCcw } from 'lucide-react-native';
import { YStack, XStack, Text as TamaText, H1, H2, Paragraph, ScrollView, Card, Button as TamaButton, Spinner } from 'tamagui';
import { RewardsService } from '../services/api';

const GiftIcon = Gift as any;
const MapPinIcon = MapPin as any;
const TagIcon = Tag as any;
const RefreshIcon = RefreshCcw as any;

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
      // Refresh balance and pools
      fetchData();
    } catch (e) {
      alert("Redemption failed. Insufficient points or out of stock.");
    }
  };

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop="$10" paddingHorizontal="$4">
      <XStack justifyContent="space-between" alignItems="center" marginBottom="$6">
        <TamaText fontWeight="900" fontSize={28} color="white">Rewards</TamaText>
        <TamaButton 
          circular 
          icon={loading ? <Spinner color="white" /> : <RefreshIcon size={16} color="white" />} 
          onPress={fetchData} 
          size="$3"
          backgroundColor="rgba(255,255,255,0.1)"
        />
      </XStack>
      
      <XStack backgroundColor="$blue10" padding="$6" borderRadius="$6" justifyContent="space-between" alignItems="center" marginBottom="$8">
        <YStack>
          <TamaText color="rgba(255,255,255,0.7)" fontSize={10} fontWeight="800" letterSpacing={1}>AVAILABLE BALANCE</TamaText>
          <TamaText color="white" fontSize={32} fontWeight="900" marginTop="$1">
            {loading ? '...' : balance.toLocaleString()} XP
          </TamaText>
        </YStack>
        <GiftIcon size={32} color="white" opacity={0.5} />
      </XStack>

      {error && (
        <YStack backgroundColor="$red5" padding="$4" borderRadius="$4" marginBottom="$4">
          <TamaText color="white" fontSize={12} fontWeight="700">{error}</TamaText>
        </YStack>
      )}

      <ScrollView>
        <YStack gap="$4" paddingBottom="$10">
          {loading && pools.length === 0 ? (
            <YStack padding="$10" alignItems="center">
              <Spinner size="large" color="$blue10" />
              <TamaText color="$gray10" marginTop="$4">Syncing with blockchain...</TamaText>
            </YStack>
          ) : pools.length === 0 ? (
            <YStack padding="$10" alignItems="center">
              <TamaText color="$gray10">No rewards available in your area yet.</TamaText>
            </YStack>
          ) : (
            pools.map((pool) => (
              <XStack key={pool.id} backgroundColor="$gray1" padding="$4" borderRadius="$4" alignItems="center" gap="$4" borderLeftWidth={4} borderLeftColor="$blue10">
                <YStack backgroundColor="$gray2" padding="$2.5" borderRadius="$3" alignItems="center" justifyContent="center">
                  <TagIcon size={20} color="white" />
                </YStack>
                
                <YStack flex={1}>
                  <TamaText color="$gray10" fontSize={10} fontWeight="800" textTransform="uppercase">{pool.sponsor_name}</TamaText>
                  <TamaText color="white" fontWeight="800" fontSize={16} marginVertical="$0.5">{pool.title}</TamaText>
                  <XStack alignItems="center" gap="$1">
                    <MapPinIcon size={12} color="$gray8" />
                    <TamaText color="$gray8" fontSize={11}>Available: {pool.available}</TamaText>
                  </XStack>
                </YStack>

                <YStack alignItems="flex-end" gap="$2">
                  <YStack backgroundColor="$gray3" paddingHorizontal="$2" paddingVertical="$1" borderRadius="$2">
                    <TamaText color="white" fontSize={11} fontWeight="900">{pool.points_required} XP</TamaText>
                  </YStack>
                  <TamaButton 
                    size="$2" 
                    theme="active" 
                    onPress={() => handleRedeem(pool.id)}
                    disabled={balance < pool.points_required || pool.available === 0}
                  >
                    <TamaText color="white" fontSize={10} fontWeight="900">REDEEM</TamaText>
                  </TamaButton>

                </YStack>
              </XStack>
            ))
          )}
        </YStack>
      </ScrollView>
    </YStack>
  );
};
