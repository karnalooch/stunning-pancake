import React, { useState } from 'react';
import './index.css';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'Dashboard':
        return (
          <>
            <section className="stats-grid">
              <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <span style={{ fontSize: '24px' }}>👥</span>
                  <span style={{ color: 'var(--secondary)', fontSize: '13px', fontWeight: 700 }}>+12.4%</span>
                </div>
                <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: '14px', fontWeight: 600 }}>Active Athletes</p>
                <h3 style={{ fontSize: '38px', margin: '8px 0', fontWeight: 800 }}>24,812</h3>
              </div>
              <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <span style={{ fontSize: '24px' }}>🚴</span>
                  <span style={{ color: 'var(--primary)', fontSize: '13px', fontWeight: 700 }}>Live</span>
                </div>
                <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: '14px', fontWeight: 600 }}>Current Sessions</p>
                <h3 style={{ fontSize: '38px', margin: '8px 0', fontWeight: 800 }}>142</h3>
              </div>
              <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <span style={{ fontSize: '24px' }}>🛡️</span>
                  <span style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: 700 }}>Flagged</span>
                </div>
                <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: '14px', fontWeight: 600 }}>Suspicious Tracks</p>
                <h3 style={{ fontSize: '38px', margin: '8px 0', fontWeight: 800, color: 'var(--accent)' }}>07</h3>
              </div>
            </section>
            <div className="glass-card" style={{ height: '300px', marginTop: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <p style={{ opacity: 0.3 }}>Main Dashboard Visualization Layer</p>
            </div>
          </>
        );
      case 'Live Telemetry':
        return (
          <div className="glass-card">
            <h3>Active GPS Streams</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-dim)', borderBottom: '1px solid var(--glass-border)' }}>
                  <th style={{ padding: '15px' }}>User</th>
                  <th style={{ padding: '15px' }}>Activity</th>
                  <th style={{ padding: '15px' }}>City</th>
                  <th style={{ padding: '15px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map(i => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <td style={{ padding: '15px' }}>Athlete_{i}92</td>
                    <td style={{ padding: '15px' }}>Cycling</td>
                    <td style={{ padding: '15px' }}>London</td>
                    <td style={{ padding: '15px' }}><span className="status-indicator" style={{ color: 'var(--secondary)' }}></span> Streaming</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'Anti-Cheat Monitor':
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            <div className="glass-card">
              <h3 style={{ color: 'var(--accent)' }}>Suspicious Path Detected</h3>
              <div style={{ height: '200px', background: '#000', borderRadius: '12px', margin: '20px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: 'var(--accent)', fontSize: '12px' }}>[MAP_PREVIEW_ERR: High Deviation from Road Grid]</p>
              </div>
              <p>User: <strong>speedy_gonzales_99</strong></p>
              <p>Deviation: <strong>42.5%</strong></p>
              <button className="btn-premium" style={{ background: 'var(--accent)', color: '#fff', width: '100%' }}>Reject Track</button>
            </div>
            <div className="glass-card">
              <h3>BRouter Logs</h3>
              <pre style={{ fontSize: '11px', color: 'var(--secondary)', opacity: 0.7 }}>
                {`[INFO] Validating Session_9821...\n[WARN] Point (51.5, -0.1) jump detected\n[ERROR] Path violates physics for RUN mode\n[INFO] Flagging for manual review...`}
              </pre>
            </div>
          </div>
        );
      default:
        return <div>Section coming soon...</div>;
    }
  };

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div style={{ padding: '40px 30px' }}>
          <h1 className="gradient-text" style={{ fontSize: '26px', margin: 0 }}>SPORT</h1>
          <p style={{ fontSize: '11px', color: 'var(--text-dim)', letterSpacing: '2px', fontWeight: 700 }}>COMMAND CENTER</p>
        </div>

        <nav style={{ flex: 1 }}>
          {['Dashboard', 'Live Telemetry', 'Anti-Cheat Monitor', 'B2B Tenants', 'Settings'].map(tab => (
            <div 
              key={tab}
              className={`nav-item ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </div>
          ))}
        </nav>

        <div style={{ padding: '30px', borderTop: '1px solid var(--glass-border)' }}>
          <div className="glass-card" style={{ padding: '15px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(45deg, #f43f5e, #fb7185)' }}></div>
            <div>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>akarn</p>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-dim)' }}>Owner</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header style={{ marginBottom: '50px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h2 style={{ fontSize: '36px', margin: '0 0 8px 0', fontWeight: 700 }}>{activeTab}</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '16px' }}>System status: <span style={{ color: 'var(--secondary)' }}>Optimal</span></p>
          </div>
          <button className="btn-premium">Reboot System</button>
        </header>

        {renderContent()}
      </main>
    </div>
  );
};

export default App;
