interface TopBarProps {
  userRole: string;
  userName: string;
  onSearch?: (query: string) => void;
}

/** Top navigation bar with global search and user profile. */
export const TopBar = ({ userRole, userName, onSearch }: TopBarProps) => {
  const initials = userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <header id="admin-topbar" style={{
      height: '64px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      background: 'var(--bg-card)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      {/* Left: breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-1px' }}>SPORT</span>
        <span style={{ color: 'var(--border)', fontSize: '18px' }}>/</span>
        <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Admin Portal</span>
      </div>

      {/* Center: search */}
      <div style={{ flex: 1, maxWidth: '380px', margin: '0 32px' }}>
        <input
          id="admin-global-search"
          type="text"
          placeholder="Szukaj atletów, eventów, miast..."
          onChange={(e) => onSearch?.(e.target.value)}
          style={{
            width: '100%',
            padding: '9px 16px',
            background: 'var(--bg-deep)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            color: '#fff',
            fontSize: '13px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Right: user profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{userName}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{userRole.replace('_', ' ')}</div>
        </div>
        <div style={{
          width: '38px', height: '38px', borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '14px', fontWeight: 700, color: '#0a0e1a',
          flexShrink: 0,
        }}>{initials}</div>
      </div>
    </header>
  );
};
