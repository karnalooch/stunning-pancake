/**
 * CityHubScreen — STITCH Phase 1 (P0)
 * 
 * City-level competition dashboard. Shows City Wars VS banner,
 * local leaderboard, nearby quests, City of the Week.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import {
    ActivityService,
    type CityHubSummary,
    type LeaderboardEntry,
} from '../services/api';
import { useI18n } from '../i18n/useI18n';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useImmersiveTheme } from '../hooks/useImmersiveTheme';
import { useGameProgress } from '../hooks/useGameProgress';
import { SceneBackground } from '../components/scene/SceneBackground';
import { SpeechBubble } from '../components/narration/SpeechBubble';
import { LevelXpBar } from '../components/game/LevelXpBar';
import { CyclistSprite } from '../components/sprites/CyclistSprite';

const stylesheet = StyleSheet.create(theme => {
    const C = theme.colors as any;
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
    hdrTitle: { fontSize: 24, fontWeight: '700', color: C.primary, textTransform: 'uppercase' },
    lvlBadge: { backgroundColor: C.primaryContainer, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 2, borderColor: C.onBackground, borderRadius: 4 },
    lvlText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
    scroll: { flex: 1 },
    content: { padding: 16, gap: 16 },
    // City of the Week banner
    banner: { borderRadius: 8, borderWidth: 4, borderColor: C.onBackground, overflow: 'hidden', aspectRatio: 1.83 },
    bannerImg: { width: '100%', height: '100%', backgroundColor: C.primaryContainer },
    bannerOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: 'rgba(0,0,0,0.5)' },
    bannerBadge: { fontSize: 10, fontWeight: '700', color: '#bbf29b', textTransform: 'uppercase', letterSpacing: 2 },
    bannerCity: { fontSize: 32, fontWeight: '700', color: '#ffffff' },
    // City Wars
    vsCard: { backgroundColor: C.parchment, borderWidth: 4, borderColor: C.onBackground, borderRadius: 8, padding: 16, gap: 12 },
    vsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    vsTitle: { fontSize: 18, fontWeight: '700', color: C.onBackground, textTransform: 'uppercase' },
    vsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    vsCity: { fontSize: 14, fontWeight: '700', color: C.primary },
    vsCityRight: { fontSize: 14, fontWeight: '700', color: C.onBackground, textAlign: 'right' },
    vsScore: { fontSize: 20, fontWeight: '700', color: C.primary },
    vsScoreRight: { fontSize: 20, fontWeight: '700', color: C.onBackground, textAlign: 'right' },
    vsDivider: { fontSize: 14, fontWeight: '700', color: C.tertiary, textAlign: 'center' },
    vsBar: { height: 16, flexDirection: 'row', backgroundColor: '#e1e3da', borderWidth: 2, borderColor: C.onBackground, borderRadius: 2, overflow: 'hidden' },
    vsBarLeft: { backgroundColor: C.primary },
    vsDelta: { fontSize: 10, fontWeight: '700', color: C.secondary, textTransform: 'uppercase', textAlign: 'center', marginTop: 4 },
    // Leaderboard
    lbRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: C.parchment, borderWidth: 2, borderColor: C.onBackground,
        borderRadius: 4, paddingHorizontal: 12, paddingVertical: 10,
    },
    lbRank: { fontSize: 20, fontWeight: '700', width: 24 },
    lbName: { fontSize: 16, fontWeight: '700', flex: 1, marginLeft: 8 },
    lbScore: { fontSize: 20, fontWeight: '700' },
    // Nearby quests
    questGrid: { flexDirection: 'row', gap: 8 },
    questCard: {
        flex: 1, backgroundColor: C.parchment, borderWidth: 2, borderColor: C.onBackground,
        borderRadius: 8, padding: 12, gap: 4,
    },
    questTitle: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase' },
    questBadge: {
        fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2,
        borderWidth: 2, borderColor: C.onBackground, borderRadius: 2, alignSelf: 'flex-start',
    },
    questDist: { fontSize: 10, color: C.secondary },
    questTime: { fontSize: 18, fontWeight: '700', color: C.onBackground, marginTop: 4 },
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
    const C = theme.colors as any;
    const { enabled: immersiveEnabled } = useImmersiveTheme();
    const { level, xpBar } = useGameProgress();
    const [showMoo, setShowMoo] = useState(false);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [lbLoading, setLbLoading] = useState(true);
    const [cityHub, setCityHub] = useState<CityHubSummary | null>(null);
    useEffect(() => {
        setLbLoading(true);
        ActivityService.getCityHubSummary()
            .then((summary) => {
                setCityHub(summary);
                setLeaderboard((summary.leaderboard ?? []).slice(0, 10));
            })
            .catch(() => {
                setCityHub(null);
                setLeaderboard([]);
            })
            .finally(() => setLbLoading(false));
    }, [user?.username]);

    const cityOfWeekName = cityHub?.city_of_week?.name ?? '—';
    const cityOfWeekKm = cityHub?.city_of_week?.score_km ?? 0;
    const wars = cityHub?.city_wars;
    const leftScore = wars?.tenant_a?.score ?? 0;
    const rightScore = wars?.tenant_b?.score ?? 0;
    const totalScore = leftScore + rightScore;
    const leftPct = totalScore > 0 ? Math.max(1, Math.round((leftScore / totalScore) * 100)) : 50;
    const rightPct = Math.max(1, 100 - leftPct);
    const quests = cityHub?.quests ?? [];

    return (
    <SafeAreaView style={s.container} edges={['top']}>
        {immersiveEnabled && <SceneBackground sceneId="city_hub" scrim="soft" />}
        <View style={[s.header, s.shadow]}>
            <View style={s.hdrLeft}>
                <View style={s.avatar} />
                <Text style={s.hdrTitle}>QUEST VELOS</Text>
            </View>
            <LevelXpBar level={level} xpCurrent={xpBar.current} xpMax={xpBar.max} pct={xpBar.pct} />
        </View>
        <ScrollView style={s.scroll} contentContainerStyle={s.content}>
            {immersiveEnabled && (
                <>
                    <SpeechBubble text={showMoo ? 'MOO!' : ''} />
                    {showMoo && <CyclistSprite size={40} state="idle" />}
                </>
            )}
            {/* City of the Week */}
            <View style={[s.banner, s.shadow]}>
                <View style={s.bannerImg}>
                    <View style={{ width: '100%', height: '100%', backgroundColor: C.primaryContainer }} />
                </View>
                <View style={s.bannerOverlay}>
                    <Text style={s.bannerBadge}>⭐ CITY OF THE WEEK</Text>
                    <Text style={s.bannerCity}>{cityOfWeekName}</Text>
                    <Text style={{ color: '#ffffff', fontWeight: '700' }}>{cityOfWeekKm.toFixed(1)} km</Text>
                </View>
            </View>

            {/* City Wars */}
            <View style={[s.vsCard, s.shadow]}>
                <Pressable style={s.vsHeader} onPress={() => setShowMoo((v) => !v)}>
                    <Text style={{ fontSize: 20 }}>⚔️</Text>
                    <Text style={s.vsTitle}>City Wars</Text>
                </Pressable>
                <View style={s.vsRow}>
                    <View>
                        <Text style={s.vsCity}>{wars?.tenant_a?.name ?? '—'}</Text>
                        <Text style={s.vsScore}>{leftScore.toFixed(2)} VP</Text>
                    </View>
                    <Text style={s.vsDivider}>VS</Text>
                    <View>
                        <Text style={s.vsCityRight}>{wars?.tenant_b?.name ?? '—'}</Text>
                        <Text style={s.vsScoreRight}>{rightScore.toFixed(2)} VP</Text>
                    </View>
                </View>
                <View style={s.vsBar}>
                    <View style={[s.vsBarLeft, { width: `${leftPct}%`, height: '100%' }]} />
                    <View style={{ backgroundColor: C.tertiary, width: `${rightPct}%`, height: '100%' }} />
                </View>
                <Text style={s.vsDelta}>
                    {wars ? `Lead: ${wars.delta.toFixed(2)} VP` : 'Waiting for active city battle'}
                </Text>
            </View>

            {/* Top Riders — live API */}
            <View style={[s.vsCard, s.shadow]}>
                <View style={s.vsHeader}>
                    <Text style={{ fontSize: 20 }}>🏆</Text>
                    <Text style={s.vsTitle}>{t.compete.leaderboard}</Text>
                </View>
                {lbLoading ? (
                    <ActivityIndicator color={C.primary} style={{ marginVertical: 12 }} />
                ) : leaderboard.length === 0 ? (
                    <Text style={s.questDist}>{t.compete.empty}</Text>
                ) : (
                    leaderboard.map((r) => (
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
            </View>

            {/* Nearby Quests */}
            <View style={[s.vsCard, s.shadow]}>
                <View style={s.vsHeader}>
                    <Text style={{ fontSize: 20 }}>🗺️</Text>
                    <Text style={s.vsTitle}>Nearby Quests</Text>
                </View>
                {quests.length === 0 ? (
                    <Text style={s.questDist}>No live quests available.</Text>
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
                                            backgroundColor: idx % 2 === 0 ? C.tertiary : C.onBackground,
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
                                        : 'No geo data'}
                                </Text>
                                <Text style={s.questTime}>{quest.description || 'Tap to start'}</Text>
                            </Pressable>
                        ))}
                    </View>
                )}
            </View>

            <View style={s.questGrid}>
                <Pressable style={({ pressed }) => [s.questCard, pressed && { opacity: 0.8 }]} onPress={onOpenClubs}>
                    <Text style={s.questTitle}>🏁 Clubs</Text>
                    <Text style={s.questDist}>Squad discovery</Text>
                </Pressable>
                <Pressable style={({ pressed }) => [s.questCard, pressed && { opacity: 0.8 }]} onPress={onOpenSegments}>
                    <Text style={s.questTitle}>⛰ Segments</Text>
                    <Text style={s.questDist}>KOM trophies</Text>
                </Pressable>
            </View>

            <View style={{ height: 80 }} />
        </ScrollView>
    </SafeAreaView>
    );
};
