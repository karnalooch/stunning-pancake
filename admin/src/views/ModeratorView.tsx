import { useEffect, useState } from 'react';
import { MapTrackViewer } from '../components/MapTrackViewer';

interface Activity {
  id: number;
  user: {
    username: string;
    tenant_id: string;
  };
  type: string;
  distance: number;
  verification_score: number;
  is_verified: boolean;
  route_path: any; // GeoJSON from API
  created_at: string;
}

/**
 * Moderator Panel — Core Milestone 2 view.
 *
 * Provides a split-screen interface for reviewing activities,
 * analyzing anti-cheat heuristics, and visualizing tracks on MapLibre.
 */
export const ModeratorView = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selected, setSelected] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFlagged = async () => {
      try {
        const token = localStorage.getItem('access_token');
        // Fetch unverified activities (flagged by anti-cheat)
        const res = await fetch(
          'http://localhost:8000/api/activities/admin/all/?is_verified=false&ordering=-created_at',
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        if (res.ok) {
          const data = await res.json();
          const list = data.results ?? data;
          setActivities(list);
          if (list.length > 0) setSelected(list[0]);
        }
      } catch (err) {
        console.error("Failed to fetch activities", err);
      } finally {
        setLoading(false);
      }
    };
    fetchFlagged();
  }, []);

  const handleAction = async (action: 'verify' | 'reject' | 'ban') => {
    if (!selected) return;
    alert(`Action ${action} for activity #${selected.id} (Mock)`);
    // In production, this would call PATCH /api/activities/admin/all/{id}/
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', height: '100%', gap: '20px' }}>
      {/* Sidebar: List of Flagged Activities */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Flagged Activities</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
            Reviewing {activities.length} sessions requiring attention
          </p>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)' }}>Loading...</div>
          ) : activities.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px' }}>✅</div>
              <p style={{ fontWeight: 600, marginTop: '12px' }}>All Clear</p>
            </div>
          ) : (
            activities.map(a => (
              <div 
                key={a.id}
                onClick={() => setSelected(a)}
                style={{
                  padding: '16px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: selected?.id === a.id ? 'rgba(0, 210, 255, 0.05)' : 'transparent',
                  borderLeft: selected?.id === a.id ? '4px solid var(--primary)' : '4px solid transparent',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>{a.user.username}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>#{a.id}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <span className="badge" style={{ fontSize: '10px' }}>{a.type}</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#ff4d4d' }}>
                    Score: {(a.verification_score * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '8px' }}>
                  {Math.round(a.distance / 1000)} km • {new Date(a.created_at).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Area: Map & Details */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {selected ? (
          <>
            <div className="glass-panel" style={{ flex: 1, padding: 0, position: 'relative', overflow: 'hidden' }}>
              <MapTrackViewer 
                routePath={selected.route_path} 
                isVerified={selected.is_verified} 
              />
              <div style={{ position: 'absolute', bottom: 20, left: 20, zIndex: 10 }}>
                 <div className="glass-panel" style={{ padding: '12px 20px', display: 'flex', gap: '12px', backdropFilter: 'blur(10px)' }}>
                    <button 
                      onClick={() => handleAction('verify')}
                      style={{ padding: '8px 16px', borderRadius: '8px', background: '#92fe9d', color: '#000', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => handleAction('reject')}
                      style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.1)', color: '#fff', fontWeight: 700, border: '1px solid var(--border)', cursor: 'pointer' }}
                    >
                      Dismiss
                    </button>
                    <button 
                      onClick={() => handleAction('ban')}
                      style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(255, 77, 77, 0.1)', color: '#ff4d4d', fontWeight: 700, border: '1px solid #ff4d4d', cursor: 'pointer' }}
                    >
                      Ban User
                    </button>
                 </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>ANOMALY DETAILS</label>
                <div style={{ marginTop: '8px', color: '#ff4d4d', fontWeight: 700 }}>
                   Speed deviation: +42% vs BIKE avg
                </div>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>ROUTING MATCH</label>
                <div style={{ marginTop: '8px', color: '#ff9500', fontWeight: 700 }}>
                   Off-road detection: 1.2km detected
                </div>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>HISTORY</label>
                <div style={{ marginTop: '8px', color: 'var(--text-dim)' }}>
                   User has 2 previous warnings
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="glass-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: 'var(--text-dim)' }}>Select an activity to begin moderation</p>
          </div>
        )}
      </div>
    </div>
  );
};
