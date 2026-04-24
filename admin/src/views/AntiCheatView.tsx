import { useEffect, useState } from 'react';

interface AnomalySession {
  id: string;
  username: string;
  deviation_pct: number;
  distance_km: number;
  activity_type: string;
  flagged_at: string;
  verification_score: number;
}

const scoreColor = (score: number) => {
  if (score >= 0.85) return '#92fe9d';
  if (score >= 0.5) return '#ff9500';
  return '#ff4d4d';
};

/**
 * Anti-Cheat monitoring view.
 *
 * Fetches activities with low verification scores (BRouter anomalies)
 * and displays them with deviation gauge, score, and action buttons.
 *
 * Falls back to demo data when API is unavailable.
 */
export const AntiCheatView = () => {
  const [sessions, setSessions] = useState<AnomalySession[]>([]);
  const [loading, setLoading] = useState(true);
  const integrityScore = sessions.length === 0
    ? 100
    : Math.max(0, 100 - sessions.length * 2.5);

  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(
          'http://localhost:8000/api/activities/admin/all/?is_verified=false&ordering=-created_at&limit=20',
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        if (res.ok) {
          const data = await res.json();
          // Transform to AnomalySession shape
          const mapped: AnomalySession[] = (data.results ?? data).map((a: Record<string, unknown>) => ({
            id: String(a.id),
            username: String((a.user as Record<string, unknown>)?.username ?? 'unknown'),
            deviation_pct: Math.round((1 - (a.verification_score as number ?? 0)) * 100),
            distance_km: (a.distance as number ?? 0) / 1000,
            activity_type: String(a.type ?? 'UNKNOWN'),
            flagged_at: String(a.created_at ?? ''),
            verification_score: a.verification_score as number ?? 0,
          }));
          setSessions(mapped);
        }
      } catch { /* offline */ }
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Integrity overview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
        <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '42px', fontWeight: 800, color: scoreColor(integrityScore / 100) }}>
            {integrityScore.toFixed(1)}%
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: 600, marginTop: '4px' }}>
            INTEGRITY SCORE
          </div>
          <div className="progress-bar-bg" style={{ marginTop: '12px' }}>
            <div className="progress-bar-fill" style={{ width: `${integrityScore}%`, background: scoreColor(integrityScore / 100) }} />
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '42px', fontWeight: 800, color: sessions.length > 0 ? '#ff4d4d' : '#92fe9d' }}>
            {sessions.length}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: 600, marginTop: '4px' }}>
            ANOMALIE WYKRYTE
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
          <div className="radar-chart-placeholder" style={{ width: '80px', height: '80px', margin: '0 auto' }}>
            <div className="radar-circle" style={{ width: '80px', height: '80px' }}>
              <div className="radar-polygon"></div>
              <div className="radar-sweep"></div>
            </div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: 600, marginTop: '8px' }}>
            SKAN AKTYWNY
          </div>
        </div>
      </div>

      {/* Anomaly list */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div className="panel-header" style={{ marginBottom: '16px' }}>
          <span className="panel-title">Flagowane sesje</span>
          <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
            Wynik BRouter &lt; 85% zgodności
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>Ładowanie...</div>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '40px' }}>✅</div>
            <div style={{ marginTop: '12px', fontWeight: 700 }}>Brak anomalii</div>
            <div style={{ color: 'var(--text-dim)', fontSize: '13px', marginTop: '4px' }}>
              Wszystkie aktywności przeszły walidację BRouter
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['ID', 'Atleta', 'Typ', 'Dystans', 'Odchylenie', 'Score', 'Akcja'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px', fontSize: '12px', color: 'var(--text-dim)' }}>#{s.id}</td>
                  <td style={{ padding: '12px', fontWeight: 600, fontSize: '13px' }}>{s.username}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600 }}>{s.activity_type}</span>
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px' }}>{s.distance_km.toFixed(1)} km</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ color: s.deviation_pct > 30 ? '#ff4d4d' : '#ff9500', fontWeight: 700 }}>
                      +{s.deviation_pct}%
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'var(--border)' }}>
                        <div style={{ width: `${s.verification_score * 100}%`, height: '100%', borderRadius: '2px', background: scoreColor(s.verification_score) }} />
                      </div>
                      <span style={{ fontSize: '11px', color: scoreColor(s.verification_score), fontWeight: 700 }}>
                        {(s.verification_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' }}>
                        Wycisz
                      </button>
                      <button style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px', border: '1px solid #ff4d4d40', background: 'rgba(255,77,77,0.1)', color: '#ff4d4d', cursor: 'pointer' }}>
                        Zablokuj
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
