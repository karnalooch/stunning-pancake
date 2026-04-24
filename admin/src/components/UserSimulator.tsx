import React, { useState, useEffect, useRef } from 'react';
import './UserSimulator.css';

interface VirtualAthlete {
  id: string;
  name: string;
  type: 'RUN' | 'bicycle';
}

const ATHLETES: VirtualAthlete[] = [
  { id: 'sim_001', name: 'Virtual Runner (Pro)', type: 'RUN' },
  { id: 'sim_002', name: 'Virtual Cyclist (MTB)', type: 'bicycle' },
  { id: 'sim_003', name: 'Chaos Bot (Testing)', type: 'RUN' },
];

/**
 * User Simulator Plugin — SPORT Platform
 * Allows simulating mobile app behavior directly from the Admin/Moderator dashboard.
 */
export const UserSimulator: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAthlete, setSelectedAthlete] = useState<VirtualAthlete>(ATHLETES[0]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentPos, setCurrentPos] = useState({ lat: 52.1685, lon: 22.2874 });
  const [speed, setSpeed] = useState(0);
  const timerRef = useRef<any>(null);

  // Simulation loop
  useEffect(() => {
    if (isSimulating) {
      let angle = 0;
      const baseLat = 52.1685 + (Math.random() - 0.5) * 0.01;
      const baseLon = 22.2874 + (Math.random() - 0.5) * 0.01;
      
      timerRef.current = setInterval(() => {
        angle += 0.05;
        const newLat = baseLat + Math.sin(angle) * 0.002;
        const newLon = baseLon + Math.cos(angle) * 0.002;
        
        const currentSpeed = selectedAthlete.type === 'bicycle' ? 22 + Math.random() * 5 : 9 + Math.random() * 2;
        
        setCurrentPos({ lat: newLat, lon: newLon });
        setSpeed(currentSpeed);

        // Send to Telemetry Service
        fetch('http://localhost:8001/api/telemetry/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            device_id: selectedAthlete.id,
            lat: newLat,
            lon: newLon,
            speed_ms: currentSpeed / 3.6,
            activity_type: selectedAthlete.type,
            timestamp: Date.now() / 1000
          })
        }).catch(err => console.error("Sim error", err));

      }, 2000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isSimulating, selectedAthlete]);

  const triggerAnomaly = (type: 'speed' | 'teleport' | 'offroad') => {
    let lat = currentPos.lat;
    let lon = currentPos.lon;
    let s = speed;

    if (type === 'speed') s = 150; // Super fast
    if (type === 'teleport') { lat += 0.05; lon += 0.05; } // Jump 5km
    
    fetch('http://localhost:8001/api/telemetry/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: selectedAthlete.id,
        lat: lat,
        lon: lon,
        speed_ms: s / 3.6,
        activity_type: selectedAthlete.type,
        timestamp: Date.now() / 1000
      })
    });
    alert(`Anomaly [${type}] triggered for ${selectedAthlete.name}`);
  };

  if (!isOpen) {
    return (
      <button className="sim-fab" onClick={() => setIsOpen(true)}>
        📱 Sim
      </button>
    );
  }

  return (
    <div className="sim-drawer glass-panel">
      <div className="sim-header">
        <h3>User Simulator</h3>
        <button onClick={() => setIsOpen(false)}>×</button>
      </div>

      <div className="sim-body">
        <label>Select Athlete</label>
        <select 
          value={selectedAthlete.id} 
          onChange={(e) => {
            const a = ATHLETES.find(x => x.id === e.target.value);
            if (a) setSelectedAthlete(a);
          }}
          disabled={isSimulating}
        >
          {ATHLETES.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
        </select>

        <div className="sim-controls">
          {!isSimulating ? (
            <button className="btn-start" onClick={() => setIsSimulating(true)}>START SESSION</button>
          ) : (
            <button className="btn-stop" onClick={() => setIsSimulating(false)}>STOP SESSION</button>
          )}
        </div>

        {isSimulating && (
          <div className="sim-stats">
            <div className="stat-item"><span>LAT:</span> {currentPos.lat.toFixed(5)}</div>
            <div className="stat-item"><span>LON:</span> {currentPos.lon.toFixed(5)}</div>
            <div className="stat-item"><span>SPEED:</span> {speed.toFixed(1)} km/h</div>
          </div>
        )}

        <div className="sim-anomalies">
          <label>Trigger Anomaly (Anti-Cheat Test)</label>
          <div className="anomaly-grid">
            <button onClick={() => triggerAnomaly('speed')}>🚀 Warp Speed</button>
            <button onClick={() => triggerAnomaly('teleport')}>🌌 Teleport</button>
            <button onClick={() => triggerAnomaly('offroad')}>🌲 Off-road</button>
          </div>
        </div>
      </div>
    </div>
  );
};
