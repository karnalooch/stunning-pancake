import React from 'react';
import './index.css';

const App: React.FC = () => {
  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div style={{ padding: '40px 30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ width: '32px', height: '32px', background: 'var(--primary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 'bold' }}>S</div>
            <h1 className="gradient-text" style={{ fontSize: '26px', margin: 0, letterSpacing: '-1px' }}>SPORT</h1>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-dim)', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 700 }}>Command Center v1.0</p>
        </div>

        <nav style={{ flex: 1 }}>
          <div className="nav-item active">
            <span>📊</span> Dashboard
          </div>
          <div className="nav-item">
            <span>📡</span> Live Telemetry
          </div>
          <div className="nav-item">
            <span>🛡️</span> Anti-Cheat Monitor
          </div>
          <div className="nav-item">
            <span>🏢</span> B2B Tenants
          </div>
          <div className="nav-item">
            <span>🏆</span> Global Rankings
          </div>
          <div className="nav-item">
            <span>⚙️</span> System Settings
          </div>
        </nav>

        <div style={{ padding: '30px', borderTop: '1px solid var(--glass-border)' }}>
          <div className="glass-card" style={{ padding: '15px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(45deg, #f43f5e, #fb7185)' }}></div>
            <div>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>akarn</p>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-dim)' }}>Project Owner</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header style={{ marginBottom: '50px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h2 style={{ fontSize: '36px', margin: '0 0 8px 0', fontWeight: 700 }}>Global Overview</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '16px' }}>Monitoring <span style={{ color: 'var(--primary)' }}>4 active cities</span> across Europe</p>
          </div>
          <div style={{ display: 'flex', gap: '15px' }}>
            <button className="btn-premium" style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--glass-border)' }}>Export Data</button>
            <button className="btn-premium">System Reboot</button>
          </div>
        </header>

        <section className="stats-grid">
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <span style={{ fontSize: '24px' }}>👥</span>
              <span style={{ color: 'var(--secondary)', fontSize: '13px', fontWeight: 700 }}>+12.4%</span>
            </div>
            <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: '14px', fontWeight: 600 }}>Active Athletes</p>
            <h3 style={{ fontSize: '38px', margin: '8px 0', fontWeight: 800 }}>24,812</h3>
            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', marginTop: '15px' }}>
              <div style={{ width: '70%', height: '100%', background: 'var(--primary)', borderRadius: '2px', boxShadow: '0 0 10px var(--primary)' }}></div>
            </div>
          </div>

          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <span style={{ fontSize: '24px' }}>🚴</span>
              <span style={{ color: 'var(--primary)', fontSize: '13px', fontWeight: 700 }}>Live</span>
            </div>
            <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: '14px', fontWeight: 600 }}>Current Sessions</p>
            <h3 style={{ fontSize: '38px', margin: '8px 0', fontWeight: 800 }}>142</h3>
            <p style={{ margin: '15px 0 0 0', fontSize: '12px', color: 'var(--text-dim)' }}>
              <span className="status-indicator" style={{ color: 'var(--secondary)' }}></span> 84 Running • 58 Cycling
            </p>
          </div>

          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <span style={{ fontSize: '24px' }}>🛡️</span>
              <span style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: 700 }}>Action Required</span>
            </div>
            <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: '14px', fontWeight: 600 }}>Fraud Detection</p>
            <h3 style={{ fontSize: '38px', margin: '8px 0', fontWeight: 800, color: 'var(--accent)' }}>07</h3>
            <p style={{ margin: '15px 0 0 0', fontSize: '12px', color: 'var(--text-dim)' }}>Suspicious GPS patterns detected</p>
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px', marginTop: '30px' }}>
          <div className="glass-card" style={{ height: '450px', position: 'relative', overflow: 'hidden', padding: 0 }}>
             <div style={{ padding: '28px', position: 'absolute', zIndex: 10 }}>
                <h4 style={{ margin: 0, fontSize: '18px' }}>Real-time Geofencing</h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-dim)' }}>Live traffic visualization via MapLibre GL</p>
             </div>
             <div style={{ width: '100%', height: '100%', background: '#050a18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '200px', height: '200px', border: '2px solid var(--primary)', borderRadius: '50%', opacity: 0.1, position: 'absolute', animation: 'pulse 2s infinite' }}></div>
                <p style={{ opacity: 0.2, fontWeight: 700, letterSpacing: '4px' }}>MAP_ENGINE_READY</p>
             </div>
          </div>

          <div className="glass-card">
            <h4 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>Recent Activity</h4>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ display: 'flex', gap: '15px', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid var(--glass-border)' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: i % 2 === 0 ? 'var(--primary)' : 'var(--secondary)', marginTop: '5px' }}></div>
                <div>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>User_0482 finished 12km Run</p>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-dim)' }}>Verified by BRouter • 2 mins ago</p>
                </div>
              </div>
            ))}
            <button style={{ width: '100%', background: 'none', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>View All Activity</button>
          </div>
        </section>
      </main>

      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.1; }
          50% { transform: scale(1.5); opacity: 0.05; }
          100% { transform: scale(1); opacity: 0.1; }
        }
      `}</style>
    </div>
  );
};

export default App;
