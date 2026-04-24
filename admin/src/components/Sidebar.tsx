export type ViewId = 'live' | 'events' | 'clubs' | 'anticheat' | 'analytics';

export interface NavItem {
  id: ViewId;
  label: string;
  icon: string;
  /** Roles that can see this nav item. Empty = visible to all. */
  allowedRoles?: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'live',      label: 'Live Tracking', icon: '📡' },
  { id: 'events',    label: 'Events',        icon: '🏆' },
  { id: 'clubs',     label: 'Clubs',         icon: '🛡️' },
  { id: 'anticheat', label: 'Anti-Cheat',    icon: '🔍', allowedRoles: ['GLOBAL_ADMIN', 'LOCAL_MODERATOR', 'OWNER'] },
  { id: 'analytics', label: 'Analytics',     icon: '📊', allowedRoles: ['GLOBAL_ADMIN', 'OWNER'] },
];

interface SidebarProps {
  activeView: ViewId;
  onViewChange: (view: ViewId) => void;
  userRole: string;
}

/**
 * Modular Sidebar — dynamically renders nav items based on user RBAC role.
 * New modules register here by adding an entry to NAV_ITEMS.
 */
export const Sidebar = ({ activeView, onViewChange, userRole }: SidebarProps) => {
  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.allowedRoles || item.allowedRoles.includes(userRole)
  );

  return (
    <aside id="admin-sidebar" style={{
      width: '72px',
      background: 'var(--bg-card)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: '20px',
      gap: '8px',
      flexShrink: 0,
    }}>
      {/* Logo mark */}
      <div style={{
        width: '42px', height: '42px', borderRadius: '12px',
        background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '18px', fontWeight: 800, color: '#fff',
        marginBottom: '24px', flexShrink: 0,
      }}>S</div>

      {visibleItems.map((item) => {
        const isActive = activeView === item.id;
        return (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            title={item.label}
            onClick={() => onViewChange(item.id)}
            style={{
              width: '52px', height: '52px',
              borderRadius: '14px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '3px', fontSize: '20px',
              background: isActive
                ? 'rgba(0, 210, 255, 0.15)'
                : 'transparent',
              outline: isActive
                ? '1px solid rgba(0, 210, 255, 0.4)'
                : '1px solid transparent',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
            }}
            onMouseLeave={(e) => {
              if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            <span>{item.icon}</span>
            <span style={{ fontSize: '8px', color: isActive ? 'var(--primary)' : 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.3px' }}>
              {item.label.split(' ')[0].toUpperCase()}
            </span>
          </button>
        );
      })}
    </aside>
  );
};
