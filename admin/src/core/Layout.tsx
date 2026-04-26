import { Box, Group, Stack, Text } from '@mantine/core';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { LayoutDashboard, Building2, Users, ShieldAlert, Settings, Square, Gift } from 'lucide-react';
import { useAuth } from './auth/useAuth';
import { motion } from 'framer-motion';

export const Sidebar = ({ mode }: { mode: string }) => {
  const location = useLocation();
  const { user } = useAuth();

  const navItems = [
    { icon: <LayoutDashboard size={18} />, label: 'Dashboard', path: '/admin/dashboard', roles: ['GLOBAL_OWNER', 'TENANT_ADMIN'] },
    { icon: <Building2 size={18} />, label: 'Tenants & Branding', path: '/admin/white-label', roles: ['GLOBAL_OWNER', 'TENANT_ADMIN'] },
    { icon: <Users size={18} />, label: 'Users', path: '/admin/users', roles: ['GLOBAL_OWNER', 'TENANT_ADMIN'] },
    { icon: <ShieldAlert size={18} />, label: 'Anti-Cheat', path: '/admin/anti-cheat', roles: ['GLOBAL_OWNER', 'TENANT_ADMIN', 'TENANT_MODERATOR'] },
    { icon: <Gift size={18} />, label: 'Sponsorship', path: '/admin/sponsor', roles: ['GLOBAL_OWNER', 'SPONSOR'] },
    { icon: <Settings size={18} />, label: 'Settings', path: '/admin/settings', roles: ['GLOBAL_OWNER', 'TENANT_ADMIN'] }
  ];

  const visibleItems = navItems.filter(item => user && item.roles.includes(item.roles.includes(user.role) ? user.role : ''));

  return (
    <Box 
      className="fluent-acrylic" 
      w={260} 
      h="100%" 
      p="md" 
      style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
    >
      <Group mb="xl" px="sm">
        <Box w={32} h={32} bg="var(--color-cyan-main)" style={{ borderRadius: '6px' }} />
        <Stack gap={0}>
          <Text size="sm" fw={800} style={{ letterSpacing: '-0.02em' }}>SPORT OS</Text>
          <Text size="xs" c="dimmed">{mode}</Text>
        </Stack>
      </Group>

      {navItems.filter(item => user && item.roles.includes(user.role)).map((item) => {
        const active = location.pathname === item.path;
        return (
          <Link to={item.path} key={item.label} style={{ textDecoration: 'none', color: 'inherit' }}>
            <Group 
              p="xs" 
              style={{ 
                borderRadius: '6px', 
                cursor: 'pointer',
                background: active ? 'rgba(0, 209, 255, 0.1)' : 'transparent',
                border: active ? '1px solid rgba(0, 209, 255, 0.2)' : '1px solid transparent',
                transition: 'background 0.2s ease'
              }}
            >
              <Box style={{ color: active ? 'var(--color-cyan-main)' : 'rgba(255,255,255,0.6)' }}>
                {item.icon}
              </Box>
              <Text size="sm" fw={active ? 700 : 400}>{item.label}</Text>
            </Group>
          </Link>
        );
      })}
    </Box>
  );
};

export const Layout = () => {
  return (
    <Box style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: '#000' }}>
      <Sidebar mode="PRO EDITION" />
      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', overflow: 'hidden' }}>
        <Box style={{ flex: 1, overflow: 'auto' }}>
          <Outlet />
        </Box>
        <Taskbar />
      </Box>
    </Box>
  );
};

export const Taskbar = () => (
  <Box 
    className="fluent-acrylic" 
    h={48} 
    mx="xl" 
    mt="md"
    style={{ 
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.3)'
    }}
  >
    <Group gap="xs">
      <Box w={28} h={28} bg="var(--color-cyan-main)" style={{ borderRadius: '4px', cursor: 'pointer' }} />
      <Box w={28} h={28} bg="rgba(255,255,255,0.05)" style={{ borderRadius: '4px', cursor: 'pointer' }} />
      <Box w={28} h={28} bg="rgba(255,255,255,0.05)" style={{ borderRadius: '4px', cursor: 'pointer' }} />
    </Group>
    
    <Group gap="md">
      <Text size="xs" ff="monospace" c="dimmed">CPU: 12% | RAM: 1.2GB</Text>
      <Text size="xs" fw={600}>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
    </Group>
  </Box>
);

export const WinWindow = ({ title, children }: { title: string | React.ReactNode; children: React.ReactNode }) => (
  <motion.div
    initial={{ scale: 0.98, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
    style={{ height: '100%', width: '100%' }}
  >
    <Box className="fluent-acrylic" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Group justify="space-between" px="md" py="xs" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.1)', userSelect: 'none' }}>
        <Box style={{ opacity: 0.9 }}>
          {typeof title === 'string' ? (
            <Text size="xs" fw={700} style={{ fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</Text>
          ) : (
            title
          )}
        </Box>
        <Group gap={12}>
          <Box w={12} h={1} bg="white" style={{ cursor: 'pointer', opacity: 0.5 }} />
          <Square size={10} style={{ opacity: 0.5, cursor: 'pointer' }} />
          <Text size="xs" fw={400} style={{ cursor: 'pointer', opacity: 0.5, marginLeft: '4px' }}>✕</Text>
        </Group>
      </Group>
      <Box p="md" style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </Box>
    </Box>
  </motion.div>
);
