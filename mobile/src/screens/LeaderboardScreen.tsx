import React, { useEffect } from 'react';
import { Image, Alert, View } from 'react-native';
import { observer, useObservable } from '@legendapp/state/react';
import { ActivityService, LeaderboardEntry } from '../services/api';

import { Column } from '../components/Column';
import { Row } from '../components/Row';
import { ScrollContainer } from '../components/ScrollContainer';
import { GameCard } from '../components/GameCard';
import { PixelText } from '../components/PixelText';
import { ArcadeButton } from '../components/ArcadeButton';
import { AthleteSprite } from '../components/AthleteSprite';
import { colors as tokens } from '@tokens/generated/restyle-colors';

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
    <Column flex={1} style={{ backgroundColor: tokens.octopath.background, paddingTop: 40 }}>
      <Row paddingHorizontal={16} justifyContent="space-between" alignItems="center" style={{ marginBottom: 16 }}>
        <PixelText size="lg" color="primary" shadow>HIGH_SCORES</PixelText>
        <Image source={rewardTrophy} style={{ width: 28, height: 28 }} resizeMode="contain" />
      </Row>

      {/* Podium TOP 3 — Metal Slug style */}
      <Row justifyContent="center" alignItems="flex-end" gap={8} style={{ marginBottom: 24, marginTop: 16 }} paddingHorizontal={16}>
        {/* Silver */}
        <Column alignItems="center" flex={1}>
          <View style={{ backgroundColor: tokens.primitive.silver, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 2, borderColor: tokens.primitive.pixelBlack, marginBottom: 4 }}>
            <PixelText color="inverse" size="xs" style={{ fontSize: 7 }}>RANK_02</PixelText>
          </View>
          <GameCard variant="metal" padding={8} style={{ width: '100%', alignItems: 'center', borderBottomWidth: 4 }}>
            <AthleteSprite type="cyclist" state="action" size={45} />
            <PixelText color="inverse" size="xs" shadow style={{ marginTop: 8 }} numberOfLines={1}>
              {ranking[1]?.username || '---'}
            </PixelText>
            <PixelText color="muted" size="xs" style={{ fontSize: 8, marginTop: 4 }}>
              {ranking[1]?.points || 0}PTS
            </PixelText>
          </GameCard>
        </Column>

        {/* Gold */}
        <Column alignItems="center" flex={1.2}>
          <View style={{ backgroundColor: tokens.semantic.primary, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 2, borderColor: tokens.primitive.pixelBlack, marginBottom: 4 }}>
            <PixelText color="inverse" size="xs" style={{ fontSize: 7 }}>RANK_01</PixelText>
          </View>
          <GameCard variant="dark" padding={12} style={{ width: '100%', alignItems: 'center', borderBottomWidth: 6 }}>
            <AthleteSprite type="elite" state="action" size={60} />
            <PixelText color="inverse" size="sm" shadow style={{ marginTop: 8 }} numberOfLines={1}>
              {ranking[0]?.username || '---'}
            </PixelText>
            <PixelText color="primary" size="xs" style={{ marginTop: 4 }}>
              {ranking[0]?.points || 0} MAX
            </PixelText>
          </GameCard>
        </Column>

        {/* Bronze */}
        <Column alignItems="center" flex={1}>
          <View style={{ backgroundColor: tokens.semantic.warning, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 2, borderColor: tokens.primitive.pixelBlack, marginBottom: 4 }}>
            <PixelText color="inverse" size="xs" style={{ fontSize: 7 }}>RANK_03</PixelText>
          </View>
          <GameCard variant="parchment" padding={8} style={{ width: '100%', alignItems: 'center', borderBottomWidth: 4 }}>
            <AthleteSprite type="runner" state="action" size={45} />
            <PixelText color="text" size="xs" style={{ marginTop: 8 }} numberOfLines={1}>
              {ranking[2]?.username || '---'}
            </PixelText>
            <PixelText color="muted" size="xs" style={{ fontSize: 8, marginTop: 4 }}>
              {ranking[2]?.points || 0}PTS
            </PixelText>
          </GameCard>
        </Column>
      </Row>

      {/* Rest of ranking */}
      <ScrollContainer style={{ flex: 1 }} paddingHorizontal={16} showsVerticalScrollIndicator={false}>
        <Column gap={12} style={{ paddingBottom: 120 }}>
          {ranking.slice(3, 15).map((item, i) => (
            <GameCard key={i} variant="dark" padding={12}>
              <Row alignItems="center" justifyContent="space-between">
                <Row alignItems="center" gap={12}>
                  <PixelText color="muted" size="xs" style={{ width: 30 }}>
                    #{i + 4}
                  </PixelText>
                  <AthleteSprite type={i % 2 === 0 ? 'runner' : 'cyclist'} state="idle" size={32} />
                  <Column>
                    <PixelText color="inverse" size="sm" shadow>{item.username}</PixelText>
                    <PixelText color="primary" size="xs" style={{ fontSize: 8, marginTop: 4 }}>{item.points} PTS</PixelText>
                  </Column>
                </Row>
                <ArcadeButton label="VS" size="sm" variant="danger" fullWidth={false} onPress={() => { }} />
              </Row>
            </GameCard>
          ))}
        </Column>
      </ScrollContainer>

      {/* Fixed My Rank HUD */}
      <GameCard
        variant="metal"
        padding={16}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
      >
        <Row alignItems="center" justifyContent="space-between">
          <Row alignItems="center" gap={12}>
            <PixelText color="primary" size="sm" style={{ width: 40 }}>
              #{myRank?.rank || '?'}
            </PixelText>
            <AthleteSprite type="runner" state="idle" size={36} />
            <Column>
              <PixelText color="inverse" size="md" shadow>YOU (P1)</PixelText>
              <PixelText color="primary" size="xs" style={{ marginTop: 4 }}>{myRank?.points || 0} PTS</PixelText>
            </Column>
          </Row>
          <ArcadeButton label="PROFILE" variant="secondary" size="sm" fullWidth={false} onPress={() => { }} />
        </Row>
      </GameCard>
    </Column>
  );
});
