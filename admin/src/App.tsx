import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './index.css';

interface Athlete {
  deviceId: number;
  name: string;
  type: string;
  lat: number;
  lng: number;
  speed: number;
  course: number;
  lastUpdate: string;
}

const App: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<Record<number, maplibregl.Marker>>({});
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const athleteHistory = useRef<Record<number, { pts: [number, number][], type: string }>>({});
  const animFrameRef = useRef<number>(0);

  // Telemetry Polling
  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/activities/telemetry/live/');
        if (response.ok) {
          const data: Athlete[] = await response.json();
          setAthletes(data);
          data.forEach((athlete) => {
            const entry = athleteHistory.current[athlete.deviceId] || { pts: [], type: athlete.type };
            const newPoint: [number, number] = [athlete.lng, athlete.lat];
            const last = entry.pts[entry.pts.length - 1];
            if (!last || last[0] !== newPoint[0] || last[1] !== newPoint[1]) {
              entry.pts = [...entry.pts, newPoint].slice(-18);
            }
            entry.type = athlete.type;
            athleteHistory.current[athlete.deviceId] = entry;
          });
        }
      } catch (err) {
        console.error('Telemetry fetch error:', err);
      }
    };
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(interval);
  }, []);

  // Map Initialization
  useEffect(() => {
    if (map.current || !mapContainer.current) return;
    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            'raster-tiles': {
              type: 'raster',
              tiles: [
                'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              ],
              tileSize: 256,
              attribution: '&copy; CartoDB',
            },
          },
          layers: [{ id: 'simple-tiles', type: 'raster', source: 'raster-tiles' }],
        },
        center: [22.2875, 52.1686],
        zoom: 14,
        attributionControl: false,
      });
      map.current.on('load', () => map.current?.resize());
      map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    } catch (err) {
      console.error('Failed to initialize map:', err);
    }
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Canvas Trail Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    const mapEl = mapContainer.current;
    if (!canvas || !mapEl || !map.current) return;

    const resize = () => {
      canvas.width = mapEl.clientWidth;
      canvas.height = mapEl.clientHeight;
    };
    resize();

    const drawTrails = () => {
      if (!map.current || !canvas) { animFrameRef.current = requestAnimationFrame(drawTrails); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) { animFrameRef.current = requestAnimationFrame(drawTrails); return; }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      Object.values(athleteHistory.current).forEach(({ pts, type }) => {
        if (pts.length < 2) return;

        const colorRgb = type === 'bicycle' ? '146,254,157' : '0,210,255';

        // 1. Project all points to pixel space once
        const pixels = pts.map(([lng, lat]) => {
          const p = map.current!.project([lng, lat]);
          return [p.x, p.y] as [number, number];
        });

        // 2. High-Performance Interpolation Loop
        for (let i = 0; i < pixels.length - 1; i++) {
          const start = pixels[i];
          const end = pixels[i + 1];
          const steps = 6; // Optimized density

          for (let j = 0; j < steps; j++) {
            const t = j / steps;
            const tNext = (j + 1) / steps;
            
            const globalT = (i + t) / (pixels.length - 1);
            const x1 = start[0] + (end[0] - start[0]) * t;
            const y1 = start[1] + (end[1] - start[1]) * t;
            const x2 = start[0] + (end[0] - start[0]) * tNext;
            const y2 = start[1] + (end[1] - start[1]) * tNext;

            const width = 0.5 + (globalT * 6.5);
            const opacity = Math.pow(globalT, 1.4) * 0.8;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineCap = 'butt';

            // Pass 1: Wide Glow (Low Alpha)
            ctx.strokeStyle = `rgba(${colorRgb}, ${opacity * 0.15})`;
            ctx.lineWidth = width * 4;
            ctx.stroke();

            // Pass 2: Mid Glow
            ctx.strokeStyle = `rgba(${colorRgb}, ${opacity * 0.35})`;
            ctx.lineWidth = width * 2;
            ctx.stroke();

            // Pass 3: Sharp Core
            ctx.strokeStyle = `rgba(${colorRgb}, ${opacity})`;
            ctx.lineWidth = width;
            ctx.stroke();
          }
        }
      });



      animFrameRef.current = requestAnimationFrame(drawTrails);
    };

    animFrameRef.current = requestAnimationFrame(drawTrails);

    const handleResize = () => resize();
    window.addEventListener('resize', handleResize);
    map.current?.on('move', () => {}); // trigger redraws on pan/zoom

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Update Markers when Athletes change
  useEffect(() => {
    if (!map.current) return;
    const activeIds = new Set(athletes.map((a) => a.deviceId));
    athletes.forEach((athlete) => {
      if (markers.current[athlete.deviceId]) {
        markers.current[athlete.deviceId].setLngLat([athlete.lng, athlete.lat]);
      } else {
        const el = document.createElement('div');
        el.className = `athlete-marker ${athlete.type === 'bicycle' ? 'type-bike' : 'type-run'}`;
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([athlete.lng, athlete.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 25 }).setHTML(
              `<h3>${athlete.name}</h3><p>Speed: ${(athlete.speed * 1.852).toFixed(1)} km/h</p>`
            )
          )
          .addTo(map.current!);
        markers.current[athlete.deviceId] = marker;
      }
    });
    Object.keys(markers.current).forEach((id) => {
      const numId = parseInt(id);
      if (!activeIds.has(numId)) {
        markers.current[numId].remove();
        delete markers.current[numId];
      }
    });
  }, [athletes]);

  return (
    <div className="dashboard-container">
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

      <section className="stats-row">
        {[
          { label: 'Active Athletes', val: athletes.length, trend: '+8.1%', icon: '🏃', color: 'var(--primary)' },
          { label: 'Live Sessions', val: athletes.filter((a) => a.speed > 0).length, trend: '+14.5%', icon: '📡', color: 'var(--secondary)' },
          { label: 'New Registrations', val: '67', trend: '+3.2%', icon: '👤', color: '#00d2ff' },
          { label: 'Alerts', val: '0', trend: 'stable', icon: '⚠️', color: 'var(--accent)' },
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

      <section className="main-grid">
        <div className="glass-panel" style={{ minHeight: '450px', padding: '0', overflow: 'hidden' }}>
          <div className="panel-header" style={{ padding: '20px 20px 10px 20px', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, background: 'linear-gradient(to bottom, var(--bg-deep), transparent)' }}>
            <span className="panel-title">Real-Time Athlete Tracking</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="live-indicator">● LIVE</span>
            </div>
          </div>

          <div style={{ position: 'relative', width: '100%', height: '450px' }}>
            <div ref={mapContainer} style={{ width: '100%', height: '450px' }} className="map-container" />
            <canvas
              ref={canvasRef}
              style={{
                position: 'absolute', top: 0, left: 0,
                width: '100%', height: '100%',
                pointerEvents: 'none', zIndex: 5,
              }}
            />
          </div>

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
            <span style={{ fontSize: '12px', opacity: 0.5 }}>Live</span>
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

      <section className="bottom-grid">
        <div className="glass-panel">
          <div className="panel-header"><span className="panel-title">Live Telemetry</span></div>
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
          <div className="panel-header"><span className="panel-title">Active Anomalies</span></div>
          <div className="anomaly-list">
            {[
              { id: '9121037', user: 'Janusz K.', status: 'Silenced', color: 'var(--text-dim)' },
              { id: '9127637', user: 'Maria W.', status: 'Active', color: 'var(--accent)' },
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
          <div className="panel-header"><span className="panel-title">City Leaderboard</span></div>
          <table className="leaderboard-table">
            <tbody>
              {[
                { rank: 1, name: 'Janusz Kowal', metric: '42.1km' },
                { rank: 2, name: 'Maria Wiśniewska', metric: '2:48:15' },
                { rank: 3, name: 'Piotr Nowak', metric: '4:00/km' },
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
