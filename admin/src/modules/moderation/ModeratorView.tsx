import { useEffect, useState } from 'react';
import { MapTrackViewer } from '../../shared/components/MapTrackViewer';

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
  route_path: any;
  created_at: string;
}

export const ModeratorView = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selected, setSelected] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFlagged = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/activities/admin/all/?is_verified=false&ordering=-created_at');
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
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
      {/* View Identifier Banner */}
      <div style={{ 
        padding: '12px 20px', 
        background: 'linear-gradient(90deg, rgba(255,77,77,0.2), transparent)', 
        borderLeft: '4px solid #ff4d4d',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <span style={{ fontSize: '24px' }}>🛡️</span>
        <h2 style={{ margin: 0, fontSize: '16px', letterSpacing: '1px', fontWeight: 900 }}>LIVE MODERATION COMMAND CENTER</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', flex: 1, gap: '20px', minHeight: 0 }}>
        {/* Sidebar: List of Flagged Activities */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Flagged Activities</h2>
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
                    padding: '16px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                    background: selected?.id === a.id ? 'rgba(0, 210, 255, 0.05)' : 'transparent',
                    borderLeft: selected?.id === a.id ? '4px solid var(--primary)' : '4px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700 }}>{a.user.username}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>#{a.id}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main Area: Map & Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {selected ? (
            <div className="glass-panel" style={{ flex: 1, padding: 0, position: 'relative', overflow: 'hidden' }}>
              <MapTrackViewer routePath={selected.route_path} isVerified={selected.is_verified} />
              <div style={{ position: 'absolute', bottom: 20, left: 20, zIndex: 10 }}>
                 <div className="glass-panel" style={{ padding: '12px 20px', display: 'flex', gap: '12px' }}>
                    <button onClick={() => handleAction('verify')} style={{ background: '#92fe9d', color: '#000', padding: '8px 16px', borderRadius: '8px', border: 'none', fontWeight: 700 }}>Approve</button>
                    <button onClick={() => handleAction('ban')} style={{ background: 'rgba(255, 77, 77, 0.1)', color: '#ff4d4d', padding: '8px 16px', borderRadius: '8px', border: '1px solid #ff4d4d', fontWeight: 700 }}>Ban User</button>
                 </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: 'var(--text-dim)' }}>Select an activity to begin moderation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
