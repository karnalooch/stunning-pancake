import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './index.css';

interface Athlete {
  deviceId: number;
  name: string;
  lat: number;
  lng: number;
  speed: number;
  course: number;
  lastUpdate: string;
}

const App: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<Record<number, maplibregl.Marker>>({});
  const [athletes, setAthletes] = useState<Athlete[]>([]);

  // Telemetry Polling
  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        // In production this would use proper Auth headers
        const response = await fetch('http://localhost:8000/api/activities/telemetry/live/');
        if (response.ok) {
          const data = await response.json();
          setAthletes(data);
        }
      } catch (err) {
        console.error("Telemetry fetch error:", err);
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 5000);
    return () => clearInterval(interval);
  }, []);

  // Map Initialization
  useEffect(() => {
    if (map.current) return;
    if (!mapContainer.current) return;

    console.log("Initializing map...");
    try {
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
            attribution: '&copy; CartoDB'
          }
        },
        layers: [{ id: 'simple-tiles', type: 'raster', source: 'raster-tiles' }]
      };

      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: rasterStyle,
        center: [21.0122, 52.2297], // Warsaw
        zoom: 12,
        attributionControl: false
      });

      map.current.on('load', () => {
        map.current?.resize();
      });

      map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    } catch (err) {
      console.error("Failed to initialize map:", err);
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update Markers when Athletes change
  useEffect(() => {
    if (!map.current) return;

    athletes.forEach(athlete => {
      if (markers.current[athlete.deviceId]) {
        // Update existing marker
        markers.current[athlete.deviceId].setLngLat([athlete.lng, athlete.lat]);
      } else {
        // Create new marker
        const el = document.createElement('div');
        el.className = 'athlete-marker';
        
        const marker = new maplibregl.Marker(el)
          .setLngLat([athlete.lng, athlete.lat])
          .setPopup(new maplibregl.Popup({ offset: 25 })
          .setHTML(`<h3>${athlete.name}</h3><p>Speed: ${(athlete.speed * 1.852).toFixed(1)} km/h</p>`))
          .addTo(map.current!);
          
        markers.current[athlete.deviceId] = marker;
      }
    });

    // Clean up markers for devices that are no longer active (optional)
  }, [athletes]);

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
          { label: 'Active Athletes', val: athletes.length, trend: '+8.1%', icon: '🏃', color: 'var(--primary)' },
          { label: 'Live Sessions', val: athletes.filter(a => a.speed > 0).length, trend: '+14.5%', icon: '📡', color: 'var(--secondary)' },
          { label: 'New Registrations', val: '67', trend: '+3.2%', icon: '👤', color: '#00d2ff' },
          { label: 'Alerts', val: '0', trend: 'stable', icon: '⚠️', color: 'var(--accent)' }
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
                <span>{athletes.length} athletes online</span>
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
