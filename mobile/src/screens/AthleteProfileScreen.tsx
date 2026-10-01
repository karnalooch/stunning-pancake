import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Metric } from '../components/product';
import { RoadbookPage, RoadbookSection, RoadbookRow, RoadbookNotice, roadbookStyles as s } from '../components/roadbook/Surface';
import { getAppCopy } from '../components/roadbook/appCopy';
import { SkeletonBlock } from '../components/ui/SkeletonBlock';
import { getVisionProfileFixture, isVisionFixtures } from '../bootstrap/visionFixtures';
import { useGameProgress } from '../hooks/useGameProgress';
import { useRiderStats } from '../hooks/useRiderStats';
import { useI18n } from '../i18n/useI18n';
import { AuthService, type UserProfile } from '../services/api';
import { formatRiderDisplayName } from '../utils/displayName';

interface Props { user?: { username?: string }; onLogout?: () => void; onTraining?: () => void; onSettings?: () => void; onTrends?: () => void }
export const AthleteProfileScreen: React.FC<Props> = ({ user, onLogout, onTraining, onSettings, onTrends }) => {
  const { t, locale } = useI18n();
  const copy = getAppCopy(locale);
  const fixturesEnabled = isVisionFixtures();
  const profileFixture = getVisionProfileFixture(fixturesEnabled);
  const { level, xpBar } = useGameProgress();
  const { rides, distanceKm, verified, streakDays, loading: statsLoading, offline: statsOffline,
    error: statsError, refresh: refreshStats } = useRiderStats();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(!fixturesEnabled);
  const [profileError, setProfileError] = useState(false);
  const alive = useRef(false);
  const requestId = useRef(0);
  const retryProfile = useCallback(async () => {
    if (fixturesEnabled) return;
    const id = ++requestId.current;
    setProfileLoading(true); setProfileError(false);
    try {
      const next = await AuthService.getProfile();
      if (alive.current && id === requestId.current) setProfile(next);
    } catch { if (alive.current && id === requestId.current) setProfileError(true); }
    finally { if (alive.current && id === requestId.current) setProfileLoading(false); }
  }, [fixturesEnabled]);
  useEffect(() => { alive.current = true; void retryProfile(); return () => { alive.current = false; requestId.current++; }; }, [retryProfile]);
  const displayName = formatRiderDisplayName(profileFixture?.username ?? profile?.username ?? user?.username, t.profile.athlete);
  const displayEmail = fixturesEnabled ? null : profile?.email?.trim() || null;
  const displayCommunity = fixturesEnabled ? null : profile?.tenant_name?.trim() || null;
  const displayDistanceKm = profileFixture?.stats.km ?? distanceKm;
  const displayRides = profileFixture?.stats.rides ?? rides;
  const displayVerified = profileFixture?.stats.verified ?? verified;
  const displayStreakDays = profileFixture?.streakDays ?? streakDays;
  const displayLevel = profileFixture?.level ?? level;
  const displayXpCurrent = profileFixture?.xpCurrent ?? xpBar.current;
  const displayXpMax = profileFixture?.xpMax ?? xpBar.max;
  const displayStatsLoading = !fixturesEnabled && statsLoading;
  const displayStatsOffline = !fixturesEnabled && statsOffline;
  const displayStatsError = !fixturesEnabled && statsError;
  return <RoadbookPage title={copy.you} subtitle={displayName} testID="roadbook-you" sampleLabel={fixturesEnabled ? copy.sample : undefined}>
    <View testID="profile-identity-card" style={s.stack}>
      <Text style={s.body}>{copy.account}</Text>
      {displayEmail ? <Text style={s.caption}>{displayEmail}</Text> : null}
      {profileLoading ? <Text style={s.caption}>{t.profile.profileLoading}</Text> : null}
    </View>
    <RoadbookSection title={copy.shortcuts}>
      <RoadbookRow label={t.profile.trainingLog} onPress={onTraining} testID="you-open-training-log" />
      <RoadbookRow label={t.settings.trends} onPress={onTrends} testID="you-open-trends" />
      <RoadbookRow label={t.settings.title} detail={`${copy.appearance} · ${copy.equipment} · ${copy.privacy}`}
        onPress={onSettings} testID="profile-settings-button" />
    </RoadbookSection>
    {profileError ? <RoadbookNotice error title={t.profile.profileLoadErrorTitle} message={t.profile.profileLoadErrorBody}
      testID="profile-load-error" action={<RoadbookRow label={t.common.retry} onPress={() => void retryProfile()} testID="profile-retry" />} /> : null}
    <RoadbookSection title={t.profile.statistics}>
      {displayStatsOffline ? <RoadbookNotice title={t.errors.network} message={t.errors.offlineCache} testID="profile-stats-offline" /> : null}
      {displayStatsLoading ? <SkeletonBlock height={150} /> : displayStatsError ? <RoadbookNotice error
        title={t.profile.statsLoadErrorTitle} message={t.profile.statsLoadErrorBody} testID="profile-stats-error"
        action={<RoadbookRow label={t.common.retry} onPress={() => void refreshStats()} testID="profile-stats-retry" />} />
        : <View style={s.metrics}>
          <View style={s.metric}><Metric label={t.profile.distance} value={`${displayDistanceKm.toLocaleString()} km`} testID="profile-distance" /></View>
          <View style={s.metric}><Metric label={t.profile.rides} value={String(displayRides)} testID="profile-rides" /></View>
          <View style={s.metric}><Metric label={t.profile.verified} value={String(displayVerified)} testID="profile-verified" /></View>
          <View style={s.metric}><Metric label={t.profile.streak} value={String(displayStreakDays)} testID="profile-streak" /></View>
        </View>}
    </RoadbookSection>
    {displayCommunity ? <RoadbookSection title={t.profile.community} testID="profile-community-card"><Text style={s.value}>{displayCommunity}</Text></RoadbookSection> : null}
    <RoadbookSection title={copy.progress}>
      <RoadbookRow label={`${t.profile.level} ${displayLevel}`} detail={`${displayXpCurrent.toLocaleString()} / ${displayXpMax.toLocaleString()} XP`} />
      <View accessibilityRole="progressbar" accessibilityLabel={t.profile.progression}
        accessibilityValue={{ min: 0, max: displayXpMax, now: Math.min(displayXpCurrent, displayXpMax) }} />
    </RoadbookSection>
    <RoadbookRow label={t.common.logout} onPress={onLogout} destructive testID="profile-logout-button" />
  </RoadbookPage>;
};
