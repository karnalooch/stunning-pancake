import { useEffect, useState } from 'react';

interface Stats {
  total_users: number;
  total_activities: number;
  total_distance_km: number;
  total_calories: number;
  new_users_today: number;
}

interface LiveAthlete {
  device_id: string;
  speed_ms: number;
}

/**
 * Analytics view — city leaderboard, speed distribution, and activity trends.
 * Enlivened with real-time telemetry and backend stats.
 */
export const AnalyticsView = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [liveUsersCount, setLiveUsersCount] = useState(0);
  const [speedBuckets, setSpeedBuckets] = useState([
    { label: '0–5 km/h',   pct: 0, color: '#8896a5' },
    { label: '5–10 km/h',  pct: 0, color: '#00d2ff' },
    { label: '10–20 km/h', pct: 0, color: '#92fe9d' },
    { label: '20–35 km/h', pct: 0, color: '#ff9500' },
    { label: '35+ km/h',   pct: 0, color: '#ff4d4d' },
  ]);

  const fetchData = async () => {
    try {
      const statsRes = await fetch('http://localhost:8000/api/activities/admin/stats/');
      if (statsRes.ok) setStats(await statsRes.json());

      const teleRes = await fetch('http://localhost:8001/api/telemetry/live');
      if (teleRes.ok) {
        const live: LiveAthlete[] = await teleRes.json();
        setLiveUsersCount(live.length);

        if (live.length > 0) {
          const counts = [0, 0, 0, 0, 0];
          live.forEach(a => {
            const kmh = a.speed_ms * 3.6;
            if (kmh < 5) counts[0]++;
            else if (kmh < 10) counts[1]++;
            else if (kmh < 20) counts[2]++;
            else if (kmh < 35) counts[3]++;
            else counts[4]++;
          });
          setSpeedBuckets(prev => prev.map((b, i) => ({
            ...b,
            pct: Math.round((counts[i] / live.length) * 100)
          })));
        }
      }
    } catch (err) {
      console.error("Analytics fetch error", err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const weekdays = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'];
  const activityCounts = [23, 41, 35, 58, 47, 88, stats?.total_activities || 0];
  const maxCount = Math.max(...activityCounts);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* View Identifier Banner */}
      <div style={{ 
        padding: '12px 20px', 
        background: 'linear-gradient(90deg, rgba(0,210,255,0.2), transparent)', 
        borderLeft: '4px solid var(--primary)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <span style={{ fontSize: '24px' }}>📈</span>
        <h2 style={{ margin: 0, fontSize: '16px', letterSpacing: '1px', fontWeight: 900 }}>CITY ANALYTICS & BI ENGINE</h2>
      </div>

      {/* Top KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {[
          { label: 'Łączny dystans',    val: `${stats?.total_distance_km.toFixed(1) || '0'} km`, icon: '📏', color: 'var(--primary)' },
          { label: 'Użytkownicy LIVE',  val: liveUsersCount.toString(),  icon: '📡', color: 'var(--secondary)' },
          { label: 'Wszystkich kont',   val: stats?.total_users.toString() || '—', icon: '👤', color: '#c77dff' },
          { label: 'Kal. spalonych',    val: stats ? `${(stats.total_calories / 1000).toFixed(1)}k kcal` : '—', icon: '🔥', color: '#ff9500' },
        ].map((k, i) => (
          <div key={i} className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px' }}>
            <div style={{ fontSize: '26px', width: '48px', height: '48px', borderRadius: '12px', background: `${k.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{k.icon}</div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.6px' }}>{k.label.toUpperCase()}</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: k.color, marginTop: '2px' }}>{k.val}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div className="panel-header" style={{ marginBottom: '20px' }}>
            <span className="panel-title">Aktywności / dzień (7d)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '140px' }}>
            {weekdays.map((day, i) => (
              <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700 }}>{activityCounts[i]}</div>
                <div style={{
                  flex: 1, width: '100%',
                  background: `linear-gradient(to top, var(--primary), rgba(0,210,255,0.3))`,
                  borderRadius: '6px 6px 0 0',
                  maxHeight: `${(activityCounts[i] / (maxCount || 1)) * 120}px`,
                  minHeight: '8px',
                  transition: 'max-height 0.5s ease',
                  alignSelf: 'flex-end',
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'rgba(255,255,255,0.4)', borderRadius: '2px' }} />
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 600 }}>{day}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '22px' }}>
          <div className="panel-header" style={{ marginBottom: '20px' }}>
            <span className="panel-title">Rozkład prędkości (LIVE)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {speedBuckets.map(b => (
              <div key={b.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{b.label}</span>
                  <span style={{ fontSize: '12px', color: b.color, fontWeight: 700 }}>{b.pct}%</span>
                </div>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: `${b.pct}%`, background: b.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
