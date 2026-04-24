/**
 * Leaderboard Screen — SPORT Mobile App
 * =======================================
 * Constitution §21.2: Redis Leaderboards
 * Shows event leaderboard with rank medals and progress bar.
 */

import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api, type LeaderboardEntry } from '../services/api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const MAX_DISPLAY_KM = 500; // for normalizing progress bar width

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
}

const LeaderboardRow: React.FC<LeaderboardRowProps> = ({ entry, isCurrentUser }) => {
  const medal = MEDALS[entry.rank];
  const progress = Math.min((entry.total_km / MAX_DISPLAY_KM) * 100, 100);

  return (
    <View style={[styles.row, isCurrentUser && styles.rowHighlight]}>
      {/* Rank */}
      <View style={styles.rankCol}>
        {medal
          ? <Text style={styles.medal}>{medal}</Text>
          : <Text style={styles.rankNum}>#{entry.rank}</Text>}
      </View>

      {/* User info + progress bar */}
      <View style={styles.infoCol}>
        <View style={styles.rowHeader}>
          <Text style={[styles.username, isCurrentUser && styles.usernameHighlight]}>
            {entry.username}
            {isCurrentUser ? ' (Ty)' : ''}
          </Text>
          <Text style={styles.score}>{entry.total_km.toFixed(1)} km</Text>
        </View>
        {/* Progress bar */}
        <View style={styles.progressBg}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progress}%` as `${number}%`,
                backgroundColor: entry.rank <= 3 ? RANK_COLORS[entry.rank] ?? '#00d2ff' : '#00d2ff',
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
};

const RANK_COLORS: Record<number, string> = { 1: '#ffd700', 2: '#c0c0c0', 3: '#cd7f32' };

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

interface Props {
  eventId: number;
  currentUserId?: number;
}

export const LeaderboardScreen: React.FC<Props> = ({ eventId, currentUserId }) => {
  const { data: entries = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['leaderboard', eventId],
    queryFn: () => api.getEventLeaderboard(eventId, 50),
    staleTime: 30_000,   // 30s
    refetchInterval: 60_000, // auto-refresh every minute
    retry: 2,
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏆 Ranking</Text>
        <Text style={styles.headerSub}>{entries.length} uczestników</Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#00d2ff" />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={item => String(item.rank)}
          renderItem={({ item }) => (
            <LeaderboardRow
              entry={item}
              isCurrentUser={item.user_id === currentUserId}
            />
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>Brak danych rankingowych</Text>
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
  container:         { flex: 1, backgroundColor: '#0a0e1a' },
  header:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#1e2a3a' },
  headerTitle:       { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSub:         { fontSize: 13, color: '#5a6a7a' },
  list:              { padding: 12 },
  row:               { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 8, backgroundColor: '#111827', borderWidth: 1, borderColor: '#1e2a3a', gap: 12 },
  rowHighlight:      { borderColor: 'rgba(0,210,255,0.5)', backgroundColor: 'rgba(0,210,255,0.05)' },
  rankCol:           { width: 40, alignItems: 'center' },
  medal:             { fontSize: 22 },
  rankNum:           { fontSize: 16, fontWeight: '700', color: '#5a6a7a' },
  infoCol:           { flex: 1 },
  rowHeader:         { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  username:          { fontSize: 14, fontWeight: '700', color: '#d0d8e0' },
  usernameHighlight: { color: '#00d2ff' },
  score:             { fontSize: 14, fontWeight: '800', color: '#00d2ff' },
  progressBg:        { height: 4, backgroundColor: '#1e2a3a', borderRadius: 2, overflow: 'hidden' },
  progressFill:      { height: '100%', borderRadius: 2 },
  centered:          { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText:         { color: '#5a6a7a', fontSize: 14 },
});
