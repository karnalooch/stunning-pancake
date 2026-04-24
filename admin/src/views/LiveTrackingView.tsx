import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface Athlete {
  deviceId: string;
  name?: string;
  user_id?: number | null;
  type: string;
  lat: number;
  lng: number;
  speed: number;
  lastUpdate: string;
}

interface WsMessage {
  type: 'position_update' | 'ping';
  device_id?: string;
  user_id?: number | null;
  lat?: number;
  lon?: number;
  speed_ms?: number;
  activity_id?: number | null;
}

const TELEMETRY_WS  = import.meta.env.VITE_TELEMETRY_WS  ?? 'ws://localhost:8001/ws/telemetry/live';
const TELEMETRY_API = import.meta.env.VITE_TELEMETRY_API ?? 'http://localhost:8001/api/telemetry/live';

/**
 * Live Tracking view — MapLibre map with real-time athlete markers,
 * Canvas-based GPU comet trail renderer, and stats overlay.
 *
 * Data source: FastAPI WebSocket (Constitution §24.1) with HTTP fallback.
 */
export const LiveTrackingView = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const mapRef       = useRef<maplibregl.Map | null>(null);
  const markers      = useRef<Record<string, maplibregl.Marker>>({});
  const history      = useRef<Record<string, { pts: [number, number][]; type: string }>>({});
  const animFrame    = useRef<number>(0);
  const wsRef        = useRef<WebSocket | null>(null);

  const [athletes, setAthletes]       = useState<Athlete[]>([]);
  const [lastPoll, setLastPoll]       = useState<string>('—');
  const [wsStatus, setWsStatus]       = useState<'connecting' | 'live' | 'polling'>('connecting');

  // -------------------------------------------------------------------------
  // Athlete state updater
  // -------------------------------------------------------------------------
  const upsertAthlete = useCallback((msg: WsMessage) => {
    if (!msg.device_id || msg.lat == null || msg.lon == null) return;
    const athlete: Athlete = {
      deviceId:   msg.device_id,
      user_id:    msg.user_id,
      type:       'RUN',
      lat:        msg.lat,
      lng:        msg.lon,
      speed:      msg.speed_ms ?? 0,
      lastUpdate: new Date().toLocaleTimeString('pl'),
    };
    setAthletes(prev => {
      const next = prev.filter(a => a.deviceId !== athlete.deviceId);
      return [...next, athlete];
    });
    setLastPoll(new Date().toLocaleTimeString('pl'));

    // Update comet trail
    const entry = history.current[athlete.deviceId] ?? { pts: [], type: athlete.type };
    const pt: [number, number] = [athlete.lng, athlete.lat];
    const last = entry.pts[entry.pts.length - 1];
    if (!last || last[0] !== pt[0] || last[1] !== pt[1]) {
      entry.pts = [...entry.pts, pt].slice(-18);
    }
    history.current[athlete.deviceId] = entry;
  }, []);

  // -------------------------------------------------------------------------
  // WebSocket connection (FastAPI telemetry — Constitution §24.1)
  // -------------------------------------------------------------------------
  useEffect(() => {
    let fallbackTimer: ReturnType<typeof setInterval>;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      setWsStatus('connecting');
      const ws = new WebSocket(TELEMETRY_WS);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus('live');
        clearInterval(fallbackTimer);
      };

      ws.onmessage = (ev) => {
        try {
          const msg: WsMessage = JSON.parse(ev.data as string);
          if (msg.type === 'position_update') upsertAthlete(msg);
        } catch { /* malformed frame */ }
      };

      ws.onclose = () => {
        setWsStatus('polling');
        // Start HTTP fallback (3s polling) while reconnecting
        fallbackTimer = setInterval(async () => {
          try {
            const res = await fetch(TELEMETRY_API);
            if (res.ok) {
              const rows: Array<{ device_id: string; lat: number; lon: number; speed_ms: number }> = await res.json();
              rows.forEach(r => upsertAthlete({
                type: 'position_update',
                device_id: r.device_id,
                lat: r.lat,
                lon: r.lon,
                speed_ms: r.speed_ms,
              }));
            }
          } catch { /* network error */ }
        }, 3000);
        // Reconnect in 5s
        reconnectTimer = setTimeout(connect, 5000);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      wsRef.current?.close();
      clearInterval(fallbackTimer);
      clearTimeout(reconnectTimer);
    };
  }, [upsertAthlete]);


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
    });
    Object.keys(markers.current).forEach((id) => {
      if (!ids.has(id)) { markers.current[id].remove(); delete markers.current[id]; }
    });
  }, [athletes]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'Athletes Online', val: athletes.length, icon: '🏃', color: 'var(--primary)' },
          { label: 'Live Sessions', val: athletes.filter(a => a.speed > 0).length, icon: '📡', color: 'var(--secondary)' },
          { label: 'Avg Speed', val: athletes.length ? `${(athletes.reduce((s, a) => s + a.speed * 3.6, 0) / athletes.length).toFixed(1)} km/h` : '—', icon: '⚡', color: '#ff9500' },
          { label: wsStatus === 'live' ? 'WebSocket LIVE' : wsStatus === 'polling' ? 'HTTP Fallback' : 'Connecting…', val: lastPoll, icon: wsStatus === 'live' ? '🟢' : wsStatus === 'polling' ? '🟡' : '⚪', color: wsStatus === 'live' ? '#92fe9d' : 'var(--text-dim)' },
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
          <span className="live-indicator" style={{ color: wsStatus === 'live' ? undefined : '#ff9500' }}>
            {wsStatus === 'live' ? '● WS LIVE' : wsStatus === 'polling' ? '◌ HTTP POLL' : '○ CONNECTING'}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{athletes.length} athletes tracked</span>
        </div>
        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} className="map-container" />
        <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }} />
      </div>
    </div>
  );
};
