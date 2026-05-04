import React, { useEffect, useState } from 'react';
import { Alert, Image, View } from 'react-native';
import { RewardsService, RewardPool } from '../services/api';

import { Column } from '../components/Column';
import { Row } from '../components/Row';
import { ScrollContainer } from '../components/ScrollContainer';
import { GameCard } from '../components/GameCard';
import { PixelText } from '../components/PixelText';
import { ArcadeButton } from '../components/ArcadeButton';
import { AthleteSprite } from '../components/AthleteSprite';
import { colors as tokens } from '@tokens/generated/restyle-colors';

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
    <Column flex={1} style={{ backgroundColor: tokens.octopath.background, paddingTop: 40 }} paddingHorizontal={16}>
      <Row justifyContent="space-between" alignItems="center" style={{ marginBottom: 24 }}>
        <PixelText size="xl" color="primary" shadow style={{ fontSize: 20 }}>ITEM_SHOP</PixelText>
        <ArcadeButton variant="ghost" label="REFRESH" onPress={fetchData} size="sm" fullWidth={false} />
      </Row>

      {/* Balance Card */}
      <GameCard variant="dark" padding={20} style={{ marginBottom: 32 }}>
        <Row justifyContent="space-between" alignItems="center">
          <Column>
            <PixelText color="primary" size="xs" shadow>YOUR WALLET</PixelText>
            <PixelText color="text" size="2xl" shadow style={{ marginTop: 8, fontSize: 28 }}>
              {loading ? '...' : balance.toLocaleString()} XP
            </PixelText>
          </Column>
          <Image source={rewardTrophy} style={{ width: 48, height: 48 }} resizeMode="contain" />
        </Row>
      </GameCard>

      {error && (
        <GameCard variant="metal" padding={12} style={{ marginBottom: 16 }}>
          <PixelText color="error" size="xs" shadow>{error}</PixelText>
        </GameCard>
      )}

      <ScrollContainer showsVerticalScrollIndicator={false}>
        <Column gap={16} style={{ paddingBottom: 40 }}>
          {loading && pools.length === 0 ? (
            <Column style={{ padding: 40 }} alignItems="center">
              <AthleteSprite type="elite" state="action" size={60} />
              <PixelText color="primary" size="xs" style={{ marginTop: 16 }}>SCANNING MARKETPLACE...</PixelText>
            </Column>
          ) : pools.length === 0 ? (
            <Column style={{ padding: 40 }} alignItems="center">
              <AthleteSprite type="cyclist" state="idle" size={60} />
              <PixelText color="muted" size="xs" style={{ marginTop: 16 }}>NO ITEMS IN STOCK</PixelText>
              <PixelText color="success" size="xs" style={{ fontSize: 8, marginTop: 8 }}>COMPLETE MISSIONS TO EARN XP</PixelText>
            </Column>
          ) : (
            pools.map((pool) => (
              <GameCard key={pool.id} variant="metal" padding={12}>
                <Row alignItems="center" gap={16}>
                  <View style={{ backgroundColor: tokens.octopath.background, padding: 8, borderWidth: 2, borderColor: tokens.semantic.primary, alignItems: 'center', justifyContent: 'center' }}>
                    <Image source={rewardTrophy} style={{ width: 24, height: 24 }} resizeMode="contain" />
                  </View>

                  <Column flex={1}>
                    <PixelText color="success" size="xs" shadow style={{ fontSize: 8 }}>{pool.sponsor_name}</PixelText>
                    <PixelText color="text" size="md" shadow style={{ fontSize: 14, marginVertical: 6 }}>{pool.title}</PixelText>
                    <PixelText color="muted" size="xs" style={{ fontSize: 8 }}>STOCK: {pool.available}</PixelText>
                  </Column>

                  <Column alignItems="flex-end" gap={8}>
                    <View style={{ backgroundColor: tokens.octopath.background, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 2, borderColor: tokens.semantic.primary }}>
                      <PixelText color="primary" size="xs" shadow>{pool.points_required} XP</PixelText>
                    </View>
                    <ArcadeButton
                      size="sm"
                      label="BUY"
                      variant={balance >= pool.points_required && pool.available > 0 ? 'success' : 'danger'}
                      fullWidth={false}
                      disabled={balance < pool.points_required || pool.available === 0}
                      onPress={() => handleRedeem(pool.id)}
                    />
                  </Column>
                </Row>
              </GameCard>
            ))
          )}
        </Column>
      </ScrollContainer>
    </Column>
  );
};
