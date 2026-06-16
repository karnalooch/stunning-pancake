/**
 * CityHubScreen — STITCH Phase 1 (P0)
 * 
 * City-level competition dashboard. Shows City Wars VS banner,
 * local leaderboard, nearby quests, City of the Week.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
    ActivityService,
    type CityHubSummary,
    type LeaderboardEntry,
} from '../services/api';
import { useI18n } from '../i18n/useI18n';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { FONTS } from '../theme/fonts';
import { useImmersiveTheme } from '../hooks/useImmersiveTheme';
import { useGameProgress } from '../hooks/useGameProgress';
import { SceneBackground } from '../components/scene/SceneBackground';
import { SpeechBubble } from '../components/narration/SpeechBubble';
import { LevelXpBar } from '../components/game/LevelXpBar';
import { ChromeIcon } from '../components/ui/ChromeIcon';
import { OfflineCacheService } from '../services/OfflineCacheService';
import { withRetry } from '../services/apiRetry';
import { AppHeader } from '../components/ui/AppHeader';
import { SkeletonBlock } from '../components/ui/SkeletonBlock';
import { CityBanner } from '../components/game/CityBanner';
import { VersusBar } from '../components/game/VersusBar';
import { LaurelHeader } from '../components/ui/LaurelHeader';
import { OrnateFrame } from '../components/ui/OrnateFrame';
import { getVisionCityHubFixture, isVisionFixtures } from '../bootstrap/visionFixtures';

const stylesheet = StyleSheet.create(theme => {
    const C = theme.colors as Record<string, string>;
    const shadow = { shadowColor: C.onBackground, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 8 };
    const shadowSm = { shadowColor: C.onBackground, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 };
    return {
    shadow,
    shadowSm,
    container: { flex: 1, backgroundColor: C.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.surface,
        borderBottomWidth: 4, borderBottomColor: C.onBackground,
    },
    hdrLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: C.onBackground, backgroundColor: C.primaryContainer },
    hdrTitle: { fontSize: 18, fontFamily: FONTS.display, color: C.primary, textTransform: 'uppercase' },
    lvlBadge: { backgroundColor: C.primaryContainer, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 2, borderColor: C.onBackground, borderRadius: 4 },
    lvlText: { fontSize: 12, fontFamily: FONTS.display, textTransform: 'uppercase' },
    scroll: { flex: 1 },
    content: { padding: 16, gap: 16 },
    // Section wrappers
    sectionFrame: { gap: 10 },
    // Legacy City Wars typography (kept for labels around the new VS component)
    vsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    vsTitle: { fontSize: 16, fontFamily: FONTS.display, color: C.onBackground, textTransform: 'uppercase' },
    vsDelta: { fontSize: 10, fontFamily: FONTS.display, color: C.secondary, textTransform: 'uppercase', textAlign: 'center', marginTop: 4 },
    // Leaderboard
    lbRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: C.parchment, borderWidth: 2, borderColor: C.onBackground,
        borderRadius: 4, paddingHorizontal: 12, paddingVertical: 10,
    },
    lbRank: { fontSize: 18, fontFamily: FONTS.display, width: 24 },
    lbName: { fontSize: 14, fontFamily: FONTS.display, flex: 1, marginLeft: 8 },
    lbScore: { fontSize: 18, fontFamily: FONTS.display },
    // Nearby quests
    questGrid: { flexDirection: 'row', gap: 8 },
    questCard: {
        flex: 1, backgroundColor: C.parchment, borderWidth: 2, borderColor: C.onBackground,
        borderRadius: 8, padding: 12, gap: 4,
    },
    questTitle: { fontSize: 14, fontFamily: FONTS.display, textTransform: 'uppercase' },
    questBadge: {
        fontSize: 10, fontFamily: FONTS.display, paddingHorizontal: 6, paddingVertical: 2,
        borderWidth: 2, borderColor: C.onBackground, borderRadius: 2, alignSelf: 'flex-start',
    },
    questDist: { fontSize: 10, color: C.secondary },
    questTime: { fontSize: 16, fontFamily: FONTS.display, color: C.onBackground, marginTop: 4 },
    };
});

export const CityHubScreen: React.FC<{
    user?: { username: string } | null;
    onStartQuest?: (id: string) => void;
    onOpenClubs?: () => void;
    onOpenSegments?: () => void;
}> = ({ user, onStartQuest, onOpenClubs, onOpenSegments }) => {
    const { theme } = useUnistyles();
    const { t } = useI18n();
    const s = stylesheet;
    const C = theme.colors as Record<string, string>;
    const { enabled: immersiveEnabled } = useImmersiveTheme();
    const fixturesEnabled = isVisionFixtures();
    const cityHubFixture = getVisionCityHubFixture(fixturesEnabled);
    const { level, xpBar } = useGameProgress();
    const displayLevel = cityHubFixture?.level ?? level;
    const [showMoo, setShowMoo] = useState(false);
    const mooTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [leaderboardLive, setLeaderboardLive] = useState<LeaderboardEntry[]>([]);
    const [lbLoadingLive, setLbLoadingLive] = useState(true);
    const [cityHubLive, setCityHubLive] = useState<CityHubSummary | null>(null);
    const fixtureSummary = useMemo<CityHubSummary>(() => ({
        active_event: null,
        city_of_week: {
            tenant_id: 'fixture_lublin',
            name: cityHubFixture?.cityOfWeek.name ?? 'Lublin',
            score_km: (cityHubFixture?.cityWars.left.score ?? 1240) / 10,
        },
        city_wars: {
            event_id: 1,
            tenant_a: { id: 'fixture_lublin', name: cityHubFixture?.cityWars.left.name ?? 'Lublin', score: cityHubFixture?.cityWars.left.score ?? 1240 },
            tenant_b: { id: 'fixture_warszawa', name: cityHubFixture?.cityWars.right.name ?? 'Warszawa', score: cityHubFixture?.cityWars.right.score ?? 1180 },
            leader:
                (cityHubFixture?.cityWars.left.score ?? 1240) >= (cityHubFixture?.cityWars.right.score ?? 1180)
                    ? (cityHubFixture?.cityWars.left.name ?? 'Lublin')
                    : (cityHubFixture?.cityWars.right.name ?? 'Warszawa'),
            delta: Math.abs((cityHubFixture?.cityWars.left.score ?? 1240) - (cityHubFixture?.cityWars.right.score ?? 1180)),
        },
        leaderboard: (cityHubFixture?.leaderboard ?? []).map((entry) => ({
            rank: entry.rank,
            username: entry.name,
            points: entry.score,
            score_km: entry.score,
            is_me: false,
        })),
        my_rank: null,
        quests: (cityHubFixture?.quests ?? []).map((quest) => ({
            id: quest.id,
            name: quest.title,
            category: 'QUEST',
            description: `${quest.distanceKm.toFixed(2)} km · ${quest.star}★ · ${quest.coin}`,
            latitude: null,
            longitude: null,
        })),
    }), [cityHubFixture]);
    useEffect(() => {
        if (fixturesEnabled) return;
        const cached = OfflineCacheService.getCityHub();
        if (cached) {
            setCityHubLive(cached);
            setLeaderboardLive((cached.leaderboard ?? []).slice(0, 10));
        }
        setLbLoadingLive(true);
        withRetry(() => ActivityService.getCityHubSummary())
            .then((summary) => {
                OfflineCacheService.setCityHub(summary);
                setCityHubLive(summary);
                setLeaderboardLive((summary.leaderboard ?? []).slice(0, 10));
            })
            .catch(() => {
                if (!cached) {
                    setCityHubLive(null);
                    setLeaderboardLive([]);
                }
            })
            .finally(() => setLbLoadingLive(false));
    }, [fixtureSummary, fixturesEnabled, user?.username]);

    useEffect(() => () => {
        if (mooTimer.current) clearTimeout(mooTimer.current);
    }, []);

    const rivalColor = C.rival;

    const handleCityWarsPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setShowMoo(true);
        if (mooTimer.current) clearTimeout(mooTimer.current);
        mooTimer.current = setTimeout(() => setShowMoo(false), 2500);
    };

    const effectiveCityHub = fixturesEnabled ? fixtureSummary : cityHubLive;
    const effectiveLeaderboard = fixturesEnabled ? fixtureSummary.leaderboard : leaderboardLive;
    const lbLoading = fixturesEnabled ? false : lbLoadingLive;

    const cityOfWeekName = effectiveCityHub?.city_of_week?.name ?? '—';
    const cityOfWeekKm = effectiveCityHub?.city_of_week?.score_km ?? 0;
    const wars = effectiveCityHub?.city_wars;
    const leftScore = wars?.tenant_a?.score ?? 0;
    const rightScore = wars?.tenant_b?.score ?? 0;
    const quests = effectiveCityHub?.quests ?? [];

    return (
    <View style={s.container}>
        {immersiveEnabled && <SceneBackground sceneId="city_hub" scrim="soft" />}
        <AppHeader
            rightSlot={
                <LevelXpBar level={displayLevel} xpCurrent={xpBar.current} xpMax={xpBar.max} pct={xpBar.pct} />
            }
        />
        <ScrollView style={s.scroll} contentContainerStyle={s.content}>
            {/* City of the Week */}
            <OrnateFrame style={s.sectionFrame}>
                <CityBanner cityName={cityOfWeekName} label={t.compete.cityOfWeek} />
                <Text style={{ color: C.secondary, textAlign: 'center' }}>{cityOfWeekKm.toFixed(1)} km</Text>
            </OrnateFrame>

            {/* City Wars */}
            <OrnateFrame style={s.sectionFrame}>
                <Pressable style={s.vsHeader} onPress={handleCityWarsPress}>
                    <ChromeIcon id="cityWars" size={20} />
                    <Text style={s.vsTitle}>{t.compete.cityWars}</Text>
                </Pressable>
                {showMoo ? <SpeechBubble text={t.compete.moo} /> : null}
                <VersusBar
                    left={{ name: wars?.tenant_a?.name ?? '—', score: Math.round(leftScore) }}
                    right={{ name: wars?.tenant_b?.name ?? '—', score: Math.round(rightScore) }}
                />
                <Text style={s.vsDelta}>
                    {wars ? `${t.compete.lead}: ${wars.delta.toFixed(2)} ${t.compete.vpUnit}` : t.compete.waitingBattle}
                </Text>
            </OrnateFrame>

            {/* Top Riders — live API */}
            <OrnateFrame style={s.sectionFrame}>
                <LaurelHeader title={t.compete.leaderboard} />
                {lbLoading ? (
                    <SkeletonBlock height={160} />
                ) : effectiveLeaderboard.length === 0 ? (
                    <Text style={s.questDist}>{t.compete.empty}</Text>
                ) : (
                    effectiveLeaderboard.map((r) => (
                        <View
                            key={`${r.rank}-${r.username}`}
                            style={[
                                s.lbRow,
                                r.is_me && { backgroundColor: C.primaryContainer, transform: [{ translateY: -2 }] },
                                s.shadowSm,
                            ]}
                        >
                            <Text style={[s.lbRank, { color: r.rank === 1 ? C.primary : C.secondary }]}>{r.rank}</Text>
                            <Text style={s.lbName}>{r.is_me ? t.compete.you : r.username}</Text>
                            <Text style={s.lbScore}>
                                {r.score_km != null ? `${r.score_km.toFixed(1)} km` : `${r.points}`}
                            </Text>
                        </View>
                    ))
                )}
            </OrnateFrame>

            {/* Nearby Quests */}
            <OrnateFrame style={s.sectionFrame}>
                <View style={s.vsHeader}>
                    <ChromeIcon id="quests" size={20} />
                    <Text style={s.vsTitle}>{t.compete.nearbyQuests}</Text>
                </View>
                {quests.length === 0 ? (
                    <Text style={s.questDist}>{t.compete.noQuests}</Text>
                ) : (
                    <View style={s.questGrid}>
                        {quests.slice(0, 2).map((quest, idx) => (
                            <Pressable
                                key={quest.id}
                                style={({ pressed }) => [
                                    s.questCard,
                                    idx % 2 === 1 && { backgroundColor: C.primaryContainer },
                                    pressed && { opacity: 0.8 },
                                ]}
                                onPress={() => onStartQuest?.(quest.id)}
                            >
                                <Text
                                    style={[
                                        s.questBadge,
                                        {
                                            backgroundColor: idx % 2 === 0 ? rivalColor : C.onBackground,
                                            color: C.onPrimary,
                                        },
                                    ]}
                                >
                                    {quest.category}
                                </Text>
                                <Text style={[s.questTitle, { color: C.onBackground }]}>{quest.name}</Text>
                                <Text style={s.questDist}>
                                    {quest.latitude != null && quest.longitude != null
                                        ? `${quest.latitude.toFixed(3)}, ${quest.longitude.toFixed(3)}`
                                        : t.compete.noGeoData}
                                </Text>
                                <Text style={s.questTime}>{quest.description || t.compete.tapToStart}</Text>
                            </Pressable>
                        ))}
                    </View>
                )}
            </OrnateFrame>

            <View style={s.questGrid}>
                <Pressable style={({ pressed }) => [s.questCard, pressed && { opacity: 0.8 }]} onPress={onOpenClubs}>
                    <Text style={s.questTitle}>{t.compete.clubs}</Text>
                    <Text style={s.questDist}>{t.compete.clubsHint}</Text>
                </Pressable>
                <Pressable style={({ pressed }) => [s.questCard, pressed && { opacity: 0.8 }]} onPress={onOpenSegments}>
                    <Text style={s.questTitle}>{t.compete.segments}</Text>
                    <Text style={s.questDist}>{t.compete.segmentsHint}</Text>
                </Pressable>
            </View>

            <View style={{ height: 80 }} />
        </ScrollView>
    </View>
    );
};
