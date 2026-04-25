import { 
  AreaChart, Area, ResponsiveContainer,
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip
} from 'recharts';
import { Shield, Zap, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

const anomalyData = Array.from({ length: 30 }).map((_, i) => ({
  time: i,
  speed: i > 10 && i < 15 ? 120 + Math.random() * 80 : 20 + Math.random() * 10,
}));

const sensorData = Array.from({ length: 40 }).map((_, i) => ({
  time: i,
  x: Math.sin(i * 0.8) * (i > 20 && i < 25 ? 40 : 10),
  y: Math.cos(i * 0.5) * (i > 15 && i < 20 ? 30 : 5),
  z: Math.sin(i * 1.2) * (i > 25 && i < 30 ? 50 : 8),
}));

export const AntiCheatStats = ({ score }: { score: number }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', height: '100%' }}>
      
      {/* Integrity Gauge */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-panel" 
        style={{ padding: '32px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <Shield size={18} color="var(--primary)" />
          <h3 className="text-caption" style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Integrity Score</h3>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '140px', position: 'relative' }}>
          <svg width="200" height="110" viewBox="0 0 180 100">
            <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke="var(--border-glass)" strokeWidth="12" strokeLinecap="round" />
            <path 
              d="M 20 90 A 70 70 0 0 1 160 90" 
              fill="none" 
              stroke="url(#gaugeGrad)" 
              strokeWidth="12" 
              strokeDasharray={`${(score / 100) * 220} 220`}
              strokeLinecap="round" 
              style={{ filter: 'drop-shadow(0 0 8px var(--primary-glow))' }}
            />
            <defs>
              <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--error)" />
                <stop offset="30%" stopColor="var(--warning)" />
                <stop offset="70%" stopColor="var(--primary)" />
                <stop offset="100%" stopColor="var(--secondary)" />
              </linearGradient>
            </defs>
          </svg>
          <div style={{ position: 'absolute', bottom: '10px', textAlign: 'center' }}>
            <span style={{ fontSize: '42px', fontWeight: 900, background: 'linear-gradient(135deg, #fff 0%, var(--text-secondary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{score}%</span>
          </div>
        </div>
      </motion.div>

      {/* Speed Anomaly Area Chart */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <TrendingUp size={18} color="var(--warning)" />
          <h3 className="text-caption" style={{ margin: 0, textTransform: 'uppercase' }}>Speed Analysis</h3>
        </div>
        <div style={{ height: '120px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={anomalyData}>
              <defs>
                <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--warning)" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="var(--warning)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="speed" stroke="var(--warning)" fillOpacity={1} fill="url(#colorSpeed)" strokeWidth={2} />
              <Tooltip contentStyle={{ background: 'var(--bg-deep)', border: '1px solid var(--border-glass)', borderRadius: '12px' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sensor Data Analysis */}
      <div className="glass-panel" style={{ padding: '24px', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <Zap size={18} color="var(--secondary)" />
          <h3 className="text-caption" style={{ margin: 0, textTransform: 'uppercase' }}>Sensor Telemetry</h3>
        </div>
        <div style={{ height: '160px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sensorData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
              <XAxis dataKey="time" hide />
              <YAxis hide domain={[-60, 60]} />
              <Line type="monotone" dataKey="x" stroke="var(--error)" dot={false} strokeWidth={2} isAnimationActive={false} />
              <Line type="monotone" dataKey="y" stroke="var(--primary)" dot={false} strokeWidth={2} isAnimationActive={false} />
              <Line type="monotone" dataKey="z" stroke="var(--secondary)" dot={false} strokeWidth={2} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
