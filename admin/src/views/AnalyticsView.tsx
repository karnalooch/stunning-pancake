/**
 * Analytics view — city leaderboard, speed distribution, and activity trends.
 *
 * Stub with real-looking data. Will be connected to
 * /api/activities/admin/all/ aggregate endpoints in a future sprint.
 */
export const AnalyticsView = () => {
  const leaderboard = [
    { rank: 1, name: 'Janusz Kowalski',    km: 142.8, badge: '🥇' },
    { rank: 2, name: 'Maria Wiśniewska',   km: 128.4, badge: '🥈' },
    { rank: 3, name: 'Piotr Nowak',        km: 117.2, badge: '🥉' },
    { rank: 4, name: 'Agnieszka Kowalska', km: 98.6,  badge: '' },
    { rank: 5, name: 'Tomasz Lewandowski', km: 84.1,  badge: '' },
  ];

  const speedBuckets = [
    { label: '0–5 km/h',   pct: 12, color: '#8896a5' },
    { label: '5–10 km/h',  pct: 38, color: '#00d2ff' },
    { label: '10–20 km/h', pct: 30, color: '#92fe9d' },
    { label: '20–35 km/h', pct: 16, color: '#ff9500' },
    { label: '35+ km/h',   pct: 4,  color: '#ff4d4d' },
  ];

  const weekdays = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'];
  const activityCounts = [23, 41, 35, 58, 47, 88, 72];
  const maxCount = Math.max(...activityCounts);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {[
          { label: 'Łączny dystans',    val: '8 421 km', icon: '📏', color: 'var(--primary)' },
          { label: 'Aktywne sesje (7d)', val: '364',      icon: '📡', color: 'var(--secondary)' },
          { label: 'Nowi użytkownicy',  val: '67',        icon: '👤', color: '#c77dff' },
          { label: 'Kal. spalonych',    val: '1.2M kcal', icon: '🔥', color: '#ff9500' },
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
        {/* Weekly activity chart */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div className="panel-header" style={{ marginBottom: '20px' }}>
            <span className="panel-title">Aktywności / dzień (7d)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '140px' }}>
            {weekdays.map((day, i) => (
              <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700 }}>
                  {activityCounts[i]}
                </div>
                <div style={{
                  flex: 1, width: '100%',
                  background: `linear-gradient(to top, var(--primary), rgba(0,210,255,0.3))`,
                  borderRadius: '6px 6px 0 0',
                  maxHeight: `${(activityCounts[i] / maxCount) * 120}px`,
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

        {/* Speed distribution */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div className="panel-header" style={{ marginBottom: '20px' }}>
            <span className="panel-title">Rozkład prędkości</span>
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

      {/* Leaderboard */}
      <div className="glass-panel" style={{ padding: '22px' }}>
        <div className="panel-header" style={{ marginBottom: '16px' }}>
          <span className="panel-title">Top Atleci — Bieżący Miesiąc</span>
          <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Siedlce</span>
        </div>
        <table className="leaderboard-table" style={{ width: '100%' }}>
          <tbody>
            {leaderboard.map((u) => (
              <tr key={u.rank} style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="rank-cell" style={{ padding: '12px', fontSize: '18px', width: '40px' }}>
                  {u.badge || <span style={{ color: 'var(--text-dim)', fontWeight: 700 }}>{u.rank}</span>}
                </td>
                <td style={{ padding: '12px' }}>
                  <div className="athlete-info">
                    <div className="mini-avatar-placeholder" />
                    <span className="athlete-name">{u.name}</span>
                  </div>
                </td>
                <td className="metric-cell" style={{ padding: '12px', fontWeight: 800, color: 'var(--primary)' }}>
                  {u.km.toFixed(1)} km
                </td>
                <td style={{ padding: '12px' }}>
                  <div className="progress-bar-bg" style={{ width: '120px' }}>
                    <div className="progress-bar-fill" style={{ width: `${(u.km / 150) * 100}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
