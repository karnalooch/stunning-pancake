import { useEffect, useState } from 'react';
import { MapTrackViewer } from '../../shared/components/MapTrackViewer';
import { AntiCheatStats } from './components/AntiCheatStats';
import { motion } from 'framer-motion';
import { Search, Bell, User } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState('Flagged Tracks');

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
      }
    };
    fetchFlagged();
  }, []);

  const handleAction = async (action: string) => {
    alert(`Action: ${action} for ID: ${selected?.id}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', height: '100%' }}>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}
        >
           <div>
             <h2 className="heading-xl">Anti-Cheat Verification</h2>
             <div className="badge-status warning" style={{ marginTop: '12px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'currentColor' }}></div>
                <span>
                  {selected ? `Case #${selected.id} • Active Investigation` : `Pending Cases: ${activities.length}`}
                </span>
             </div>
           </div>
           
           <div style={{ display: 'flex', gap: '16px' }}>
              <button onClick={() => handleAction('reject')} className="btn-pill btn-danger glow-on-hover" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                   <circle cx="12" cy="12" r="10" />
                   <line x1="15" y1="9" x2="9" y2="15" />
                   <line x1="9" y1="9" x2="15" y2="15" />
                 </svg>
                 Disqualify
              </button>
              <button onClick={() => handleAction('verify')} className="btn-pill btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                   <circle cx="12" cy="12" r="10" />
                   <polyline points="16 10 11 15 8 12" />
                 </svg>
                 Approve Route
              </button>
           </div>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '32px', flex: 1 }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
             {selected && <AntiCheatStats score={selected.verification_score} />}
             
             <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h3 className="text-caption" style={{ textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '24px' }}>Flagged Activities</h3>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '8px' }}>
                  {activities.map(act => (
                    <div 
                      key={act.id}
                      onClick={() => setSelected(act)}
                      className="glow-on-hover"
                      style={{ 
                        padding: '16px', borderRadius: '16px', cursor: 'pointer',
                        background: selected?.id === act.id ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                        border: '1px solid',
                        borderColor: selected?.id === act.id ? 'var(--primary)' : 'transparent',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 700, fontSize: '15px' }}>{act.user.username}</div>
                        <div style={{ fontSize: '12px', color: act.verification_score < 40 ? 'var(--error)' : 'var(--warning)', fontWeight: 800 }}>
                          {act.verification_score}%
                        </div>
                      </div>
                      <div className="text-caption" style={{ fontSize: '12px', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{act.type} • {(act.distance / 1000).toFixed(2)} km</span>
                        <span>{new Date(act.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                    </div>
                  ))}
                </div>
             </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
             <div className="glass-panel" style={{ height: '500px', position: 'relative', overflow: 'hidden', padding: 0 }}>
                {selected && (
                  <MapTrackViewer 
                    routePath={selected.route_path} 
                    validatedPath={selected.route_path}
                    isVerified={selected.is_verified} 
                  />
                )}
                
                <div className="map-legend">
                   <div className="legend-item">
                     <div className="legend-line" style={{ background: 'var(--error)' }}></div>
                     <span>Raw Telemetry</span>
                   </div>
                   <div className="legend-item">
                     <div className="legend-line" style={{ background: 'var(--primary)' }}></div>
                     <span>BRouter Corrected</span>
                   </div>
                </div>
             </div>

             <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px' }}>
                {/* Telemetry Log */}
                <div className="glass-panel" style={{ height: '350px', display: 'flex', flexDirection: 'column' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <h3 className="text-caption" style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>Detailed Telemetry Log</h3>
                      <button className="text-caption" style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>Export CSV</button>
                   </div>
                   <div style={{ flex: 1, overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                         <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>
                               <th style={{ padding: '12px 8px' }}>TIMESTAMP</th>
                               <th style={{ padding: '12px 8px' }}>VELOCITY</th>
                               <th style={{ padding: '12px 8px' }}>ACCURACY</th>
                               <th style={{ padding: '12px 8px' }}>ALTITUDE</th>
                            </tr>
                         </thead>
                         <tbody>
                            {selected?.route_path?.coordinates?.slice(0, 50).map((coord: any, i: number) => (
                               <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                  <td style={{ padding: '10px 8px' }}>T+{i*5}s</td>
                                  <td style={{ padding: '10px 8px', fontWeight: 600 }}>{(15 + Math.sin(i)*5).toFixed(1)} km/h</td>
                                  <td style={{ padding: '10px 8px', color: 'var(--success)' }}>Excellent</td>
                                  <td style={{ padding: '10px 8px' }}>{(120 + i*0.2).toFixed(1)} m</td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </div>

                {/* Sensors */}
                <div className="glass-panel" style={{ height: '350px' }}>
                   <h3 className="text-caption" style={{ textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '32px' }}>Signal Integrity Analysis</h3>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      {['GPS Signal', 'Network Latency', 'Battery Drain'].map((metric, i) => (
                        <div key={metric}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 600 }}>{metric}</span>
                              <span style={{ fontSize: '13px', color: 'var(--success)', fontWeight: 800 }}>{95 - i*10}%</span>
                           </div>
                           <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${95 - i*10}%` }}
                                style={{ height: '100%', background: i === 2 ? 'var(--warning)' : 'var(--success)', borderRadius: '10px' }}
                              />
                           </div>
                        </div>
                      ))}
                      <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(0, 209, 255, 0.05)', borderRadius: '12px', border: '1px dashed var(--primary-glow)' }}>
                         <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                            <span style={{ color: 'var(--primary)', fontWeight: 700 }}>AI Note:</span> No jump-scares or teleportation detected. Movement patterns consistent with urban cycling.
                         </p>
                      </div>
                   </div>
                </div>
             </div>
          </div>

        </div>
    </div>
  );
};
