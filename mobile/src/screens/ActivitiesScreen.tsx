import React, { useEffect } from 'react';
import { Share, Image, View } from 'react-native';
import { observer, useObservable } from '@legendapp/state/react';
import { ActivityService, ActivityItem } from '../services/api';

import { Column } from '../components/Column';
import { Row } from '../components/Row';
import { ScrollContainer } from '../components/ScrollContainer';
import { GameCard } from '../components/GameCard';
import { PixelText } from '../components/PixelText';
import { ArcadeButton } from '../components/ArcadeButton';
import { AthleteSprite } from '../components/AthleteSprite';
import { colors as tokens } from '@tokens/generated/restyle-colors';

const GRADE_ICONS: Record<string, any> = {
  S: undefined,
  A: undefined,
};

const verificationGrade = (score: number): { label: string; color: string } => {
  if (score >= 0.95) return { label: 'S', color: tokens.semantic.primary }; // Gold
  if (score >= 0.85) return { label: 'A', color: tokens.semantic.success }; // Green
  if (score >= 0.70) return { label: 'B', color: tokens.octopath.buttonBlueBg }; // Blue
  if (score >= 0.50) return { label: 'C', color: tokens.semantic.warning }; // Yellow
  return { label: 'D', color: tokens.semantic.error }; // Red
};

export const ActivitiesScreen = observer(() => {
  const state = useObservable({
    activities: [] as ActivityItem[],
    loading: true,
  });

  useEffect(() => {
    (async () => {
      try {
        state.loading.set(true);
        const data = await ActivityService.getHistory();
        state.activities.set(Array.isArray(data) ? data : []);
      } catch (e) {
        console.warn('[Activities] Fetch failed:', e);
      } finally {
        state.loading.set(false);
      }
    })();
  }, []);

  const activities = state.activities.get() || [];

  const handleShare = async (act: ActivityItem) => {
    try {
      await Share.share({
        message: [
          `${act.type} session on SPORT!`,
          `Distance: ${((act.distance || 0) / 1000).toFixed(2)} km`,
          `Grade: ${verificationGrade(act.verification_score).label}`,
        ].join(' · '),
      });
    } catch (e) {
      console.warn('[Activities] Share failed:', e);
    }
  };

  return (
    <Column flex={1} style={{ backgroundColor: tokens.octopath.background, paddingTop: 40 }} paddingHorizontal={16}>
      <Row justifyContent="space-between" alignItems="center" style={{ marginBottom: 24 }}>
        <PixelText size="lg" color="primary" shadow>QUEST_LOG</PixelText>
        <PixelText size="xs" color="success" style={{ fontSize: 8 }}>
          {activities.length} MISSIONS RECORDED
        </PixelText>
      </Row>

      <ScrollContainer showsVerticalScrollIndicator={false}>
        <Column gap={16} style={{ paddingBottom: 40 }}>
          {state.loading.get() && activities.length === 0 && (
            <Column style={{ padding: 40 }} alignItems="center">
              <AthleteSprite type="runner" state="action" size={60} />
              <PixelText size="xs" color="primary" style={{ marginTop: 16 }}>
                SCANNING SESSION LOGS...
              </PixelText>
            </Column>
          )}

          {!state.loading.get() && activities.length === 0 && (
            <Column style={{ padding: 40 }} alignItems="center">
              <AthleteSprite type="ghost" state="idle" size={60} />
              <PixelText size="xs" color="muted" style={{ marginTop: 16 }}>
                NO MISSIONS COMPLETED YET
              </PixelText>
              <PixelText size="xs" color="success" style={{ fontSize: 8, marginTop: 8 }}>
                GO TO HOME TO BEGIN
              </PixelText>
            </Column>
          )}

          {activities.map((act) => {
            const grade = verificationGrade(act.verification_score || 0);
            return (
              <GameCard key={act.id} variant="metal" padding={12}>
                <Row alignItems="center" gap={12}>
                  <View
                    style={{
                      backgroundColor: tokens.octopath.background,
                      borderWidth: 2,
                      borderColor: grade.color,
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 48,
                      height: 48,
                    }}
                  >
                    {GRADE_ICONS[grade.label] ? (
                      <Image source={GRADE_ICONS[grade.label]} style={{ width: 32, height: 32 }} resizeMode="contain" />
                    ) : (
                      <PixelText size="xl" color={grade.color === tokens.semantic.primary ? 'primary' : grade.color === tokens.semantic.success ? 'success' : grade.color === tokens.semantic.warning ? 'warning' : grade.color === tokens.semantic.error ? 'error' : 'text'} shadow style={{ fontSize: 20 }}>
                        {grade.label}
                      </PixelText>
                    )}
                  </View>

                  <Column flex={1}>
                    <PixelText size="sm" color="inverse" shadow>
                      {act.type?.toUpperCase() || 'UNKNOWN'} MISSION
                    </PixelText>
                    <PixelText size="xs" color="muted" style={{ fontSize: 8, marginTop: 6 }}>
                      {new Date(act.start_time).toLocaleDateString()} · {((act.distance || 0) / 1000).toFixed(2)} KM
                    </PixelText>
                  </Column>

                  <ArcadeButton
                    size="sm"
                    label="SHARE"
                    variant="secondary"
                    fullWidth={false}
                    onPress={() => handleShare(act)}
                  />
                </Row>
              </GameCard>
            );
          })}
        </Column>
      </ScrollContainer>

      <PixelText size="xs" color="muted" style={{ fontSize: 8, textAlign: 'center', opacity: 0.5, paddingVertical: 12 }}>
        QUEST LOG · RPG CHARACTER SHEET v2.0
      </PixelText>
    </Column>
  );
});
