import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { RewardsService, type RewardPool } from '../services/api';
import { useI18n } from '../i18n/useI18n';
import { EmptyState } from '../components/ui/EmptyState';
import { OrnateFrame } from '../components/ui/OrnateFrame';
import { PixelText } from '../components/PixelText';

const stylesheet = StyleSheet.create((theme) => {
  const c = theme.colors as Record<string, string>;
  return {
    ct: { flex: 1, backgroundColor: c.background },
    h: { padding: 16, borderBottomWidth: 4, borderBottomColor: c.onBackground },
    t: { fontSize: 18, color: c.primary, textTransform: 'uppercase' },
    bal: { flexDirection: 'row', padding: 16, gap: 12 },
    balCd: { flex: 1 },
    bl: { fontSize: 10, color: c.secondary, textTransform: 'uppercase' },
    bv: { fontSize: 18, fontFamily: 'VT323', color: c.onBackground, marginTop: 4 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 8 },
    item: { width: '47%' },
    il: { fontSize: 14, color: c.onBackground },
    ip: { fontSize: 11, color: c.secondary, marginTop: 4 },
    ib: {
      backgroundColor: c.primaryContainer,
      padding: 8,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: c.onBackground,
      alignItems: 'center',
      marginTop: 8,
    },
    ibT: { fontSize: 12, color: c.onPrimaryContainer },
    empty: { padding: 24, textAlign: 'center', color: c.secondary },
  };
});

export const MarketplaceScreen: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const s = stylesheet;
  const c = theme.colors as Record<string, string>;
  const [points, setPoints] = useState(0);
  const [pools, setPools] = useState<RewardPool[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    Promise.all([RewardsService.getBalance(), RewardsService.getPools()])
      .then(([bal, poolList]) => {
        setPoints(bal.points ?? 0);
        setPools(Array.isArray(poolList) ? poolList : []);
      })
      .catch(() => {
        setPoints(0);
        setPools([]);
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
      // keep UI simple — user sees unchanged balance
    }
  };

  const content = (
    <>
      {!embedded && (
        <View style={s.h}>
          <PixelText style={s.t}>{t.marketplace.title}</PixelText>
        </View>
      )}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={c.primary} />
      ) : (
        <ScrollView>
          <View style={s.bal}>
            <OrnateFrame style={s.balCd} padding={12}>
              <PixelText style={s.bl}>{t.marketplace.points}</PixelText>
              <Text style={s.bv}>{points.toLocaleString()}</Text>
            </OrnateFrame>
            <OrnateFrame style={s.balCd} padding={12}>
              <PixelText style={s.bl}>{t.marketplace.offers}</PixelText>
              <Text style={s.bv}>{pools.length}</Text>
            </OrnateFrame>
          </View>
          <View style={s.grid}>
            {pools.length === 0 ? (
              <EmptyState message={t.marketplace.empty} hint={t.explore.marketHint} icon="shop" />
            ) : (
              pools.map((p) => (
                <OrnateFrame key={p.id} style={s.item} padding={12}>
                  <PixelText style={s.il}>{p.title}</PixelText>
                  <Text style={s.ip}>{p.sponsor_name}</Text>
                  <Text style={s.ip}>{p.points_required} pts · {p.available} {t.marketplace.left}</Text>
                  <Pressable
                    style={({ pressed }) => [s.ib, pressed && { opacity: 0.85 }]}
                    onPress={() => void redeem(p.id)}
                  >
                    <Text style={s.ibT}>{t.common.redeem}</Text>
                  </Pressable>
                </OrnateFrame>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </>
  );

  if (embedded) return <View style={{ flex: 1 }}>{content}</View>;
  return (
    <SafeAreaView style={s.ct} edges={['top']}>
      {content}
    </SafeAreaView>
  );
};
