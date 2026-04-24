import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

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

/**
 * Live Tracking view — MapLibre map with real-time athlete markers,
 * Canvas-based GPU comet trail renderer, and stats overlay.
 *
 * Extracted from monolithic App.tsx with full logic preserved.
 */
export const LiveTrackingView = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef<Record<number, maplibregl.Marker>>({});
  const history = useRef<Record<number, { pts: [number, number][]; type: string }>>({});
  const animFrame = useRef<number>(0);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [lastPoll, setLastPoll] = useState<string>('—');

  // Telemetry polling (3s)
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/activities/telemetry/live/');
        if (res.ok) {
          const data: Athlete[] = await res.json();
          setAthletes(data);
          setLastPoll(new Date().toLocaleTimeString('pl'));
          data.forEach((a) => {
            const entry = history.current[a.deviceId] || { pts: [], type: a.type };
            const pt: [number, number] = [a.lng, a.lat];
            const last = entry.pts[entry.pts.length - 1];
            if (!last || last[0] !== pt[0] || last[1] !== pt[1]) {
              entry.pts = [...entry.pts, pt].slice(-18);
            }
            entry.type = a.type;
            history.current[a.deviceId] = entry;
          });
        }
      } catch { /* network error — silent */ }
    };
    poll();
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, []);

  // Map init
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;
    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
            tileSize: 256,
          },
        },
        layers: [{ id: 'tiles', type: 'raster', source: 'raster-tiles' }],
      },
      center: [22.2875, 52.1686],
      zoom: 13,
      attributionControl: false,
    });
    mapRef.current.on('load', () => mapRef.current?.resize());
    mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    return () => {
      cancelAnimationFrame(animFrame.current);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Canvas trail renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    const mapEl = mapContainer.current;
    if (!canvas || !mapEl || !mapRef.current) return;

    const resize = () => {
      canvas.width = mapEl.clientWidth;
      canvas.height = mapEl.clientHeight;
    };
    resize();

    const draw = () => {
      const m = mapRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx || !m) { animFrame.current = requestAnimationFrame(draw); return; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      Object.values(history.current).forEach(({ pts, type }) => {
        if (pts.length < 2) return;
        const rgb = type === 'bicycle' ? '146,254,157' : '0,210,255';
        const pixels = pts.map(([lng, lat]) => {
          const p = m.project([lng, lat]);
          return [p.x, p.y] as [number, number];
        });
        for (let i = 0; i < pixels.length - 1; i++) {
          const [x1, y1] = pixels[i];
          const [x2, y2] = pixels[i + 1];
          const t = i / (pixels.length - 1);
          const w = 0.5 + t * 6.5;
          const a = Math.pow(t, 1.4) * 0.85;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineCap = 'butt';
          ctx.strokeStyle = `rgba(${rgb},${a * 0.15})`; ctx.lineWidth = w * 4; ctx.stroke();
          ctx.strokeStyle = `rgba(${rgb},${a * 0.35})`; ctx.lineWidth = w * 2; ctx.stroke();
          ctx.strokeStyle = `rgba(${rgb},${a})`; ctx.lineWidth = w; ctx.stroke();
        }
      });
      animFrame.current = requestAnimationFrame(draw);
    };
    animFrame.current = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(animFrame.current); window.removeEventListener('resize', resize); };
  }, []);

  // Update markers
  useEffect(() => {
    if (!mapRef.current) return;
    const ids = new Set(athletes.map(a => a.deviceId));
    athletes.forEach((a) => {
      if (markers.current[a.deviceId]) {
        markers.current[a.deviceId].setLngLat([a.lng, a.lat]);
      } else {
        const el = document.createElement('div');
        el.className = `athlete-marker ${a.type === 'bicycle' ? 'type-bike' : 'type-run'}`;
        const mk = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([a.lng, a.lat])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(
            `<h3>${a.name}</h3><p>Speed: ${(a.speed * 1.852).toFixed(1)} km/h</p>`
          ))
          .addTo(mapRef.current!);
        markers.current[a.deviceId] = mk;
      }
    });
    Object.keys(markers.current).forEach((id) => {
      const n = parseInt(id);
      if (!ids.has(n)) { markers.current[n].remove(); delete markers.current[n]; }
    });
  }, [athletes]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'Athletes Online', val: athletes.length, icon: '🏃', color: 'var(--primary)' },
          { label: 'Live Sessions', val: athletes.filter(a => a.speed > 0).length, icon: '📡', color: 'var(--secondary)' },
          { label: 'Avg Speed', val: athletes.length ? `${(athletes.reduce((s, a) => s + a.speed * 1.852, 0) / athletes.length).toFixed(1)} km/h` : '—', icon: '⚡', color: '#ff9500' },
          { label: 'Last Poll', val: lastPoll, icon: '🕐', color: 'var(--text-dim)' },
        ].map((s, i) => (
          <div key={i} className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px' }}>
            <div style={{ fontSize: '24px', width: '42px', height: '42px', borderRadius: '12px', background: `${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>{s.label.toUpperCase()}</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: s.color }}>{s.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Map */}
      <div className="glass-panel" style={{ flex: 1, padding: 0, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="live-indicator">● LIVE</span>
          <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{athletes.length} athletes tracked</span>
        </div>
        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} className="map-container" />
        <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }} />
      </div>
    </div>
  );
};
