import React from 'react';
import './index.css';

const App: React.FC = () => {
  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div style={{ padding: '30px' }}>
          <h1 className="gradient-text" style={{ fontSize: '24px', margin: 0 }}>SPORT COMMAND</h1>
          <p style={{ fontSize: '12px', opacity: 0.5 }}>System Administrator</p>
        </div>
        <nav style={{ padding: '0 20px' }}>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li style={{ padding: '15px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', marginBottom: '10px' }}>Dashboard</li>
            <li style={{ padding: '15px', opacity: 0.6 }}>Live Telemetry</li>
            <li style={{ padding: '15px', opacity: 0.6 }}>Anti-Cheat Monitor</li>
            <li style={{ padding: '15px', opacity: 0.6 }}>User Management</li>
            <li style={{ padding: '15px', opacity: 0.6 }}>B2B Tenants</li>
          </ul>
        </nav>
      </aside>

      <main className="main-content">
        <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0 }}>System Overview</h2>
            <p style={{ opacity: 0.6 }}>Real-time platform health and activity tracking</p>
          </div>
          <div className="glass-card" style={{ padding: '10px 20px' }}>
            <span>Admin: <strong>akarn</strong></span>
          </div>
        </header>

        <section className="stats-grid">
          <div className="glass-card">
            <p style={{ margin: 0, opacity: 0.6, fontSize: '14px' }}>Active Users</p>
            <h3 style={{ fontSize: '32px', margin: '10px 0' }}>1,284</h3>
            <span style={{ color: 'var(--secondary)', fontSize: '12px' }}>↑ 12% vs last hour</span>
          </div>
          <div className="glass-card">
            <p style={{ margin: 0, opacity: 0.6, fontSize: '14px' }}>Live Sessions</p>
            <h3 style={{ fontSize: '32px', margin: '10px 0' }}>42</h3>
            <span style={{ color: 'var(--primary)', fontSize: '12px' }}>Tracking in progress</span>
          </div>
          <div className="glass-card">
            <p style={{ margin: 0, opacity: 0.6, fontSize: '14px' }}>Flagged Tracks</p>
            <h3 style={{ fontSize: '32px', margin: '10px 0', color: 'var(--accent)' }}>3</h3>
            <span style={{ opacity: 0.5, fontSize: '12px' }}>Awaiting review</span>
          </div>
        </section>

        <section className="glass-card" style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', opacity: 0.3 }}>
            <p>Interactive Map Component (MapLibre GL)</p>
            <p style={{ fontSize: '12px' }}>[Loading geospatial data from PostGIS...]</p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
