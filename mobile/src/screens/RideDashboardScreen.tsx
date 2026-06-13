/**
 * RideDashboardScreen — STITCH Phase 1 (P0)
 * 
 * Pre-ride landing screen. Shows live metrics if recording,
 * or a START RIDE CTA when idle. Part of the RIDE tab.
 * 
 * Design: Solar White + Forest Green palette, parchment cards,
 * pixel-border pixel-shadow retro aesthetic.
 */

import React, { useCallback, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    Pressable,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { observer } from '@legendapp/state/react';
import * as Haptics from 'expo-haptics';

import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { stitchTheme } from '../theme/stitch';
import { ArcadeButton } from '../components/ArcadeButton';
import { GpsRecoveryBanner } from '../components/GpsRecoveryBanner';
import { PlatformNoticeBanner } from '../components/PlatformNoticeBanner';
import { usePlatformNotices } from '../hooks/usePlatformNotices';
import type { ActivitySportType } from '../services/api';
import { ACTIVITY_SPORT_OPTIONS } from '../types/activitySport';
import { useImmersiveTheme } from '../hooks/useImmersiveTheme';
import { useGameProgress } from '../hooks/useGameProgress';
import { SceneBackground } from '../components/scene/SceneBackground';
import { LevelXpBar } from '../components/game/LevelXpBar';
import { StreakBadge } from '../components/game/StreakBadge';
import { DailyQuestCard } from '../components/game/DailyQuestCard';
import { CyclistSprite } from '../components/sprites/CyclistSprite';

// ─── Styles ────────────────────────────────────────────────────────

const stylesheet = StyleSheet.create(theme => {
    const C = theme.colors as any;
    return {
    container: {
        flex: 1,
        backgroundColor: C.background,
        position: 'relative',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: C.surface,
        borderBottomWidth: 4,
        borderBottomColor: C.onBackground,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 4,
        borderColor: C.onBackground,
        backgroundColor: C.primaryContainer,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: C.primary,
        textTransform: 'uppercase',
        letterSpacing: -0.5,
    },
    settingsBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: C.onBackground,
        borderRadius: 4,
        backgroundColor: C.surface,
    },
    settingsText: {
        fontSize: 20,
        fontWeight: '700',
        color: C.primary,
    },
    sportRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
        flexWrap: 'wrap',
    },
    sportChip: {
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderWidth: 3,
        borderColor: C.onBackground,
        borderRadius: 6,
        backgroundColor: C.surface,
    },
    sportChipActive: {
        backgroundColor: C.primaryContainer,
    },
    sportChipText: {
        fontSize: 11,
        fontWeight: '700',
        color: C.onBackground,
        textTransform: 'uppercase',
    },
    scroll: {
        flex: 1,
    },
    content: {
        padding: 16,
        gap: 16,
    },
    // ── Hero Card ──
    heroCard: {
        backgroundColor: C.parchment,
        borderWidth: 4,
        borderColor: C.onBackground,
        borderRadius: 8,
        padding: 16,
    },
    heroTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    heroGreeting: {
        fontSize: 14,
        fontWeight: '700',
        color: C.secondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    heroName: {
        fontSize: 32,
        fontWeight: '700',
        color: C.onBackground,
    },
    lvlBadge: {
        backgroundColor: C.primaryContainer,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderWidth: 2,
        borderColor: C.onBackground,
        borderRadius: 4,
    },
    lvlText: {
        fontSize: 14,
        fontWeight: '700',
        color: C.onBackground,
    },
    heroStats: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    heroStatTile: {
        flex: 1,
        backgroundColor: C.surfaceContainerLow,
        borderWidth: 2,
        borderColor: C.onBackground,
        borderRadius: 4,
        padding: 10,
        alignItems: 'center',
    },
    heroStatLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: C.secondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    heroStatValue: {
        fontSize: 20,
        fontWeight: '700',
        color: C.primary,
        marginTop: 4,
    },
    // ── Section ──
    section: {
        gap: 8,
    },
    sectionHeader: {
        fontSize: 18,
        fontWeight: '700',
        color: C.onBackground,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    // ── Metric Tiles Grid ──
    metricGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
    },
    metricTile: {
        width: '48%',
        flexGrow: 1,
        flexBasis: '48%',
        backgroundColor: C.parchment,
        borderWidth: 2,
        borderColor: C.onBackground,
        borderRadius: 4,
        padding: 12,
    },
    metricLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: C.secondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    metricValue: {
        fontSize: 24,
        fontWeight: '700',
        color: C.onBackground,
        marginTop: 8,
    },
    metricUnit: {
        fontSize: 14,
        fontWeight: '500',
        color: C.outline,
    },
    // ── Weekly Load ──
    weeklyCard: {
        backgroundColor: C.parchment,
        borderWidth: 4,
        borderColor: C.onBackground,
        borderRadius: 8,
        padding: 16,
        gap: 12,
    },
    chartContainer: {
        height: 40,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 4,
    },
    chartBar: {
        flex: 1,
        borderWidth: 1,
        borderColor: C.onBackground,
        borderTopLeftRadius: 2,
        borderTopRightRadius: 2,
    },
    chartLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 2,
    },
    chartLabel: {
        fontSize: 8,
        fontWeight: '700',
        color: C.secondary,
        textTransform: 'uppercase',
    },
    // ── CTA ──
    ctaContainer: {
        paddingBottom: 24,
    },
    // ── Helper: Pixel Shadow ──
    pixelShadow: {
    shadowColor: C.onBackground,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
},
    };
});

// ─── Helper: Pixel Shadow ──────────────────────────────────────────

// ─── Constants ─────────────────────────────────────────────────────

const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// ─── Component ─────────────────────────────────────────────────────

interface RideDashboardScreenProps {
    user: { username: string; tenant_name?: string; tenant_id?: string } | null;
    onStartRide?: (sport: ActivitySportType) => void;
    onGoToRide?: () => void;
    isRecording?: boolean;
    liveSpeed?: number;
    liveDistance?: number;
    gpsRecoveryVisible?: boolean;
    gpsRecoveryBusy?: boolean;
    onGpsRecoveryPress?: () => void;
    onOpenGpsWizard?: () => void;
}

export const RideDashboardScreen: React.FC<RideDashboardScreenProps> = observer(({
    user,
    onStartRide,
    onGoToRide,
    isRecording = false,
    liveSpeed = 0,
    liveDistance = 0,
    gpsRecoveryVisible = false,
    gpsRecoveryBusy = false,
    onGpsRecoveryPress,
    onOpenGpsWizard,
}) => {
    const { theme } = useUnistyles(); const s = stylesheet;
    const C = theme.colors as any;
    const [selectedSport, setSelectedSport] = useState<ActivitySportType>('BIKE');
    const { notice, dismiss } = usePlatformNotices(
        (user as { tenant_id?: string } | null)?.tenant_id ?? null,
    );
    const { enabled: immersiveEnabled } = useImmersiveTheme();
    const { level, xpBar, progression, quests, onStartRide: trackQuestStart } = useGameProgress();

    const handleStartRide = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => { });
        trackQuestStart();
        onStartRide?.(selectedSport);
    }, [onStartRide, selectedSport, trackQuestStart]);

    const handleGoToRide = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
        onGoToRide?.();
    }, [onGoToRide]);

    // ── Generate random weekly data for demo ──
    const weeklyBars = React.useMemo(() => {
        return WEEK_DAYS.map(() => Math.random() * 0.8 + 0.1);
    }, []);

    // ── Render ──
    return (
        <SafeAreaView style={s.container} edges={['top']}>
            {immersiveEnabled && (
                <SceneBackground sceneId="ride_dashboard" scrim="soft" />
            )}
            {/* TopAppBar */}
            <View style={[s.header, s.pixelShadow]}>
                <View style={s.headerLeft}>
                    <View style={s.avatar}>
                        <Image
                            source={{ uri: 'https://lh3.googleusercontent.com/aida/ADBb0ujmdfGNwYeO4AQIm-niVeNKJgNFdyNxgN1CvOCgS0e7FogSfaY3bz5lokN38hc2XkJbYMtNB4hr4myidBg7bvfLvAy5Uy0sVhprjb9mCxYLLFBz8qCLSpjYFyO4PUqJSbAruccML_A_mvRnKT48RhKsQqvpUgG1kS2eP_0G1YLjPD2fEWZ-vrrhnVeTIwN18yjG4Hq2vW4dWX60x-Tey3XdzpD71eCI8SXG1YVfWWb1V5KRIYra3gYl2RuX0NFd8jgOCf9sfURndw' }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                        />
                    </View>
                    <Text style={s.headerTitle}>VELO QUEST</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Pressable
                        style={({ pressed: p }) => [
                            s.settingsBtn,
                            p && { transform: [{ translateY: 2 }], opacity: 0.8 },
                        ]}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                        }}
                        accessibilityLabel="Settings"
                    >
                        <Text style={s.settingsText}>⚙️</Text>
                    </Pressable>
                    <StreakBadge days={progression.streakDays} />
                </View>
            </View>

            {/* Content */}
            <ScrollView style={s.scroll} contentContainerStyle={s.content}>
                <PlatformNoticeBanner notice={notice} onDismiss={dismiss} />
                <GpsRecoveryBanner
                    visible={gpsRecoveryVisible}
                    busy={gpsRecoveryBusy}
                    onPress={() => onGpsRecoveryPress?.()}
                />
                <View style={{ marginTop: -4 }}>
                    <ArcadeButton
                        variant="ghost"
                        label="GPS CHECK WIZARD"
                        onPress={() => onOpenGpsWizard?.()}
                        size="md"
                    />
                </View>
                {/* Hero Card — Active Ride or Idle */}
                <View style={[s.heroCard, s.pixelShadow]}>
                    {isRecording ? (
                        <>
                            <Text style={s.heroGreeting}>CURRENT RIDE</Text>
                            <Text style={[s.heroName, { fontSize: 28 }]}>In Progress</Text>
                            <View style={s.heroStats}>
                                <View style={s.heroStatTile}>
                                    <Text style={s.heroStatLabel}>Speed</Text>
                                    <Text style={s.heroStatValue}>{liveSpeed.toFixed(1)}<Text style={s.metricUnit}> km/h</Text></Text>
                                </View>
                                <View style={s.heroStatTile}>
                                    <Text style={s.heroStatLabel}>Distance</Text>
                                    <Text style={s.heroStatValue}>{liveDistance.toFixed(1)}<Text style={s.metricUnit}> km</Text></Text>
                                </View>
                            </View>
                            <View style={{ marginTop: 16 }}>
                                <ArcadeButton
                                    variant="primary"
                                    label="GO TO RIDE"
                                    onPress={handleGoToRide}
                                    size="lg"
                                />
                            </View>
                        </>
                    ) : (
                        <>
                            <View style={s.heroTop}>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.heroGreeting}>Ready to ride?</Text>
                                    <Text style={s.heroName}>{user?.username ?? 'RIDER_01'}</Text>
                                </View>
                                {immersiveEnabled && (
                                    <CyclistSprite size={48} state="idle" />
                                )}
                                <LevelXpBar
                                    level={level}
                                    xpCurrent={xpBar.current}
                                    xpMax={xpBar.max}
                                    pct={xpBar.pct}
                                />
                            </View>
                            <View style={s.sportRow}>
                                {ACTIVITY_SPORT_OPTIONS.map((opt) => (
                                    <Pressable
                                        key={opt.type}
                                        style={[
                                            s.sportChip,
                                            selectedSport === opt.type && s.sportChipActive,
                                        ]}
                                        onPress={() => setSelectedSport(opt.type)}
                                    >
                                        <Text style={s.sportChipText}>{opt.labelPl}</Text>
                                    </Pressable>
                                ))}
                            </View>
                            <View style={{ marginTop: 8 }}>
                                <ArcadeButton
                                    variant="primary"
                                    label="START RIDE"
                                    onPress={handleStartRide}
                                    size="lg"
                                />
                            </View>
                        </>
                    )}
                </View>

                {!isRecording && (
                    <View style={s.section}>
                        <DailyQuestCard quests={quests.quests} />
                    </View>
                )}

                {/* Metric Tiles Grid */}
                <View style={s.section}>
                    <Text style={s.sectionHeader}>Last Ride Stats</Text>
                    <View style={s.metricGrid}>
                        <View style={[s.metricTile, s.pixelShadow]}>
                            <Text style={s.metricLabel}>Power</Text>
                            <Text style={s.metricValue}>285<Text style={s.metricUnit}> W</Text></Text>
                        </View>
                        <View style={[s.metricTile, s.pixelShadow]}>
                            <Text style={s.metricLabel}>Heart Rate</Text>
                            <Text style={s.metricValue}>155<Text style={s.metricUnit}> bpm</Text></Text>
                        </View>
                        <View style={[s.metricTile, s.pixelShadow]}>
                            <Text style={s.metricLabel}>Cadence</Text>
                            <Text style={s.metricValue}>82<Text style={s.metricUnit}> rpm</Text></Text>
                        </View>
                        <View style={[s.metricTile, s.pixelShadow]}>
                            <Text style={s.metricLabel}>Distance</Text>
                            <Text style={s.metricValue}>42.5<Text style={s.metricUnit}> km</Text></Text>
                        </View>
                    </View>
                </View>

                {/* Weekly Load */}
                <View style={[s.weeklyCard, s.pixelShadow]}>
                    <Text style={s.sectionHeader}>Weekly Load</Text>
                    <View style={s.chartContainer}>
                        {weeklyBars.map((h, i) => (
                            <View
                                key={i}
                                style={[
                                    s.chartBar,
                                    {
                                        height: `${h * 100}%`,
                                        backgroundColor: i === 3 ? C.primary : C.primaryFixed,
                                    },
                                ]}
                            />
                        ))}
                    </View>
                    <View style={s.chartLabels}>
                        {WEEK_DAYS.map((d, i) => (
                            <Text key={i} style={s.chartLabel}>{d}</Text>
                        ))}
                    </View>
                </View>

                {/* Bottom Spacing for Tab Bar */}
                <View style={{ height: 80 }} />
            </ScrollView>
        </SafeAreaView>
    );
});
