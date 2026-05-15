import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, Users, ShieldAlert, Network } from 'lucide-react';

const NAV_ITEMS = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/owner/dashboard' },
    { icon: Building2, label: 'Tenants', path: '/owner/white-label' },
    { icon: Users, label: 'Users', path: '/owner/users' },
    { icon: Network, label: 'Departments', path: '/owner/departments' },
    { icon: ShieldAlert, label: 'Security', path: '/owner/anti-cheat' },
];

export const MobileNav: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    return (
        <nav style={{
            display: 'none',
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000,
            background: 'var(--surface)', borderTop: '1px solid var(--border)',
            padding: '8px 4px', height: 64,
            justifyContent: 'space-around', alignItems: 'center',
        }} className="mobile-nav">
            {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.path;
                return (
                    <button key={item.path} onClick={() => navigate(item.path)} style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                        background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
                        color: active ? 'var(--accent)' : 'var(--text-tertiary)', borderRadius: 8,
                        transition: 'color 150ms ease',
                    }}>
                        <Icon size={20} />
                        <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{item.label}</span>
                    </button>
                );
            })}
        </nav>
    );
};
