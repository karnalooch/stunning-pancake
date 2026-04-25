import { Box, Group, Stack, Text } from '@mantine/core';
import { Link, useLocation } from 'react-router-dom';

export const Sidebar = ({ mode }: { mode: string }) => {
  const location = useLocation();

  const navItems = [
    { icon: '📊', label: 'Dashboard', path: '/' },
    { icon: '🏢', label: 'Tenants', path: '/tenants' },
    { icon: '👥', label: 'Users', path: '/users' },
    { icon: '🛡️', label: 'Anti-Cheat', path: '/anti-cheat' },
    { icon: '⚙️', label: 'Settings', path: '/settings' }
  ];

  return (
    <Box 
      className="fluent-acrylic" 
      w={260} 
      h="100%" 
      p="md" 
      style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
    >
      <Group mb="xl" px="sm">
        <Box w={32} h={32} bg="var(--color-win-accent-dark)" style={{ borderRadius: '6px' }} />
        <Stack gap={0}>
          <Text size="sm" fw={800} style={{ letterSpacing: '-0.02em' }}>SPORT OS</Text>
          <Text size="xs" c="dimmed">{mode}</Text>
        </Stack>
      </Group>

      {navItems.map((item) => {
        const active = location.pathname === item.path;
        return (
          <Link to={item.path} key={item.label} style={{ textDecoration: 'none', color: 'inherit' }}>
            <Group 
              p="xs" 
              style={{ 
                borderRadius: '6px', 
                cursor: 'pointer',
                background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: active ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
                transition: 'background 0.2s ease'
              }}
            >
              <Text size="lg">{item.icon}</Text>
              <Text size="sm" fw={active ? 600 : 400}>{item.label}</Text>
            </Group>
          </Link>
        );
      })}
    </Box>
  );
};

export const Taskbar = () => (
  <Box 
    className="fluent-acrylic" 
    h={48} 
    mx="xl" 
    mb="md"
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
      <Box w={28} h={28} bg="var(--color-win-accent-dark)" style={{ borderRadius: '4px', cursor: 'pointer' }} />
      <Box w={28} h={28} bg="rgba(255,255,255,0.05)" style={{ borderRadius: '4px', cursor: 'pointer' }} />
      <Box w={28} h={28} bg="rgba(255,255,255,0.05)" style={{ borderRadius: '4px', cursor: 'pointer' }} />
    </Group>
    
    <Group gap="md">
      <Text size="xs" ff="monospace" c="dimmed">CPU: 12% | RAM: 1.2GB</Text>
      <Text size="xs" fw={600}>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
    </Group>
  </Box>
);

export const WinWindow = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Box className="fluent-acrylic" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
    <Group justify="space-between" px="md" py="xs" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', userSelect: 'none' }}>
      <Text size="xs" fw={600} style={{ fontFamily: 'var(--font-segoe)', opacity: 0.8 }}>{title}</Text>
      <Group gap={8}>
        <Box w={12} h={2} bg="dimmed" style={{ cursor: 'pointer' }} />
        <Box w={10} h={10} style={{ border: '1px solid var(--mantine-color-dimmed)', cursor: 'pointer' }} />
        <Text size="sm" style={{ cursor: 'pointer' }}>✕</Text>
      </Group>
    </Group>
    <Box p="md" style={{ flex: 1, overflow: 'auto' }}>
      {children}
    </Box>
  </Box>
);
