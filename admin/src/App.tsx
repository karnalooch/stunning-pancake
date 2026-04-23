import React from 'react';
import './index.css';

const App: React.FC = () => {
  return (
    <div className="dashboard-container">
      {/* Top Navigation */}
      <header className="top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--primary)' }}>SPORT</h2>
          <span style={{ fontSize: '14px', color: 'var(--text-dim)' }}>Admin Portal</span>
        </div>
        <input type="text" className="search-bar" placeholder="Search athletes, cities, sessions..." />
        <div className="user-profile">
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Wojciech Kowalski</p>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-dim)' }}>Global Admin</p>
          </div>
          <div className="avatar-circle"></div>
        </div>
      </header>

      {/* Stats Row */}
      <section className="stats-row">
        {[
          { label: 'Active Athletes', val: '1,452', trend: '+8.1%', icon: '🏃', color: 'var(--primary)' },
          { label: 'Live Sessions', val: '218', trend: '+14.5%', icon: '📡', color: 'var(--secondary)' },
          { label: 'New Registrations', val: '67', trend: '+3.2%', icon: '👤', color: '#00d2ff' },
          { label: 'Alerts', val: '3', trend: 'active', icon: '⚠️', color: 'var(--accent)' }
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-icon" style={{ background: `${s.color}20`, color: s.color }}>{s.icon}</div>
            <div>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-dim)' }}>{s.label}</p>
              <h3 style={{ margin: '4px 0', fontSize: '24px', fontWeight: 800 }}>{s.val} <span style={{ fontSize: '12px', color: s.color }}>{s.trend}</span></h3>
            </div>
          </div>
        ))}
      </section>

      {/* Main Grid: Map & Anti-Cheat */}
      <section className="main-grid">
        <div className="glass-panel" style={{ minHeight: '400px' }}>
          <div className="panel-header">
            <span className="panel-title">Real-Time Athlete Tracking (MapLibre)</span>
            <span style={{ fontSize: '12px', opacity: 0.5 }}>14:32:01 •••</span>
          </div>
          <div style={{ height: '320px', background: '#050a18', borderRadius: '12px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '20px', left: '20px', background: 'rgba(0,0,0,0.5)', padding: '8px 12px', borderRadius: '20px', fontSize: '11px' }}>
               <span style={{ color: 'var(--primary)' }}>●</span> Live athletes (218)
            </div>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-dim)', letterSpacing: '2px' }}>[INTERACTIVE_MAP_LAYER]</p>
                <div style={{ width: '100px', height: '2px', background: 'var(--primary)', margin: '10px auto' }}></div>
            </div>
            {/* Mock popup for Maria */}
            <div style={{ position: 'absolute', top: '30%', right: '30%', background: 'var(--bg-card)', padding: '12px', borderRadius: '12px', border: '1px solid var(--primary)', display: 'flex', gap: '10px' }}>
               <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#444' }}></div>
               <div>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: 700 }}>Maria Wiśniewska</p>
                  <p style={{ margin: 0, fontSize: '10px', color: 'var(--secondary)' }}>Live trail | 14.8 km/h</p>
               </div>
            </div>
          </div>
        </div>

        <div className="glass-panel">
          <div className="panel-header">
            <span className="panel-title">Anti-Cheat Monitoring Panel</span>
            <span style={{ fontSize: '12px', opacity: 0.5 }}>14:32:01</span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Session Anomalies</p>
          <div className="radar-chart-placeholder">
             <div style={{ width: '150px', height: '150px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '20%', left: '20%', width: '60%', height: '60%', background: 'rgba(146, 254, 157, 0.2)', clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' }}></div>
             </div>
          </div>
          <div style={{ marginTop: '20px' }}>
             <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-dim)' }}>Integrity Score</p>
             <h4 style={{ margin: '5px 0', fontSize: '24px', color: 'var(--secondary)' }}>97.4% <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>stable</span></h4>
             <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', marginTop: '10px' }}>
                <div style={{ width: '97%', height: '100%', background: 'var(--secondary)', borderRadius: '3px' }}></div>
             </div>
          </div>
        </div>
      </section>

      {/* Bottom Grid: Telemetry, Anomalies, Leaderboard */}
      <section className="bottom-grid">
        <div className="glass-panel">
          <div className="panel-header">
            <span className="panel-title">Telemetry Data (Live)</span>
          </div>
          <div style={{ height: '150px', display: 'flex', alignItems: 'flex-end', gap: '5px', padding: '10px 0' }}>
             {[30, 45, 35, 50, 60, 40, 55, 70, 50].map((h, i) => (
                <div key={i} style={{ flex: 1, height: `${h}%`, background: 'linear-gradient(to top, var(--primary), transparent)', borderRadius: '2px' }}></div>
             ))}
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-dim)', textAlign: 'center' }}>Speed (km/h) Distribution</p>
        </div>

        <div className="glass-panel">
          <div className="panel-header">
            <span className="panel-title">Session Anomalies</span>
          </div>
          <div style={{ marginTop: '10px' }}>
             {[
               { id: '9121037', user: 'Janusz K.', trigger: 'User', status: 'Snowced' },
               { id: '9127637', user: 'Maria W.', trigger: 'Flagged', status: 'Active' }
             ].map((a, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                   <span style={{ fontSize: '12px' }}>{a.id}</span>
                   <span style={{ fontSize: '12px', fontWeight: 600 }}>{a.user}</span>
                   <span style={{ fontSize: '11px', background: i===0 ? 'var(--accent)' : 'var(--primary)', padding: '2px 8px', borderRadius: '4px' }}>{a.status}</span>
                </div>
             ))}
          </div>
        </div>

        <div className="glass-panel">
          <div className="panel-header">
            <span className="panel-title">Live Leaderboard</span>
          </div>
          <table className="leaderboard-table">
            <tbody>
              {[
                { rank: 1, name: 'Janusz Kowal', metric: '42.1km' },
                { rank: 2, name: 'Maria Wiśniewska', metric: '2:48:15' },
                { rank: 3, name: 'Piotr Nowak', metric: '4:00/km' }
              ].map((u, i) => (
                <tr key={i}>
                  <td style={{ width: '30px', fontWeight: 800, color: 'var(--primary)' }}>{u.rank}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="mini-avatar"></div>
                      <span style={{ fontSize: '13px', fontWeight: 500 }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', fontSize: '12px', fontWeight: 700 }}>{u.metric}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default App;
