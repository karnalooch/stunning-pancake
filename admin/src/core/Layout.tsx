import { useEffect } from 'react';
import { useDisclosure } from '@mantine/hooks';
import { AppShell, NavLink, Text, Group, Box, Stack, ActionIcon, Avatar, Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { LayoutDashboard, Building2, Users, ShieldAlert, Settings, Gift, LogOut, Menu } from 'lucide-react';
import { useAuth } from './auth/useAuth';
import { setGlobalErrorHandler } from '../api/client';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/owner/dashboard', roles: ['GLOBAL_OWNER', 'TENANT_ADMIN', 'TENANT_MODERATOR'] },
  { icon: Building2, label: 'Tenants & Branding', path: '/owner/white-label', roles: ['GLOBAL_OWNER', 'TENANT_ADMIN'] },
  { icon: Users, label: 'Users', path: '/owner/users', roles: ['GLOBAL_OWNER', 'TENANT_ADMIN'] },
  { icon: ShieldAlert, label: 'Anti-Cheat', path: '/owner/anti-cheat', roles: ['GLOBAL_OWNER', 'TENANT_ADMIN', 'TENANT_MODERATOR'] },
  { icon: Gift, label: 'Sponsorship', path: '/owner/sponsor', roles: ['GLOBAL_OWNER', 'SPONSOR'] },
  { icon: Settings, label: 'Settings', path: '/owner/settings', roles: ['GLOBAL_OWNER', 'TENANT_ADMIN'] },
];

export const Layout = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const userRole = user?.role ?? '';

  useEffect(() => {
    setGlobalErrorHandler((title, msg) => {
      notifications.show({ title, message: msg, color: 'red' });
    });
    return () => setGlobalErrorHandler(() => { });
  }, []);

  const filteredNav = navItems.filter((item) => item.roles.includes(userRole));
  const [opened, { toggle }] = useDisclosure();

  return (
    <AppShell
      navbar={{ width: 250, breakpoint: 'md', collapsed: { mobile: !opened } }}
      header={{ height: 60, collapsed: { desktop: true }, breakpoint: 'md' }}
      padding={0}
      style={{ background: 'var(--surface-secondary)' }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
            <Box w={32} h={32} bg="var(--accent)" style={{ borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Text fw={800} size="sm" c="white">S</Text>
            </Box>
            <Text fw={700} size="sm">4VELO Admin</Text>
          </Group>
          <ActionIcon variant="subtle" onClick={toggle} hiddenFrom="md">
            <Menu size={20} />
          </ActionIcon>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md" data-testid="admin-sidebar" style={{ borderRight: '1px solid var(--border)', background: 'var(--surface)' }}>
        <AppShell.Section>
          <Group gap="xs" mb="xl" px="sm">
            <Box
              w={32}
              h={32}
              bg="var(--accent)"
              style={{ borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text fw={800} size="sm" c="white">S</Text>
            </Box>
            <Stack gap={0}>
              <Text fw={700} size="sm">4VELO</Text>
              <Text size="xs" c="dimmed">Admin Panel</Text>
            </Stack>
          </Group>
        </AppShell.Section>

        <AppShell.Section grow>
          <Stack gap={2}>
            {filteredNav.map((item) => {
              const active = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  component={Link}
                  to={item.path}
                  label={item.label}
                  leftSection={<item.icon size={18} />}
                  active={active}
                  variant="light"
                  color="blue"
                  data-testid={`nav-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`}
                />
              );
            })}
          </Stack>
          <Box hiddenFrom="md" mt="md" pt="md" style={{ borderTop: '1px solid var(--border)' }}>
            <Button fullWidth variant="subtle" onClick={toggle}>Close Menu</Button>
          </Box>
        </AppShell.Section>

        <AppShell.Section>
          <Box py="sm" px="sm" style={{ borderTop: '1px solid var(--border)' }}>
            <Group justify="space-between" align="center">
              <Group gap="xs">
                <Avatar size={28} radius="sm" color="blue">
                  {user?.username?.[0]?.toUpperCase() || 'A'}
                </Avatar>
                <Stack gap={0}>
                  <Text size="xs" fw={600}>{user?.username || 'Admin'}</Text>
                  <Text size="xs" c="dimmed">{userRole.replace('_', ' ')}</Text>
                </Stack>
              </Group>
              <ActionIcon variant="subtle" color="gray" onClick={logout} title="Logout">
                <LogOut size={16} />
              </ActionIcon>
            </Group>
          </Box>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Box p="xl" style={{ height: '100%' }}>
          <Outlet />
        </Box>
      </AppShell.Main>
    </AppShell>
  );
};
