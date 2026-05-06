/**
 * ActivityDetailScreen — STITCH Phase 1 (P0)
 * 
 * Post-ride deep-dive analysis. Shows header info, stats bento,
 * interactive route map, achievements carousel, performance charts,
 * Share + Download FIT actions.
 */

import React from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const C = {
    background: '#f8faf0', parchment: '#F5F5DC', onBackground: '#191d17',
    primary: '#3b6a24', primaryContainer: '#76a95b', primaryFixed: '#bbf29b',
    secondary: '#5e604d', tertiary: '#a13d3e', outline: '#72796b',
    surfaceContainer: '#edefe5', surfaceVariant: '#e1e3da', onPrimary: '#ffffff',
    gold: '#FFD700',
};
const sh = { shadowColor: C.onBackground, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 8 };
const shSm = { shadowColor: C.onBackground, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 };

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.background,
        borderBottomWidth: 4, borderBottomColor: C.onBackground,
    },
    hdrBack: { fontSize: 28, color: C.primary },
    hdrTitle: { fontSize: 18, fontWeight: '700', color: C.primary, textTransform: 'uppercase' },
    scroll: { flex: 1 },
    content: { padding: 16, gap: 16 },
    // Info card
    infoCard: { backgroundColor: C.surfaceContainer, borderWidth: 4, borderColor: C.onBackground, borderRadius: 8, padding: 16 },
    infoDate: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    infoDateText: { fontSize: 10, fontWeight: '700', color: C.secondary, textTransform: 'uppercase', letterSpacing: 1 },
    infoTitle: { fontSize: 28, fontWeight: '700', color: C.onBackground },
    infoStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
    statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
    statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    // Stats bento
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    statTile: {
        backgroundColor: C.parchment, borderWidth: 2, borderColor: C.onBackground,
        borderRadius: 4, padding: 12, flex: 1, minWidth: '45%',
    },
    statLabel: { fontSize: 10, fontWeight: '700', color: C.secondary, textTransform: 'uppercase' },
    statValue: { fontSize: 24, fontWeight: '700', color: C.onBackground, marginTop: 8, textAlign: 'right' },
    statUnit: { fontSize: 14, color: C.outline },
    // Map
    mapSection: { backgroundColor: C.surfaceVariant, borderWidth: 4, borderColor: C.onBackground, borderRadius: 8, overflow: 'hidden' },
    mapHeader: { backgroundColor: C.surfaceContainer, padding: 10, borderBottomWidth: 2, borderBottomColor: C.onBackground },
    mapHeaderText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: C.onBackground },
    mapArea: { height: 250, backgroundColor: C.primaryContainer, justifyContent: 'center', alignItems: 'center' },
    mapPlaceholder: { fontSize: 40 },
    // Achievements
    achSection: { flexDirection: 'row', gap: 8 },
    achCard: {
        backgroundColor: C.surfaceContainer, borderWidth: 2, borderColor: C.onBackground,
        borderRadius: 8, padding: 12, minWidth: 180,
    },
    achIcon: { width: 40, height: 40, borderRadius: 8, borderWidth: 2, borderColor: C.onBackground, justifyContent: 'center', alignItems: 'center' },
    achTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 4 },
    achName: { fontSize: 16, fontWeight: '700', marginTop: 2 },
    // Chart
    chartCard: { backgroundColor: C.parchment, borderWidth: 4, borderColor: C.onBackground, borderRadius: 8, padding: 16 },
    chartHeader: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 2, paddingBottom: 8, marginBottom: 12 },
    chartLegend: { flexDirection: 'row', gap: 12 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 8, height: 8, borderWidth: 1, borderColor: C.onBackground },
    legendText: { fontSize: 10, color: C.secondary },
    chartArea: { height: 180, justifyContent: 'center', alignItems: 'center' },
    // Actions
    actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
    actionBtn: {
        flex: 1, paddingVertical: 16, borderRadius: 8, borderWidth: 4, borderColor: C.onBackground,
        alignItems: 'center', justifyContent: 'center', gap: 4,
    },
    actionText: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase' },
});

interface ActivityDetailScreenProps {
    title?: string;
    date?: string;
    distance?: number;
    time?: string;
    elevation?: number;
    avgSpeed?: number;
    onBack?: () => void;
    onShare?: () => void;
    onDownload?: () => void;
}

export const ActivityDetailScreen: React.FC<ActivityDetailScreenProps> = ({
    title = 'MOUNTAIN PASS RIDE',
    date = 'Oct 24, 2023 • 08:30 AM',
    distance = 42.5,
    time = '1:45:22',
    elevation = 850,
    avgSpeed = 24.2,
    onBack, onShare, onDownload,
}) => (
    <SafeAreaView style={s.container} edges={['top']}>
        <View style={[s.header, sh]}>
            <Pressable onPress={onBack}>
                <Text style={s.hdrBack}>←</Text>
            </Pressable>
            <Text style={s.hdrTitle}>VELO QUEST</Text>
            <View style={{ width: 40 }} />
        </View>
        <ScrollView style={s.scroll} contentContainerStyle={s.content}>
            {/* Info Card */}
            <View style={[s.infoCard, sh]}>
                <View style={s.infoDate}>
                    <Text style={{ fontSize: 16 }}>📅</Text>
                    <Text style={s.infoDateText}>{date}</Text>
                </View>
                <Text style={s.infoTitle}>{title}</Text>
                <View style={s.infoStatus}>
                    <View style={s.statusDot} />
                    <Text style={[s.statusText, { color: C.primary }]}>Completed</Text>
                </View>
            </View>

            {/* Stats Bento */}
            <View style={s.statsGrid}>
                {[
                    { label: 'Distance', value: `${distance}`, unit: 'km' },
                    { label: 'Time', value: time, unit: '' },
                    { label: 'Elevation', value: `+${elevation}`, unit: 'm' },
                    { label: 'Avg Speed', value: `${avgSpeed}`, unit: 'km/h' },
                ].map((st, i) => (
                    <View key={i} style={[s.statTile, shSm]}>
                        <Text style={s.statLabel}>{st.label}</Text>
                        <Text style={s.statValue}>{st.value}<Text style={s.statUnit}> {st.unit}</Text></Text>
                    </View>
                ))}
            </View>

            {/* Route Map */}
            <View style={[s.mapSection, sh]}>
                <View style={s.mapHeader}>
                    <Text style={s.mapHeaderText}>🗺️  Route</Text>
                </View>
                <View style={s.mapArea}>
                    <Text style={s.mapPlaceholder}>🗺️</Text>
                    <Text style={{ fontSize: 12, color: C.onBackground, opacity: 0.5, marginTop: 8 }}>
                        MapLibre Route View
                    </Text>
                </View>
            </View>

            {/* Achievements Carousel */}
            <View>
                <Text style={[s.statLabel, { marginBottom: 8, paddingLeft: 4, borderLeftWidth: 4, borderLeftColor: C.primary }]}>Achievements</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.achSection}>
                    <View style={[s.achCard, shSm]}>
                        <View style={[s.achIcon, { backgroundColor: C.gold }]}>
                            <Text style={{ fontSize: 20 }}>🏆</Text>
                        </View>
                        <Text style={[s.achTitle, { color: C.secondary }]}>Segment KOM</Text>
                        <Text style={[s.achName, { color: C.onBackground }]}>Pine Climb</Text>
                    </View>
                    <View style={[s.achCard, shSm]}>
                        <View style={[s.achIcon, { backgroundColor: C.primaryFixed }]}>
                            <Text style={{ fontSize: 20 }}>⭐</Text>
                        </View>
                        <Text style={[s.achTitle, { color: C.secondary }]}>New PR</Text>
                        <Text style={[s.achName, { color: C.onBackground }]}>Valley Sprint</Text>
                    </View>
                </ScrollView>
            </View>

            {/* Performance Chart */}
            <View style={[s.chartCard, sh]}>
                <View style={s.chartHeader}>
                    <Text style={[s.statLabel, { color: C.onBackground }]}>Performance</Text>
                    <View style={s.chartLegend}>
                        <View style={s.legendItem}>
                            <View style={[s.legendDot, { backgroundColor: C.secondary }]} />
                            <Text style={s.legendText}>Elev</Text>
                        </View>
                        <View style={s.legendItem}>
                            <View style={[s.legendDot, { backgroundColor: C.tertiary }]} />
                            <Text style={s.legendText}>HR</Text>
                        </View>
                    </View>
                </View>
                <View style={s.chartArea}>
                    <Text style={{ fontSize: 12, color: C.outline }}>
                        Elevation / HR Chart Placeholder
                    </Text>
                </View>
            </View>

            {/* Action Buttons */}
            <View style={s.actions}>
                <Pressable
                    style={({ pressed }) => [s.actionBtn, { backgroundColor: C.primary }, sh, pressed && { transform: [{ translateY: 2 }] }]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { }); onShare?.(); }}
                >
                    <Text style={[s.actionText, { color: C.onPrimary }]}>📤  SHARE RIDE</Text>
                </Pressable>
                <Pressable
                    style={({ pressed }) => [s.actionBtn, { backgroundColor: C.surfaceVariant }, sh, pressed && { transform: [{ translateY: 2 }] }]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { }); onDownload?.(); }}
                >
                    <Text style={[s.actionText, { color: C.onBackground }]}>⬇️  DOWNLOAD FIT</Text>
                </Pressable>
            </View>

            <View style={{ height: 80 }} />
        </ScrollView>
    </SafeAreaView>
);
