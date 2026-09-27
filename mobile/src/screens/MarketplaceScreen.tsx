/* eslint-disable react-hooks/set-state-in-effect -- T94 legacy lint baseline: preserve existing mount/load behavior while real mobile lint is activated. */
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { Metric } from '../components/product/Metric';
import { PrimaryButton } from '../components/product/PrimaryButton';
import { ProductCard } from '../components/product/ProductCard';
import { EdgeStateBanner } from '../components/ui/EdgeStateBanner';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonBlock } from '../components/ui/SkeletonBlock';
import { useI18n } from '../i18n/useI18n';
import { RewardsService, type RewardPool } from '../services/api';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';

const stylesheet = StyleSheet.create((theme) => {
  const semantic = getSemanticColors(theme.colors);
  return {
    container: {
      flex: 1,
      backgroundColor: semantic.canvas.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 12,
    },
    title: {
      ...PRODUCT_TYPOGRAPHY.title,
      color: semantic.text.primary,
    },
    content: {
      paddingHorizontal: 16,
      paddingBottom: 40,
      gap: 12,
    },
    summary: {
      flexDirection: 'row',
      gap: 12,
    },
    summaryCard: {
      flex: 1,
    },
    list: {
      gap: 10,
    },
    offerContent: {
      gap: 6,
    },
    offerTitle: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.text.primary,
    },
    offerMeta: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.secondary,
    },
    actions: {
      marginTop: 6,
    },
  };
});

export const MarketplaceScreen: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { t } = useI18n();
  const s = stylesheet;
  const [points, setPoints] = useState<number | null>(null);
  const [pools, setPools] = useState<RewardPool[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const reload = () => {
    setLoading(true);
    setLoadError(false);
    Promise.all([RewardsService.getBalance(), RewardsService.getPools()])
      .then(([balance, poolList]) => {
        setPoints(balance.points);
        setPools(Array.isArray(poolList) ? poolList : []);
      })
      .catch(() => {
        setPoints(null);
        setPools(null);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, []);

  const redeem = async (poolId: number) => {
    try {
      await RewardsService.redeemVoucher(poolId);
      reload();
    } catch {
      // Redemption is server-authoritative; keep the last confirmed balance and offers visible.
    }
  };

  const content = (
    <>
      {!embedded ? (
        <View style={s.header}>
          <Text style={s.title}>{t.marketplace.title}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={s.content}>
        {loading ? (
          <SkeletonBlock height={220} />
        ) : loadError || points === null || pools === null ? (
          <View style={s.list}>
            <EdgeStateBanner
              title={t.errors.network}
              message={t.explore.marketHint}
              variant="offline"
            />
            <PrimaryButton label={t.common.retry} onPress={reload} />
          </View>
        ) : (
          <>
            <View style={s.summary}>
              <View style={s.summaryCard}>
                <ProductCard>
                  <Metric value={points.toLocaleString()} label={t.marketplace.points} />
                </ProductCard>
              </View>
              <View style={s.summaryCard}>
                <ProductCard>
                  <Metric value={String(pools.length)} label={t.marketplace.offers} />
                </ProductCard>
              </View>
            </View>

            {pools.length === 0 ? (
              <ProductCard>
                <EmptyState
                  message={t.marketplace.empty}
                  hint={t.explore.marketHint}
                  icon="shop"
                />
              </ProductCard>
            ) : (
              <View style={s.list}>
                {pools.map((pool) => (
                  <ProductCard key={pool.id}>
                    <View style={s.offerContent}>
                      <Text style={s.offerTitle}>{pool.title}</Text>
                      <Text style={s.offerMeta}>{pool.sponsor_name}</Text>
                      <Text style={s.offerMeta}>
                        {pool.points_required} pts · {pool.available} {t.marketplace.left}
                      </Text>
                      <View style={s.actions}>
                        <PrimaryButton
                          label={t.common.redeem}
                          onPress={() => void redeem(pool.id)}
                          variant="secondary"
                        />
                      </View>
                    </View>
                  </ProductCard>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </>
  );

  if (embedded) return <View style={{ flex: 1 }}>{content}</View>;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {content}
    </SafeAreaView>
  );
};
