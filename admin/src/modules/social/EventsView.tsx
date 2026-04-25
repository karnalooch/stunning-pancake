import { useEffect, useState } from 'react';

interface Event {
  id: number;
  title: string;
  event_type: string;
  status: string;
  start_date: string;
  end_date: string;
  tenant_id: string | null;
}

const TYPE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  ACCUMULATIVE:  { label: 'Accumulative', color: '#00d2ff', icon: '📏' },
  CHECKPOINT:    { label: 'Checkpoint',   color: '#ff9500', icon: '📍' },
  ROUTE_MATCH:   { label: 'Route Match',  color: '#92fe9d', icon: '🗺️' },
  INTER_TENANT:  { label: 'City Battle',  color: '#c77dff', icon: '⚔️' },
  CLUB_BATTLE:   { label: 'Club Battle',  color: '#ff6b6b', icon: '🛡️' },
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT:      '#8896a5',
  PUBLISHED:  '#00d2ff',
  ACTIVE:     '#92fe9d',
  COMPLETED:  '#8896a5',
  CANCELLED:  '#ff4d4d',
};

/**
 * Events Management view — lists all events from the API with type badges,
 * status indicators, and a "Create Event" button (Phase 6 backend-connected).
 */
export const EventsView = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('ALL');

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        // Reads from API — requires JWT; falls back to demo data if 401
        const token = localStorage.getItem('access_token');
        const res = await fetch('http://localhost:8000/api/events/', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) setEvents(await res.json());
      } catch { /* offline / no auth — show empty state */ }
      setLoading(false);
    };
    fetchEvents();
  }, []);

  const filtered = filter === 'ALL' ? events : events.filter(e => e.event_type === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['ALL', 'ACCUMULATIVE', 'INTER_TENANT', 'CLUB_BATTLE', 'CHECKPOINT'].map(f => (
            <button
              key={f}
              id={`events-filter-${f.toLowerCase()}`}
              onClick={() => setFilter(f)}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: filter === f ? 'var(--primary)' : 'var(--border)',
                background: filter === f ? 'rgba(0,210,255,0.12)' : 'transparent',
                color: filter === f ? 'var(--primary)' : 'var(--text-dim)',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {f === 'ALL' ? 'Wszystkie' : (TYPE_LABELS[f]?.label ?? f)}
            </button>
          ))}
        </div>
        <button
          id="create-event-button"
          style={{
            padding: '10px 20px', borderRadius: '10px', border: 'none',
            background: 'linear-gradient(135deg, var(--primary), #0098b8)',
            color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
          }}
        >
          + Nowy Event
        </button>
      </div>

      {/* Event cards */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '60px' }}>Ładowanie eventów...</div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏆</div>
          <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Brak eventów</div>
          <div style={{ color: 'var(--text-dim)', fontSize: '14px' }}>Utwórz pierwszy event klikając "+ Nowy Event"</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {filtered.map(event => {
            const typeMeta = TYPE_LABELS[event.event_type] ?? { label: event.event_type, color: '#8896a5', icon: '📌' };
            return (
              <div key={event.id} className="glass-panel" style={{ padding: '20px', cursor: 'pointer', transition: 'border-color 0.2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <span style={{ fontSize: '24px' }}>{typeMeta.icon}</span>
                  <span style={{
                    padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                    background: `${STATUS_COLORS[event.status]}20`,
                    color: STATUS_COLORS[event.status],
                    border: `1px solid ${STATUS_COLORS[event.status]}40`,
                  }}>{event.status}</span>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>{event.title}</div>
                <div style={{ fontSize: '12px', color: typeMeta.color, fontWeight: 600, marginBottom: '12px' }}>
                  {typeMeta.label}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                  {new Date(event.start_date).toLocaleDateString('pl')} →{' '}
                  {new Date(event.end_date).toLocaleDateString('pl')}
                </div>
                {event.tenant_id && (
                  <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-dim)' }}>
                    🏙️ {event.tenant_id}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
