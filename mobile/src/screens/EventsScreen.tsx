/**
 * Events Screen — SPORT Mobile App
 * ==================================
 * Constitution §21: Event System and Real-Time Competitions
 * Constitution §9.1: TanStack Query optimistic updates
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api, type SportEvent } from '../services/api';

// ---------------------------------------------------------------------------
// Type metadata
// ---------------------------------------------------------------------------

const TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  ACCUMULATIVE:  { label: 'Dystans',       color: '#00d2ff', icon: '📏' },
  CHECKPOINT:    { label: 'Checkpoint',    color: '#ff9500', icon: '📍' },
  ROUTE_MATCH:   { label: 'Route Match',   color: '#92fe9d', icon: '🗺️' },
  INTER_TENANT:  { label: 'Miasto vs miasto', color: '#c77dff', icon: '⚔️' },
  CLUB_BATTLE:   { label: 'Klub vs klub',  color: '#ff6b6b', icon: '🛡️' },
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT:      '#5a6a7a',
  PUBLISHED:  '#00d2ff',
  ACTIVE:     '#92fe9d',
  COMPLETED:  '#5a6a7a',
  CANCELLED:  '#ff4d4d',
};

// ---------------------------------------------------------------------------
// Event card
// ---------------------------------------------------------------------------

interface EventCardProps {
  event: SportEvent;
  onPress: (event: SportEvent) => void;
}

const EventCard: React.FC<EventCardProps> = ({ event, onPress }) => {
  const meta = TYPE_META[event.event_type] ?? { label: event.event_type, color: '#fff', icon: '📌' };
  const statusColor = STATUS_COLORS[event.status] ?? '#fff';
  const start = new Date(event.start_date).toLocaleDateString('pl');
  const end   = new Date(event.end_date).toLocaleDateString('pl');

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(event)}
      accessibilityLabel={`Event: ${event.title}`}
    >
      {/* Header row */}
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>{meta.icon}</Text>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20`, borderColor: `${statusColor}40` }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{event.status}</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.cardTitle}>{event.title}</Text>
      <Text style={[styles.cardType, { color: meta.color }]}>{meta.label}</Text>

      {/* Date range */}
      <Text style={styles.cardDates}>{start} → {end}</Text>
    </TouchableOpacity>
  );
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

type FilterType = 'ALL' | SportEvent['event_type'];

const FILTERS: FilterType[] = ['ALL', 'ACCUMULATIVE', 'INTER_TENANT', 'CLUB_BATTLE', 'CHECKPOINT'];
const FILTER_LABELS: Record<FilterType, string> = {
  ALL:          'Wszystkie',
  ACCUMULATIVE: 'Dystans',
  INTER_TENANT: 'Miasto',
  CLUB_BATTLE:  'Klub',
  CHECKPOINT:   'Checkp.',
};

export const EventsScreen: React.FC = () => {
  const [filter, setFilter] = useState<FilterType>('ALL');

  const { data: events = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['events', 'active'],
    queryFn: () => api.getActiveEvents(),
    staleTime: 60_000,   // 1 min
    retry: 2,
  });

  const filtered = filter === 'ALL'
    ? events
    : events.filter(e => e.event_type === filter);

  const handlePress = (_event: SportEvent) => {
    // TODO: navigate to EventDetailScreen
  };

  return (
    <View style={styles.container}>
      {/* Filter bar */}
      <View style={styles.filterBar}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
            accessibilityLabel={`Filtr: ${FILTER_LABELS[f]}`}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {FILTER_LABELS[f]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#00d2ff" />
          <Text style={styles.loadingText}>Ładowanie eventów…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => <EventCard event={item} onPress={handlePress} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyIcon}>🏆</Text>
              <Text style={styles.emptyTitle}>Brak aktywnych eventów</Text>
              <Text style={styles.emptySubtitle}>Sprawdź ponownie później</Text>
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
  filterBar:         { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterBtn:         { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#1e2a3a' },
  filterBtnActive:   { borderColor: '#00d2ff', backgroundColor: 'rgba(0,210,255,0.1)' },
  filterText:        { fontSize: 12, color: '#5a6a7a', fontWeight: '600' },
  filterTextActive:  { color: '#00d2ff' },
  list:              { padding: 16, gap: 12 },
  card:              { backgroundColor: '#111827', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#1e2a3a' },
  cardHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardIcon:          { fontSize: 26 },
  statusBadge:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  statusText:        { fontSize: 10, fontWeight: '700' },
  cardTitle:         { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 4 },
  cardType:          { fontSize: 12, fontWeight: '600', marginBottom: 10 },
  cardDates:         { fontSize: 11, color: '#5a6a7a' },
  centered:          { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  loadingText:       { color: '#5a6a7a', marginTop: 12 },
  emptyIcon:         { fontSize: 48 },
  emptyTitle:        { fontSize: 18, fontWeight: '700', color: '#fff' },
  emptySubtitle:     { fontSize: 14, color: '#5a6a7a' },
});
