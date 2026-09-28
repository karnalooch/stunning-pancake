import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import * as Haptics from 'expo-haptics';

import { Metric, PrimaryButton, ProductCard } from '../components/product';
import { SkeletonBlock } from '../components/ui/SkeletonBlock';
import { getVisionProfileFixture, isVisionFixtures } from '../bootstrap/visionFixtures';
import { useGameProgress } from '../hooks/useGameProgress';
import { useRiderStats } from '../hooks/useRiderStats';
import { useI18n } from '../i18n/useI18n';
import { AuthService, type UserProfile } from '../services/api';
import { LAYOUT } from '../theme/layout';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';
import { formatRiderDisplayName } from '../utils/displayName';

const stylesheet = StyleSheet.create((theme) => {
  const semantic = getSemanticColors(theme.colors);

  return {
    container: {
      flex: 1,
      backgroundColor: semantic.canvas.background,
    },
    header: {
      minHeight: 72,
      paddingHorizontal: LAYOUT.gutter,
      paddingVertical: 12,
      justifyContent: 'center',
      backgroundColor: semantic.surface.raised,
      borderBottomWidth: 1,
      borderBottomColor: semantic.border.subtle,
    },
    headerTitle: {
      ...PRODUCT_TYPOGRAPHY.title,
      color: semantic.text.primary,
    },
    content: {
      padding: LAYOUT.gutter,
      gap: LAYOUT.sectionGap,
      paddingBottom: 112,
    },
    section: {
      gap: 8,
    },
    sectionTitle: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      fontSize: 18,
      lineHeight: 24,
      color: semantic.text.primary,
    },
    identityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: semantic.selection.background,
      borderWidth: 1,
      borderColor: semantic.selection.border,
    },
    avatarText: {
      ...PRODUCT_TYPOGRAPHY.title,
      color: semantic.selection.content,
    },
    identityCopy: {
      flex: 1,
      gap: 3,
    },
    riderName: {
      ...PRODUCT_TYPOGRAPHY.title,
      color: semantic.text.primary,
    },
    secondaryText: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.secondary,
    },
    label: {
      ...PRODUCT_TYPOGRAPHY.metricLabel,
      color: semantic.text.secondary,
      textTransform: 'uppercase',
    },
    stateContent: {
      gap: 8,
    },
    errorTitle: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.status.error,
    },
    offlineTitle: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.status.offline,
    },
    stateBody: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.secondary,
    },
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    metricCell: {
      flexBasis: '47%',
      flexGrow: 1,
    },
    communityName: {
      ...PRODUCT_TYPOGRAPHY.title,
      fontSize: 20,
      lineHeight: 26,
      color: semantic.text.primary,
    },
    progressHeader: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 12,
    },
    progressValue: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.text.primary,
    },
    progressTrack: {
      height: 8,
      overflow: 'hidden',
      borderRadius: 4,
      backgroundColor: semantic.surface.interactive,
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
      backgroundColor: semantic.progress.primary,
    },
    actionStack: {
      gap: 8,
    },
  };
});

interface Props {
  user?: { username?: string };
  onLogout?: () => void;
  onTraining?: () => void;
  onSettings?: () => void;
  onTrends?: () => void;
}

function initialsFor(name: string): string {
  const initials = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return initials || '4V';
}

export const AthleteProfileScreen: React.FC<Props> = ({
  user,
  onLogout,
  onTraining,
  onSettings,
  onTrends,
}) => {
  const { t } = useI18n();
  const s = stylesheet;
  const fixturesEnabled = isVisionFixtures();
  const profileFixture = getVisionProfileFixture(fixturesEnabled);
  const { level, xpBar } = useGameProgress();
  const {
    rides,
    distanceKm,
    verified,
    streakDays,
    loading: statsLoading,
    offline: statsOffline,
    error: statsError,
    refresh: refreshStats,
  } = useRiderStats();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(!fixturesEnabled);
  const [profileError, setProfileError] = useState(false);

  const retryProfile = useCallback(async () => {
    if (fixturesEnabled) return;

    setProfileLoading(true);
    setProfileError(false);
    try {
      setProfile(await AuthService.getProfile());
    } catch {
      setProfileError(true);
    } finally {
      setProfileLoading(false);
    }
  }, [fixturesEnabled]);

  useEffect(() => {
    if (fixturesEnabled) return;

    let active = true;
    void AuthService.getProfile()
      .then((nextProfile) => {
        if (active) setProfile(nextProfile);
      })
      .catch(() => {
        if (active) setProfileError(true);
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fixturesEnabled]);

  const displayName = formatRiderDisplayName(
    profileFixture?.username ?? profile?.username ?? user?.username,
    t.profile.athlete,
  );
  const displayEmail = fixturesEnabled ? null : profile?.email?.trim() || null;
  const displayCommunity = fixturesEnabled ? null : profile?.tenant_name?.trim() || null;
  const displayDistanceKm = profileFixture?.stats.km ?? distanceKm;
  const displayRides = profileFixture?.stats.rides ?? rides;
  const displayVerified = profileFixture?.stats.verified ?? verified;
  const displayStreakDays = profileFixture?.streakDays ?? streakDays;
  const displayLevel = profileFixture?.level ?? level;
  const displayXpCurrent = profileFixture?.xpCurrent ?? xpBar.current;
  const displayXpMax = profileFixture?.xpMax ?? xpBar.max;
  const displayStatsLoading = fixturesEnabled ? false : statsLoading;
  const displayStatsOffline = fixturesEnabled ? false : statsOffline;
  const displayStatsError = fixturesEnabled ? false : statsError;
  const displayXpPct = Math.max(0, Math.min(1, displayXpCurrent / Math.max(1, displayXpMax)));
  const avatarInitials = useMemo(() => initialsFor(displayName), [displayName]);

  const runAction = (action?: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    action?.();
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <Text style={s.headerTitle}>{t.tabs.you}</Text>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t.profile.identity}</Text>
          {profileLoading && !user?.username ? (
            <SkeletonBlock height={112} />
          ) : (
            <ProductCard variant="raised" testID="profile-identity-card">
              <View style={s.identityRow}>
                <View style={s.avatar} accessibilityElementsHidden>
                  <Text style={s.avatarText}>{avatarInitials}</Text>
                </View>
                <View style={s.identityCopy}>
                  <Text style={s.riderName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  {displayEmail ? (
                    <Text style={s.secondaryText} numberOfLines={1}>
                      {displayEmail}
                    </Text>
                  ) : null}
                  {profileLoading ? (
                    <Text style={s.secondaryText}>{t.profile.profileLoading}</Text>
                  ) : null}
                </View>
              </View>
            </ProductCard>
          )}

          {profileError ? (
            <ProductCard testID="profile-load-error">
              <View style={s.stateContent}>
                <Text style={s.errorTitle}>{t.profile.profileLoadErrorTitle}</Text>
                <Text style={s.stateBody}>{t.profile.profileLoadErrorBody}</Text>
                <PrimaryButton
                  label={t.common.retry}
                  onPress={() => void retryProfile()}
                  variant="secondary"
                  testID="profile-retry"
                />
              </View>
            </ProductCard>
          ) : null}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t.profile.statistics}</Text>

          {displayStatsOffline ? (
            <ProductCard testID="profile-stats-offline">
              <View style={s.stateContent}>
                <Text style={s.offlineTitle}>{t.errors.network}</Text>
                <Text style={s.stateBody}>{t.errors.offlineCache}</Text>
              </View>
            </ProductCard>
          ) : null}

          {displayStatsLoading ? (
            <SkeletonBlock height={168} />
          ) : displayStatsError ? (
            <ProductCard testID="profile-stats-error">
              <View style={s.stateContent}>
                <Text style={s.errorTitle}>{t.profile.statsLoadErrorTitle}</Text>
                <Text style={s.stateBody}>{t.profile.statsLoadErrorBody}</Text>
                <PrimaryButton
                  label={t.common.retry}
                  onPress={() => void refreshStats()}
                  variant="secondary"
                  testID="profile-stats-retry"
                />
              </View>
            </ProductCard>
          ) : (
            <View style={s.metricsGrid}>
              <View style={s.metricCell}>
                <ProductCard>
                  <Metric
                    label={t.profile.distance}
                    value={`${displayDistanceKm.toLocaleString()} km`}
                    testID="profile-distance"
                  />
                </ProductCard>
              </View>
              <View style={s.metricCell}>
                <ProductCard>
                  <Metric
                    label={t.profile.rides}
                    value={String(displayRides)}
                    testID="profile-rides"
                  />
                </ProductCard>
              </View>
              <View style={s.metricCell}>
                <ProductCard>
                  <Metric
                    label={t.profile.verified}
                    value={String(displayVerified)}
                    testID="profile-verified"
                  />
                </ProductCard>
              </View>
              <View style={s.metricCell}>
                <ProductCard>
                  <Metric
                    label={t.profile.streak}
                    value={String(displayStreakDays)}
                    testID="profile-streak"
                  />
                </ProductCard>
              </View>
            </View>
          )}
        </View>

        {displayCommunity ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t.profile.community}</Text>
            <ProductCard testID="profile-community-card">
              <Text style={s.label}>{t.profile.community}</Text>
              <Text style={s.communityName}>{displayCommunity}</Text>
            </ProductCard>
          </View>
        ) : null}

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t.settings.achievements}</Text>
          <ProductCard testID="profile-achievements-unavailable">
            <Text style={s.stateBody}>{t.profile.achievementsUnavailable}</Text>
          </ProductCard>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t.profile.progression}</Text>
          <ProductCard>
            <View style={s.stateContent}>
              <View style={s.progressHeader}>
                <Text style={s.progressValue}>
                  {t.profile.level} {displayLevel}
                </Text>
                <Text style={s.secondaryText}>
                  {displayXpCurrent.toLocaleString()} / {displayXpMax.toLocaleString()} XP
                </Text>
              </View>
              <View
                style={s.progressTrack}
                accessibilityRole="progressbar"
                accessibilityValue={{
                  min: 0,
                  max: displayXpMax,
                  now: Math.min(displayXpCurrent, displayXpMax),
                }}
              >
                <View style={[s.progressFill, { width: `${displayXpPct * 100}%` }]} />
              </View>
            </View>
          </ProductCard>
        </View>

        <View style={s.actionStack}>
          <PrimaryButton
            label={t.settings.title}
            onPress={() => runAction(onSettings)}
            variant="secondary"
            testID="profile-settings-button"
          />
          <PrimaryButton
            label={t.settings.trends}
            onPress={() => runAction(onTrends)}
            variant="secondary"
          />
          <PrimaryButton
            label={t.profile.trainingLog}
            onPress={() => runAction(onTraining)}
            variant="secondary"
          />
          <PrimaryButton
            label={t.common.logout}
            onPress={() => runAction(onLogout)}
            variant="destructive"
            testID="profile-logout-button"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
