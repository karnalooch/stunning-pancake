/**
 * RideSummaryScreen — STITCH Phase 1 (P0)
 * 
 * Post-ride celebration screen. Shows achievement badge, rank,
 * ride stats, and "BACK TO HUB" CTA.
 */

import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { stitchTheme } from '../theme/stitch';
import * as Haptics from 'expo-haptics';

const stylesheet = StyleSheet.create(theme => {
    const C = theme.colors as any;
    return {
    container: { flex: 1, backgroundColor: C.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.background,
        borderBottomWidth: 4, borderBottomColor: C.onBackground,
    },
    headerTitle: { fontSize: 24, fontWeight: '700', color: C.primary, textTransform: 'uppercase' },
    scroll: { flex: 1 },
    content: { padding: 16, gap: 16, alignItems: 'center' },
    titleSection: { alignItems: 'center', paddingTop: 32, paddingBottom: 16 },
    title: { fontSize: 48, fontWeight: '700', color: C.onBackground, textTransform: 'uppercase', letterSpacing: 2 },
    subtitle: { fontSize: 18, fontWeight: '500', color: C.outline, marginTop: 4 },
    badge: {
        width: 200, height: 200, justifyContent: 'center', alignItems: 'center',
        marginVertical: 16, position: 'relative',
    },
    badgeRing: {
        position: 'absolute', width: 160, height: 160, borderRadius: 80,
        backgroundColor: C.primaryContainer, opacity: 0.2,
    },
    badgeEmoji: { fontSize: 96 },
    rankContainer: {
        alignItems: 'center', backgroundColor: C.parchment,
        borderWidth: 4, borderColor: C.onBackground, borderRadius: 8,
        padding: 16, width: 120,
    },
    rankLabel: { fontSize: 12, fontWeight: '700', color: C.secondary, textTransform: 'uppercase' },
    rankLetter: { fontSize: 72, fontWeight: '700', color: C.goldAmber },
    rankName: { fontSize: 18, fontWeight: '700', color: C.onBackground, marginTop: 4 },
    statsGrid: {
        flexDirection: 'row', flexWrap: 'wrap', gap: 4, width: '100%',
    },
    statTile: {
        backgroundColor: C.parchment, borderWidth: 4, borderColor: C.onBackground,
        borderRadius: 8, padding: 12, flex: 1, minWidth: '45%',
    },
    statLabel: { fontSize: 10, fontWeight: '700', color: C.secondary, textTransform: 'uppercase' },
    statValue: { fontSize: 24, fontWeight: '700', color: C.onBackground, marginTop: 8 },
    statUnit: { fontSize: 14, fontWeight: '500', color: C.outline },
    elevationBar: { flexDirection: 'row', gap: 2, marginTop: 12 },
    elevBlockFilled: { width: 16, height: 24, backgroundColor: C.tertiary, borderWidth: 2, borderColor: C.onBackground },
    elevBlockEmpty: { width: 16, height: 24, backgroundColor: C.surfaceContainerHighest, borderWidth: 2, borderColor: C.onBackground },
    ctaBtn: {
        backgroundColor: C.goldAmber, borderRadius: 8, borderWidth: 4, borderColor: C.onBackground,
        paddingVertical: 16, paddingHorizontal: 24, alignItems: 'center', marginTop: 16, width: '100%',
    },
    ctaText: { fontSize: 24, fontWeight: '700', color: C.onBackground, textTransform: 'uppercase' },
    shadow: { shadowColor: C.onBackground, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 8 },
    };
});

interface RideSummaryScreenProps {
    distance?: number;
    time?: string;
    elevation?: number;
    rank?: string;
    onShare?: () => void;
    onBackToHub?: () => void;
}

export const RideSummaryScreen: React.FC<RideSummaryScreenProps> = ({
    distance = 54.2,
    time = '2h 15m',
    elevation = 850,
    rank = 'S',
    onShare,
    onBackToHub,
}) => {
    const { theme } = useUnistyles(); const s = stylesheet;
    const C = theme.colors as any;

    return (
    <SafeAreaView style={s.container} edges={['top']}>
        <View style={[s.header, s.shadow]}>
            <View style={{ width: 40 }} />
            <Text style={s.headerTitle}>CYCLO-QUEST</Text>
            <View style={{ width: 40 }} />
        </View>
        <ScrollView style={s.scroll} contentContainerStyle={s.content}>
            <View style={s.titleSection}>
                <Text style={s.title}>RIDE COMPLETE</Text>
                <Text style={s.subtitle}>Quest objectives achieved.</Text>
            </View>
            <View style={s.badge}>
                <View style={s.badgeRing} />
                <Text style={s.badgeEmoji}>🏆</Text>
            </View>
            <View style={[s.rankContainer, s.shadow]}>
                <Text style={s.rankLabel}>Rank</Text>
                <Text style={s.rankLetter}>{rank}</Text>
                <Text style={s.rankName}>Legendary</Text>
            </View>
            <View style={s.statsGrid}>
                <View style={[s.statTile, s.shadow]}>
                    <Text style={s.statLabel}>Distance</Text>
                    <Text style={s.statValue}>{distance}<Text style={s.statUnit}> km</Text></Text>
                </View>
                <View style={[s.statTile, s.shadow]}>
                    <Text style={s.statLabel}>Time</Text>
                    <Text style={s.statValue}>{time}</Text>
                </View>
                <View style={[s.statTile, { flexBasis: '100%' }, s.shadow]}>
                    <Text style={s.statLabel}>Elevation Gain</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
                        <Text style={[s.statValue, { marginTop: 0 }]}>{elevation}m</Text>
                        <View style={s.elevationBar}>
                            <View style={s.elevBlockFilled} />
                            <View style={s.elevBlockFilled} />
                            <View style={s.elevBlockFilled} />
                            <View style={s.elevBlockEmpty} />
                            <View style={s.elevBlockEmpty} />
                        </View>
                    </View>
                </View>
            </View>
            <Pressable
                style={({ pressed }) => [s.ctaBtn, s.shadow, pressed && { transform: [{ translateY: 2 }], shadowOpacity: 0.3 }]}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
                    onShare?.();
                }}
            >
                <Text style={s.ctaText}>SHARE RESULT</Text>
            </Pressable>
            <Pressable
                style={({ pressed }) => [s.ctaBtn, s.shadow, pressed && { transform: [{ translateY: 2 }], shadowOpacity: 0.3 }]}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => { });
                    onBackToHub?.();
                }}
            >
                <Text style={s.ctaText}>BACK TO HUB</Text>
            </Pressable>
            <View style={{ height: 80 }} />
        </ScrollView>
    </SafeAreaView>
    );
};
