import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './index.css';

const App: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (map.current) return;
    if (!mapContainer.current) return;

    console.log("Initializing map...");
    try {
      // Robust Raster Style for Dark Mode
      const rasterStyle: maplibregl.StyleSpecification = {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap &copy; CartoDB'
          }
        },
        layers: [
          {
            id: 'simple-tiles',
            type: 'raster',
            source: 'raster-tiles',
            minzoom: 0,
            maxzoom: 22
          }
        ]
      };

      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: rasterStyle,
        center: [21.0122, 52.2297], // Warsaw
        zoom: 12,
        attributionControl: false
      });

      map.current.on('load', () => {
        console.log("Map loaded successfully");
        map.current?.resize();
      });

      map.current.on('error', (e) => {
        console.error("MapLibre error:", e);
      });

      // Add navigation controls
      map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

      // Add a mock athlete marker (Maria)
      const el = document.createElement('div');
      el.className = 'athlete-marker';
      
      new maplibregl.Marker(el)
        .setLngLat([21.0122, 52.2297])
        .setPopup(new maplibregl.Popup({ offset: 25 })
        .setHTML('<h3>Maria Wiśniewska</h3><p>Live trail | 14.8 km/h</p>'))
        .addTo(map.current);

    } catch (err) {
      console.error("Failed to initialize map:", err);
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  return (
    <div className="dashboard-container">
      {/* Top Navigation */}
      <header className="top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-1px' }}>SPORT</h2>
          <span style={{ fontSize: '14px', color: 'var(--text-dim)', fontWeight: 500 }}>Admin Portal</span>
        </div>
        <div className="search-wrapper">
          <input type="text" className="search-bar" placeholder="Search athletes, cities, sessions..." />
        </div>
        <div className="user-profile">
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Wojciech Kowalski</p>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-dim)' }}>Global Admin</p>
          </div>
          <div className="avatar-circle">WK</div>
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
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-dim)', fontWeight: 500 }}>{s.label}</p>
              <h3 style={{ margin: '4px 0', fontSize: '24px', fontWeight: 800 }}>{s.val} <span style={{ fontSize: '12px', color: s.color, fontWeight: 600 }}>{s.trend}</span></h3>
            </div>
          </div>
        ))}
      </section>

      {/* Main Grid: Map & Anti-Cheat */}
      <section className="main-grid">
        <div className="glass-panel" style={{ minHeight: '450px', padding: '0', overflow: 'hidden' }}>
          <div className="panel-header" style={{ padding: '20px 20px 10px 20px', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, background: 'linear-gradient(to bottom, var(--bg-deep), transparent)' }}>
            <span className="panel-title">Real-Time Athlete Tracking</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="live-indicator">● LIVE</span>
              <span style={{ fontSize: '12px', opacity: 0.5 }}>14:32:01</span>
            </div>
          </div>
          
          <div ref={mapContainer} style={{ width: '100%', height: '450px' }} className="map-container" />
          
          <div className="map-overlay-stats">
             <div className="overlay-stat">
                <span className="overlay-dot" style={{ color: 'var(--primary)' }}>●</span>
                <span>218 athletes online</span>
             </div>
          </div>
        </div>

        <div className="glass-panel">
          <div className="panel-header">
            <span className="panel-title">Anti-Cheat Monitoring</span>
            <span style={{ fontSize: '12px', opacity: 0.5 }}>14:32:01</span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '20px' }}>Session Anomalies Heatmap</p>
          <div className="radar-chart-placeholder">
             <div className="radar-circle">
                <div className="radar-polygon"></div>
                <div className="radar-sweep"></div>
             </div>
          </div>
          <div style={{ marginTop: '30px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-dim)', fontWeight: 500 }}>Integrity Score</p>
                <span style={{ fontSize: '12px', color: 'var(--secondary)', fontWeight: 600 }}>STABLE</span>
             </div>
             <h4 style={{ margin: '8px 0', fontSize: '28px', fontWeight: 800, color: 'var(--secondary)' }}>97.4%</h4>
             <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: '97%' }}></div>
             </div>
          </div>
        </div>
      </section>

      {/* Bottom Grid: Telemetry, Anomalies, Leaderboard */}
      <section className="bottom-grid">
        <div className="glass-panel">
          <div className="panel-header">
            <span className="panel-title">Live Telemetry</span>
          </div>
          <div className="telemetry-chart">
             {[30, 45, 35, 50, 60, 40, 55, 70, 50, 65, 45, 30].map((h, i) => (
                <div key={i} className="chart-bar" style={{ height: `${h}%` }}>
                   <div className="bar-glow"></div>
                </div>
             ))}
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-dim)', textAlign: 'center', marginTop: '15px' }}>Speed (km/h) Distribution</p>
        </div>

        <div className="glass-panel">
          <div className="panel-header">
            <span className="panel-title">Active Anomalies</span>
          </div>
          <div className="anomaly-list">
             {[
               { id: '9121037', user: 'Janusz K.', trigger: 'User', status: 'Silenced', color: 'var(--text-dim)' },
               { id: '9127637', user: 'Maria W.', trigger: 'Flagged', status: 'Active', color: 'var(--accent)' }
             ].map((a, i) => (
                <div key={i} className="anomaly-item">
                   <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className="anomaly-id">{a.id}</span>
                      <span className="anomaly-user">{a.user}</span>
                   </div>
                   <span className="status-badge" style={{ background: a.color }}>{a.status}</span>
                </div>
             ))}
          </div>
        </div>

        <div className="glass-panel">
          <div className="panel-header">
            <span className="panel-title">City Leaderboard</span>
          </div>
          <table className="leaderboard-table">
            <tbody>
              {[
                { rank: 1, name: 'Janusz Kowal', metric: '42.1km', change: 'up' },
                { rank: 2, name: 'Maria Wiśniewska', metric: '2:48:15', change: 'none' },
                { rank: 3, name: 'Piotr Nowak', metric: '4:00/km', change: 'down' }
              ].map((u, i) => (
                <tr key={i}>
                  <td className="rank-cell">{u.rank}</td>
                  <td>
                    <div className="athlete-info">
                      <div className="mini-avatar-placeholder"></div>
                      <span className="athlete-name">{u.name}</span>
                    </div>
                  </td>
                  <td className="metric-cell">{u.metric}</td>
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
