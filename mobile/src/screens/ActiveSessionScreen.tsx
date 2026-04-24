/**
 * Active Session Screen — SPORT Mobile App
 * ==========================================
 * Constitution §3: UX Manifesto — Active Session View
 * Constitution §9.1: Optimistic UI + Local-First approach
 *
 * Shows real-time stats during a GPS session:
 * - Live distance, pace, duration
 * - Start / Stop controls
 * - Pending GPS points indicator
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Animated,
} from 'react-native';
import { GpsSyncManager } from '../services/GpsSyncManager';
import { api } from '../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActivityType = 'RUN' | 'BIKE' | 'WALK' | 'WHEELCHAIR';

interface SessionState {
  activityId: number | null;
  isRunning: boolean;
  distanceM: number;
  durationSec: number;
  pendingPoints: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatDuration = (sec: number): string => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatPace = (distanceM: number, durationSec: number): string => {
  if (distanceM < 10 || durationSec < 1) return '--:--';
  const paceSecPerKm = (durationSec / (distanceM / 1000));
  const m = Math.floor(paceSecPerKm / 60);
  const s = Math.round(paceSecPerKm % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const ACTIVITY_ICONS: Record<ActivityType, string> = {
  RUN: '🏃',
  BIKE: '🚴',
  WALK: '🚶',
  WHEELCHAIR: '♿',
};

// ---------------------------------------------------------------------------
// Screen component
// ---------------------------------------------------------------------------

export const ActiveSessionScreen: React.FC = () => {
  const [session, setSession] = useState<SessionState>({
    activityId: null,
    isRunning: false,
    distanceM: 0,
    durationSec: 0,
    pendingPoints: 0,
  });
  const [activityType, setActivityType] = useState<ActivityType>('RUN');
  const [error, setError] = useState<string | null>(null);

  const syncManagerRef = useRef<GpsSyncManager | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulsing animation for live indicator
  useEffect(() => {
    if (!session.isRunning) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [session.isRunning, pulseAnim]);

  // Duration ticker
  useEffect(() => {
    if (session.isRunning) {
      timerRef.current = setInterval(() => {
        setSession(prev => ({
          ...prev,
          durationSec: prev.durationSec + 1,
          pendingPoints: syncManagerRef.current?.getPendingCount() ?? 0,
        }));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [session.isRunning]);

  const handleStart = async () => {
    setError(null);
    try {
      // Optimistic UI — show running immediately (Constitution §9.1)
      setSession(prev => ({ ...prev, isRunning: true, durationSec: 0, distanceM: 0 }));

      const activity = await api.createActivity(activityType);
      const manager = new GpsSyncManager('device_local', null);
      manager.setUpdateCallback(({ distanceM }) => {
        setSession(prev => ({ ...prev, distanceM }));
      });
      syncManagerRef.current = manager;
      await manager.startTracking(activity.id);

      setSession(prev => ({ ...prev, activityId: activity.id }));
    } catch (err) {
      setError('Nie można rozpocząć sesji. Sprawdź połączenie.');
      setSession(prev => ({ ...prev, isRunning: false }));
    }
  };

  const handleStop = async () => {
    try {
      if (syncManagerRef.current) {
        await syncManagerRef.current.stopTracking();
      }
      if (session.activityId) {
        await api.finishActivity(session.activityId, session.distanceM);
      }
    } catch { /* fail silently — data is buffered locally */ }
    setSession(prev => ({ ...prev, isRunning: false, activityId: null }));
  };

  const pace = formatPace(session.distanceM, session.durationSec);
  const speedKmh = session.durationSec > 0
    ? ((session.distanceM / session.durationSec) * 3.6).toFixed(1)
    : '0.0';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0e1a" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Aktywna Sesja</Text>
        {session.isRunning && (
          <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseAnim }] }]} />
        )}
      </View>

      {/* Activity type selector (only when not running) */}
      {!session.isRunning && (
        <View style={styles.typeSelector}>
          {(Object.keys(ACTIVITY_ICONS) as ActivityType[]).map(type => (
            <TouchableOpacity
              key={type}
              style={[styles.typeButton, activityType === type && styles.typeButtonActive]}
              onPress={() => setActivityType(type)}
              accessibilityLabel={`Aktywność: ${type}`}
            >
              <Text style={styles.typeIcon}>{ACTIVITY_ICONS[type]}</Text>
              <Text style={[styles.typeLabel, activityType === type && styles.typeLabelActive]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <StatCard label="Dystans" value={`${(session.distanceM / 1000).toFixed(2)}`} unit="km" color="#00d2ff" />
        <StatCard label="Czas" value={formatDuration(session.durationSec)} unit="" color="#92fe9d" />
        <StatCard label="Tempo" value={pace} unit="min/km" color="#ff9500" />
        <StatCard label="Prędkość" value={speedKmh} unit="km/h" color="#c77dff" />
      </View>

      {/* Pending points (offline sync status) */}
      {session.isRunning && session.pendingPoints > 0 && (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingText}>
            📶 {session.pendingPoints} punktów w buforze
          </Text>
        </View>
      )}

      {/* Error */}
      {error && <Text style={styles.error}>{error}</Text>}

      {/* CTA button */}
      <TouchableOpacity
        style={[styles.ctaButton, session.isRunning && styles.ctaButtonStop]}
        onPress={session.isRunning ? handleStop : handleStart}
        accessibilityLabel={session.isRunning ? 'Zatrzymaj sesję' : 'Rozpocznij sesję'}
      >
        <Text style={styles.ctaText}>
          {session.isRunning ? '⏹ STOP' : '▶ START'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: string;
  unit: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, unit, color }) => (
  <View style={[styles.statCard, { borderColor: `${color}40` }]}>
    <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
  </View>
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: '#0a0e1a', paddingHorizontal: 20, paddingTop: 20 },
  header:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  headerTitle:       { fontSize: 22, fontWeight: '800', color: '#fff' },
  liveDot:           { width: 12, height: 12, borderRadius: 6, backgroundColor: '#92fe9d' },
  typeSelector:      { flexDirection: 'row', gap: 10, marginBottom: 24 },
  typeButton:        { flex: 1, alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#1e2a3a', backgroundColor: '#111827' },
  typeButtonActive:  { borderColor: '#00d2ff', backgroundColor: 'rgba(0,210,255,0.1)' },
  typeIcon:          { fontSize: 24, marginBottom: 4 },
  typeLabel:         { fontSize: 11, color: '#5a6a7a', fontWeight: '600' },
  typeLabelActive:   { color: '#00d2ff' },
  statsGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  statCard:          { flex: 1, minWidth: '45%', backgroundColor: '#111827', borderRadius: 16, padding: 20, borderWidth: 1, alignItems: 'center' },
  statLabel:         { fontSize: 10, color: '#5a6a7a', fontWeight: '700', marginBottom: 8, letterSpacing: 1 },
  statValue:         { fontSize: 32, fontWeight: '900' },
  statUnit:          { fontSize: 12, color: '#5a6a7a', marginTop: 4 },
  pendingBadge:      { backgroundColor: 'rgba(255,149,0,0.15)', borderRadius: 8, padding: 10, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,149,0,0.3)' },
  pendingText:       { color: '#ff9500', fontSize: 13, textAlign: 'center' },
  error:             { color: '#ff4d4d', textAlign: 'center', marginBottom: 16, fontSize: 13 },
  ctaButton:         { backgroundColor: '#00d2ff', borderRadius: 20, paddingVertical: 20, alignItems: 'center', marginTop: 'auto', marginBottom: 24 },
  ctaButtonStop:     { backgroundColor: '#ff4d4d' },
  ctaText:           { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: 2 },
});
