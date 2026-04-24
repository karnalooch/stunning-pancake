/**
 * History Screen — SPORT Mobile App
 * ====================================
 * Milestone 2: List of past activities with verification badge
 * Constitution §9.1: TanStack Query with offline stale-time
 */

import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api, type Activity } from '../services/api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_ICONS: Record<string, string> = {
  RUN:         '🏃',
  BIKE:        '🚴',
  WALK:        '🚶',
  WHEELCHAIR:  '♿',
};

const formatDistance = (m: number) =>
  m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(0)} m`;

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pl', { day: 'numeric', month: 'short', year: 'numeric' });

// ---------------------------------------------------------------------------
// Activity card
// ---------------------------------------------------------------------------

interface ActivityCardProps {
  activity: Activity;
}

const ActivityCard: React.FC<ActivityCardProps> = ({ activity }) => {
  const icon = TYPE_ICONS[activity.type] ?? '📍';
  const duration =
    activity.start_time && activity.end_time
      ? (new Date(activity.end_time).getTime() - new Date(activity.start_time).getTime()) / 1000
      : null;

  return (
    <TouchableOpacity style={styles.card} accessibilityLabel={`Aktywność: ${activity.type}`}>
      {/* Left column */}
      <View style={styles.iconCol}>
        <Text style={styles.icon}>{icon}</Text>
      </View>

      {/* Center column */}
      <View style={styles.infoCol}>
        <Text style={styles.activityType}>{activity.type}</Text>
        <Text style={styles.activityDate}>
          {activity.start_time ? formatDate(activity.start_time) : '—'}
        </Text>
        <View style={styles.statsRow}>
          <Text style={styles.statText}>📏 {formatDistance(activity.distance ?? 0)}</Text>
          {duration != null && (
            <Text style={styles.statText}>⏱ {formatDuration(duration)}</Text>
          )}
        </View>
      </View>

      {/* Verification badge */}
      <View style={[
        styles.badge,
        activity.is_verified ? styles.badgeVerified : styles.badgePending,
      ]}>
        <Text style={styles.badgeText}>
          {activity.is_verified ? '✓ OK' : '⏳'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export const HistoryScreen: React.FC = () => {
  const { data: activities = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['activities', 'history'],
    queryFn:  () => api.getMyActivities(),
    staleTime: 5 * 60 * 1000,  // 5 min
    retry: 2,
  });

  const totalKm = activities
    .filter(a => a.is_verified)
    .reduce((sum, a) => sum + (a.distance ?? 0) / 1000, 0);

  return (
    <View style={styles.container}>
      {/* Summary banner */}
      {activities.length > 0 && (
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{activities.length}</Text>
            <Text style={styles.summaryLabel}>AKTYWNOŚCI</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalKm.toFixed(1)}</Text>
            <Text style={styles.summaryLabel}>KM ZWERYFIKOWANE</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {activities.filter(a => a.is_verified).length}
            </Text>
            <Text style={styles.summaryLabel}>ZATWIERDZONO</Text>
          </View>
        </View>
      )}

      {/* Activity list */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#00d2ff" />
          <Text style={styles.loadingText}>Ładowanie historii…</Text>
        </View>
      ) : (
        <FlatList
          data={activities}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => <ActivityCard activity={item} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>Brak aktywności</Text>
              <Text style={styles.emptySub}>Rozpocznij pierwszą sesję GPS</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#00d2ff"
            />
          }
        />
      )}
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#0a0e1a' },
  summary:         { flexDirection: 'row', backgroundColor: '#111827', padding: 20, borderBottomWidth: 1, borderColor: '#1e2a3a', justifyContent: 'space-around' },
  summaryItem:     { alignItems: 'center', flex: 1 },
  summaryValue:    { fontSize: 22, fontWeight: '900', color: '#00d2ff' },
  summaryLabel:    { fontSize: 9, color: '#5a6a7a', fontWeight: '700', letterSpacing: 1, marginTop: 4 },
  summaryDivider:  { width: 1, backgroundColor: '#1e2a3a' },
  list:            { padding: 12, gap: 10 },
  card:            { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1e2a3a', gap: 12 },
  iconCol:         { width: 44, height: 44, borderRadius: 12, backgroundColor: '#0a0e1a', alignItems: 'center', justifyContent: 'center' },
  icon:            { fontSize: 22 },
  infoCol:         { flex: 1, gap: 4 },
  activityType:    { fontSize: 15, fontWeight: '800', color: '#fff' },
  activityDate:    { fontSize: 12, color: '#5a6a7a' },
  statsRow:        { flexDirection: 'row', gap: 12, marginTop: 2 },
  statText:        { fontSize: 12, color: '#8a9aaa' },
  badge:           { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  badgeVerified:   { backgroundColor: 'rgba(146,254,157,0.1)', borderColor: 'rgba(146,254,157,0.3)' },
  badgePending:    { backgroundColor: 'rgba(90,106,122,0.1)', borderColor: '#1e2a3a' },
  badgeText:       { fontSize: 11, fontWeight: '700', color: '#92fe9d' },
  centered:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  loadingText:     { color: '#5a6a7a', marginTop: 12 },
  emptyIcon:       { fontSize: 48 },
  emptyTitle:      { fontSize: 18, fontWeight: '700', color: '#fff' },
  emptySub:        { fontSize: 14, color: '#5a6a7a' },
});
