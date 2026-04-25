import { Search, Bell, Settings } from 'lucide-react';

interface TopBarProps {
  userRole: string;
  userName: string;
  appTitle?: string;
  onSearch?: (query: string) => void;
}

/** Top navigation bar with global search and user profile. */
export const TopBar = ({ userRole, userName, appTitle, onSearch }: TopBarProps) => {
  const initials = userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <header className="admin-header">
      {/* Left: Branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '48px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ 
            width: '36px', height: '36px', 
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))', 
            borderRadius: '10px',
            boxShadow: '0 0 15px var(--primary-glow)'
          }}></div>
          <span style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-1.5px' }}>SPORT</span>
        </div>
        
        <div className="text-caption" style={{ color: 'var(--text-muted)', borderLeft: '1px solid var(--border-glass)', paddingLeft: '24px' }}>
          {appTitle || 'ADMIN PANEL'}
        </div>
      </div>

      {/* Center: search */}
      <div className="search-container" style={{ flex: 1, maxWidth: '400px' }}>
        <Search size={18} style={{ position: 'absolute', left: '16px', top: '12px', color: 'var(--text-muted)' }} />
        <input
          id="admin-global-search"
          type="text"
          placeholder="Search activities, athletes, zones..."
          onChange={(e) => onSearch?.(e.target.value)}
          className="search-input"
          style={{ width: '100%' }}
        />
      </div>

      {/* Right: user profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
        <div style={{ display: 'flex', gap: '20px', color: 'var(--text-muted)' }}>
          <Bell size={20} className="glow-on-hover" style={{ cursor: 'pointer' }} />
          <Settings size={20} className="glow-on-hover" style={{ cursor: 'pointer' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>{userName}</div>
            <div className="text-caption" style={{ fontSize: '11px' }}>{userRole.replace('_', ' ')}</div>
          </div>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '15px', fontWeight: 800, color: 'var(--primary)',
            flexShrink: 0,
            cursor: 'pointer'
          }} className="glow-on-hover">{initials}</div>
        </div>
      </div>
    </header>
  );
};
