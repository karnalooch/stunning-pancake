import { 
  Activity, 
  Trophy, 
  Users, 
  Search, 
  ShieldCheck, 
  BarChart3 
} from 'lucide-react';

export type ViewId = 'live' | 'events' | 'clubs' | 'anticheat' | 'analytics' | 'moderator';

export interface NavItem {
  id: ViewId;
  label: string;
  icon: any;
  /** Roles that can see this nav item. Empty = visible to all. */
  allowedRoles?: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'live',      label: 'Live',       icon: Activity },
  { id: 'events',    label: 'Events',     icon: Trophy },
  { id: 'clubs',     label: 'Clubs',      icon: Users },
  { id: 'anticheat', label: 'Anti-Cheat', icon: Search,      allowedRoles: ['GLOBAL_ADMIN', 'LOCAL_ADMIN', 'MODERATOR'] },
  { id: 'moderator', label: 'Moderator',  icon: ShieldCheck, allowedRoles: ['GLOBAL_ADMIN', 'MODERATOR'] },
  { id: 'analytics', label: 'Analytics',  icon: BarChart3,   allowedRoles: ['GLOBAL_ADMIN', 'LOCAL_ADMIN'] },
];

interface SidebarProps {
  activeView: ViewId;
  onViewChange: (view: ViewId) => void;
  userRole: string;
}

/**
 * Modular Sidebar — dynamically renders nav items based on user RBAC role.
 */
export const Sidebar = ({ activeView, onViewChange, userRole }: SidebarProps) => {
  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.allowedRoles || item.allowedRoles.includes(userRole)
  );

  return (
    <aside id="admin-sidebar" style={{
      width: '80px',
      background: 'rgba(11, 14, 20, 0.4)',
      borderRight: '1px solid var(--border-glass)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: '24px',
      gap: '12px',
      flexShrink: 0,
      backdropFilter: 'blur(var(--blur))'
    }}>
      {visibleItems.map((item) => {
        const isActive = activeView === item.id;
        const Icon = item.icon;
        
        return (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            title={item.label}
            onClick={() => onViewChange(item.id)}
            style={{
              width: '56px', height: '56px',
              borderRadius: '16px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '4px',
              background: isActive
                ? 'rgba(0, 209, 255, 0.1)'
                : 'transparent',
              border: isActive 
                ? '1px solid var(--border-active)' 
                : '1px solid transparent',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              color: isActive ? 'var(--primary)' : 'var(--text-muted)',
            }}
            className="glow-on-hover"
          >
            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
            <span style={{ 
              fontSize: '9px', 
              fontWeight: 800, 
              letterSpacing: '0.5px',
              textTransform: 'uppercase'
            }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </aside>
  );
};
