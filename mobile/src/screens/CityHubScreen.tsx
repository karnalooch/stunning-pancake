/**
 * CityHubScreen — STITCH Phase 1 (P0)
 * 
 * City-level competition dashboard. Shows City Wars VS banner,
 * local leaderboard, nearby quests, City of the Week.
 */

import React from 'react';
import { View, Text, ScrollView, Image, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { stitchTheme } from '../theme/stitch';
import * as Haptics from 'expo-haptics';

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

const LEADERBOARD = [
    { rank: 1, name: 'PixelPusher', score: '12.4k', isYou: false },
    { rank: 2, name: 'AeroKnight', score: '11.8k', isYou: false },
    { rank: 3, name: 'You', score: '10.2k', isYou: true },
];

export const CityHubScreen: React.FC<{
    user?: { username: string } | null;
    onStartQuest?: (id: string) => void;
}> = ({ user, onStartQuest }) => {
    const { theme } = useUnistyles(); const s = stylesheet;
    const C = theme.colors as any;

    return (
    <SafeAreaView style={s.container} edges={['top']}>
        <View style={[s.header, s.shadow]}>
            <View style={s.hdrLeft}>
                <View style={s.avatar} />
                <Text style={s.hdrTitle}>QUEST VELOS</Text>
            </View>
            <View style={s.lvlBadge}>
                <Text style={s.lvlText}>LVL 42</Text>
            </View>
        </View>
        <ScrollView style={s.scroll} contentContainerStyle={s.content}>
            {/* City of the Week */}
            <View style={[s.banner, s.shadow]}>
                <View style={s.bannerImg}>
                    <Image
                        source={{ uri: 'https://lh3.googleusercontent.com/aida/ADBb0uiczyRDBQ4c5mPx4rIVMa6HfRg2mYd1VMp-K5oYsFRboHNqhxn2GOln_t5Boubvn28vcEOm_z4QAY_k_psM7QD3CyUtctHYM6XOQzy8MP4uzFlZbA1WPK1NUAHgon9DQ1-q3X-lvSjpn_Qu6t7RvublIJB7QrHPzV4c4aXnzUbc73M0ZeS50sqOcQgK8xCPrYPOeEmneM9R39cDg2jTCpB7skzw2Cn30_TnPs_fWv5I4fqeMGvcGzAO3nM' }}
                        style={{ width: '100%', height: '100%' }}
                    />
                </View>
                <View style={s.bannerOverlay}>
                    <Text style={s.bannerBadge}>⭐ CITY OF THE WEEK</Text>
                    <Text style={s.bannerCity}>Siedlce</Text>
                </View>
            </View>

            {/* City Wars */}
            <View style={[s.vsCard, s.shadow]}>
                <View style={s.vsHeader}>
                    <Text style={{ fontSize: 20 }}>⚔️</Text>
                    <Text style={s.vsTitle}>City Wars</Text>
                </View>
                <View style={s.vsRow}>
                    <View>
                        <Text style={s.vsCity}>Siedlce (You)</Text>
                        <Text style={s.vsScore}>45,210 VP</Text>
                    </View>
                    <Text style={s.vsDivider}>VS</Text>
                    <View>
                        <Text style={s.vsCityRight}>Warsaw</Text>
                        <Text style={s.vsScoreRight}>42,890 VP</Text>
                    </View>
                </View>
                <View style={s.vsBar}>
                    <View style={[s.vsBarLeft, { width: '51%', height: '100%' }]} />
                    <View style={{ backgroundColor: C.tertiary, width: '49%', height: '100%' }} />
                </View>
                <Text style={s.vsDelta}>Leading by 2,320 Velos Points</Text>
            </View>

            {/* Top Riders */}
            <View style={[s.vsCard, s.shadow]}>
                <View style={s.vsHeader}>
                    <Text style={{ fontSize: 20 }}>🏆</Text>
                    <Text style={s.vsTitle}>Top Riders</Text>
                </View>
                {LEADERBOARD.map((r) => (
                    <View key={r.rank} style={[s.lbRow, r.isYou && { backgroundColor: C.primaryContainer, transform: [{ translateY: -2 }] }, s.shadowSm]}>
                        <Text style={[s.lbRank, { color: r.rank === 1 ? C.primary : C.secondary }]}>{r.rank}</Text>
                        <Text style={s.lbName}>{r.name}</Text>
                        <Text style={[s.lbScore, { color: r.isYou ? C.onBackground : C.onBackground }]}>{r.score}</Text>
                    </View>
                ))}
            </View>

            {/* Nearby Quests */}
            <View style={[s.vsCard, s.shadow]}>
                <View style={s.vsHeader}>
                    <Text style={{ fontSize: 20 }}>🗺️</Text>
                    <Text style={s.vsTitle}>Nearby Quests</Text>
                </View>
                <View style={s.questGrid}>
                    <Pressable style={({ pressed }) => [s.questCard, pressed && { opacity: 0.8 }]} onPress={() => onStartQuest?.('park-sprint')}>
                        <Text style={[s.questBadge, { backgroundColor: C.tertiary, color: C.onPrimary }]}>KOM LOST</Text>
                        <Text style={[s.questTitle, { color: C.onBackground }]}>Park Sprint</Text>
                        <Text style={s.questDist}>1.2 km</Text>
                        <Text style={s.questTime}>1:45</Text>
                    </Pressable>
                    <Pressable style={({ pressed }) => [s.questCard, { backgroundColor: C.primaryContainer }, pressed && { opacity: 0.8 }]} onPress={() => onStartQuest?.('city-hall')}>
                        <Text style={[s.questBadge, { backgroundColor: C.onBackground, color: C.onPrimary }]}>KING</Text>
                        <Text style={[s.questTitle, { color: C.onBackground }]}>City Hall Climb</Text>
                        <Text style={s.questDist}>0.8 km</Text>
                        <Text style={s.questTime}>3:12</Text>
                    </Pressable>
                </View>
            </View>

            <View style={{ height: 80 }} />
        </ScrollView>
    </SafeAreaView>
    );
};
