/**
 * ActivityDetailScreen — STITCH Phase 1 (P0)
 * 
 * Post-ride deep-dive analysis. Shows header info, stats bento,
 * interactive route map, achievements carousel, performance charts,
 * Share + Download FIT actions.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import * as Haptics from 'expo-haptics';
import { ActivityService } from '../services/api';
import { OfflineCacheService } from '../services/OfflineCacheService';
import type { ActivityItem } from '../services/api';
import { APP_BRAND_NAME } from '../theme/brand';
import { ChromeIcon } from '../components/ui/ChromeIcon';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonBlock } from '../components/ui/SkeletonBlock';
import { EdgeStateBanner } from '../components/ui/EdgeStateBanner';
import { useI18n } from '../i18n/useI18n';

const stylesheet = StyleSheet.create(theme => {
    const C = theme.colors as Record<string, string>;
    const sh = { shadowColor: C.onBackground, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 8 };
    const shSm = { shadowColor: C.onBackground, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 };
    return {
    sh,
    shSm,
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
    mapSection: { backgroundColor: C.surfaceContainerHighest, borderWidth: 4, borderColor: C.onBackground, borderRadius: 8, overflow: 'hidden' },
    mapHeader: { backgroundColor: C.surfaceContainer, padding: 10, borderBottomWidth: 2, borderBottomColor: C.onBackground },
    mapHeaderText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: C.onBackground },
    mapArea: { height: 250, backgroundColor: C.primaryContainer, justifyContent: 'center', alignItems: 'center' },
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
    };
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
    activityId?: number;
}

function formatActivityDate(value: string | undefined, localeTag: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(localeTag);
}

export const ActivityDetailScreen: React.FC<ActivityDetailScreenProps> = ({
    activityId,
    onBack, onShare, onDownload,
}) => {
    const { theme } = useUnistyles(); const s = stylesheet;
    const { t, locale } = useI18n();
    const C = theme.colors as Record<string, string>;
    const localeTag = locale === 'pl' ? 'pl-PL' : 'en-US';
    const [loading, setLoading] = useState(true);
    const [title, setTitle] = useState<string>(() => t.tabs.ride);
    const [date, setDate] = useState('—');
    const [distance, setDistance] = useState(0);
    const [time, setTime] = useState('—');
    const [elevation, setElevation] = useState(0);
    const [avgSpeed, setAvgSpeed] = useState(0);
    const [hasData, setHasData] = useState(false);
    const [offline, setOffline] = useState(false);

    const apply = useCallback((item: Pick<ActivityItem, 'type' | 'start_time' | 'distance' | 'duration'> & { elevation_gain?: number }) => {
        setTitle(item.type ?? t.tabs.ride);
        setDate(formatActivityDate(item.start_time, localeTag));
        setDistance((item.distance ?? 0) / 1000);
        setTime(item.duration ?? '—');
        setElevation(item.elevation_gain ?? 0);
        setAvgSpeed(0);
        setHasData(true);
    }, [localeTag, t.tabs.ride]);

    useEffect(() => {
        if (!activityId) {
            setLoading(false);
            setHasData(false);
            return;
        }
        setHasData(false);
        setOffline(false);
        const cached = OfflineCacheService.getHistory();
        const fromCache = cached?.find((a) => a.id === activityId);
        if (fromCache) {
            apply(fromCache);
            setOffline(true);
        }
        ActivityService.getHistory()
            .then((rows) => {
                const list = Array.isArray(rows) ? rows : [];
                OfflineCacheService.setHistory(list);
                const item = list.find((a) => a.id === activityId) ?? fromCache;
                if (item) {
                    apply(item);
                    setOffline(false);
                }
            })
            .catch(() => {
                setOffline(true);
            })
            .finally(() => setLoading(false));
    }, [activityId, apply]);

    if (!activityId) {
        return (
            <SafeAreaView style={s.container} edges={['top']}>
                <EmptyState message={t.training.empty} icon="training" />
            </SafeAreaView>
        );
    }

    if (loading) {
        return (
            <SafeAreaView style={s.container} edges={['top']}>
                <SkeletonBlock height={200} style={{ margin: 16 }} />
            </SafeAreaView>
        );
    }

    if (!hasData) {
        return (
            <SafeAreaView style={s.container} edges={['top']}>
                {offline ? (
                    <EdgeStateBanner
                        title={t.errors.network}
                        message={t.errors.offlineCache}
                        variant="offline"
                    />
                ) : null}
                <EmptyState
                    message={t.activityDetail.unavailable}
                    hint={t.activityDetail.loadingHint}
                    icon="training"
                />
            </SafeAreaView>
        );
    }

    return (
    <SafeAreaView style={s.container} edges={['top']}>
        {offline ? (
            <EdgeStateBanner
                title={t.errors.network}
                message={t.errors.offlineCache}
                variant="offline"
            />
        ) : null}
        <View style={[s.header, s.sh]}>
            <Pressable onPress={onBack}>
                <Text style={s.hdrBack}>←</Text>
            </Pressable>
            <Text style={s.hdrTitle}>{APP_BRAND_NAME}</Text>
            <View style={{ width: 40 }} />
        </View>
        <ScrollView style={s.scroll} contentContainerStyle={s.content}>
            {/* Info Card */}
            <View style={[s.infoCard, s.sh]}>
                <View style={s.infoDate}>
                    <ChromeIcon id="calendar" size={14} />
                    <Text style={s.infoDateText}>{date}</Text>
                </View>
                <Text style={s.infoTitle}>{title}</Text>
                <View style={s.infoStatus}>
                    <View style={s.statusDot} />
                    <Text style={[s.statusText, { color: C.primary }]}>{t.activityDetail.completed}</Text>
                </View>
            </View>

            {/* Stats Bento */}
            <View style={s.statsGrid}>
                {[
                    { label: t.activityDetail.stats.distance, value: `${distance.toFixed(2)}`, unit: t.activityDetail.stats.distanceUnit },
                    { label: t.activityDetail.stats.time, value: time, unit: '' },
                    { label: t.activityDetail.stats.elevation, value: `+${elevation}`, unit: t.activityDetail.stats.elevationUnit },
                    { label: t.activityDetail.stats.avgSpeed, value: `${avgSpeed}`, unit: t.activityDetail.stats.speedUnit },
                ].map((st, i) => (
                    <View key={i} style={[s.statTile, s.shSm]}>
                        <Text style={s.statLabel}>{st.label}</Text>
                        <Text style={s.statValue}>{st.value}<Text style={s.statUnit}> {st.unit}</Text></Text>
                    </View>
                ))}
            </View>

            {/* Route Map */}
            <View style={[s.mapSection, s.sh]}>
                <View style={s.mapHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <ChromeIcon id="map" size={14} />
                        <Text style={s.mapHeaderText}>{t.activityDetail.route}</Text>
                    </View>
                </View>
                <View style={s.mapArea}>
                    <ChromeIcon id="map" size={36} />
                    <Text style={{ fontSize: 12, color: C.onBackground, opacity: 0.5, marginTop: 8 }}>
                        {t.activityDetail.routePreview}
                    </Text>
                </View>
            </View>

            {/* Achievements Carousel */}
            <View>
                <Text style={[s.statLabel, { marginBottom: 8, paddingLeft: 4, borderLeftWidth: 4, borderLeftColor: C.primary }]}>
                    {t.activityDetail.achievements}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.achSection}>
                    <View style={[s.achCard, s.shSm]}>
                        <View style={[s.achIcon, { backgroundColor: C.goldAmber }]}>
                            <ChromeIcon id="segments" size={20} />
                        </View>
                        <Text style={[s.achTitle, { color: C.secondary }]}>{t.activityDetail.achievementKomTitle}</Text>
                        <Text style={[s.achName, { color: C.onBackground }]}>{t.activityDetail.achievementKomName}</Text>
                    </View>
                    <View style={[s.achCard, s.shSm]}>
                        <View style={[s.achIcon, { backgroundColor: C.primaryFixed }]}>
                            <ChromeIcon id="cityStar" size={20} />
                        </View>
                        <Text style={[s.achTitle, { color: C.secondary }]}>{t.activityDetail.achievementPrTitle}</Text>
                        <Text style={[s.achName, { color: C.onBackground }]}>{t.activityDetail.achievementPrName}</Text>
                    </View>
                </ScrollView>
            </View>

            {/* Performance Chart */}
            <View style={[s.chartCard, s.sh]}>
                <View style={s.chartHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <ChromeIcon id="performance" size={14} />
                        <Text style={[s.statLabel, { color: C.onBackground }]}>{t.activityDetail.performance}</Text>
                    </View>
                    <View style={s.chartLegend}>
                        <View style={s.legendItem}>
                            <View style={[s.legendDot, { backgroundColor: C.secondary }]} />
                            <Text style={s.legendText}>{t.activityDetail.elevLegend}</Text>
                        </View>
                        <View style={s.legendItem}>
                            <View style={[s.legendDot, { backgroundColor: C.tertiary }]} />
                            <Text style={s.legendText}>{t.activityDetail.hrLegend}</Text>
                        </View>
                    </View>
                </View>
                <View style={s.chartArea}>
                    <Text style={{ fontSize: 12, color: C.outline }}>
                        {t.activityDetail.chartPending}
                    </Text>
                </View>
            </View>

            {/* Action Buttons */}
            <View style={s.actions}>
                <Pressable
                    style={({ pressed }) => [s.actionBtn, { backgroundColor: C.primary }, s.sh, pressed && { transform: [{ translateY: 2 }] }]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { }); onShare?.(); }}
                >
                    <ChromeIcon id="share" size={16} />
                    <Text style={[s.actionText, { color: C.onPrimary }]}>{t.activityDetail.shareRide}</Text>
                </Pressable>
                <Pressable
                    style={({ pressed }) => [s.actionBtn, { backgroundColor: C.surfaceContainerHighest }, s.sh, pressed && { transform: [{ translateY: 2 }] }]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { }); onDownload?.(); }}
                >
                    <ChromeIcon id="download" size={16} />
                    <Text style={[s.actionText, { color: C.onBackground }]}>{t.activityDetail.downloadFit}</Text>
                </Pressable>
            </View>

            <View style={{ height: 80 }} />
        </ScrollView>
    </SafeAreaView>
    );
};
