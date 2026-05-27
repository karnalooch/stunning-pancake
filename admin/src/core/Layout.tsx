import { useEffect, useState } from 'react';
import { useDisclosure } from '@mantine/hooks';
import {
  AppShell, Text, Group, Box, Stack, ActionIcon, Avatar, Tooltip,
  useMantineColorScheme, UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Link, useLocation, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Users, ShieldAlert, Settings, Gift, LogOut,
  Menu, ChevronLeft, ChevronRight, Sun, Moon, Zap, Network,
  Calendar, TrendingUp, MessageSquare, Map, Play,
} from 'lucide-react';
import { useAuth } from './auth/useAuth';
import { setGlobalErrorHandler } from '../api/client';

/* ─── Navigation structure ──────────────────────────────── */
const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      {
        icon: LayoutDashboard,
        label: 'Dashboard',
        path: '/owner/dashboard',
        roles: ['GLOBAL_OWNER', 'TENANT_ADMIN', 'TENANT_MODERATOR'],
      },
    ],
  },
  {
    label: 'Management',
    items: [
      {
        icon: Building2,
        label: 'Tenants & Branding',
        path: '/owner/white-label',
        roles: ['GLOBAL_OWNER', 'TENANT_ADMIN'],
      },
      {
        icon: Users,
        label: 'Users',
        path: '/owner/users',
        roles: ['GLOBAL_OWNER', 'TENANT_ADMIN'],
      },
      {
        icon: Network,
        label: 'Departments',
        path: '/owner/departments',
        roles: ['GLOBAL_OWNER', 'TENANT_ADMIN'],
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        icon: Zap,
        label: 'Activities',
        path: '/owner/activities',
        roles: ['GLOBAL_OWNER', 'TENANT_ADMIN', 'TENANT_MODERATOR'],
      },
      {
        icon: ShieldAlert,
        label: 'Anti-Cheat',
        path: '/owner/anti-cheat',
        roles: ['GLOBAL_OWNER', 'TENANT_MODERATOR'],
      },
      {
        icon: Calendar,
        label: 'Events',
        path: '/owner/analytics/events',
        roles: ['GLOBAL_OWNER', 'TENANT_ADMIN', 'TENANT_MODERATOR'],
      },
    ],
  },
  {
    label: 'Sponsorship & Rewards',
    items: [
      {
        icon: Gift,
        label: 'Sponsor Dashboard',
        path: '/owner/sponsor',
        roles: ['GLOBAL_OWNER', 'SPONSOR'],
      },
      {
        icon: TrendingUp,
        label: 'Sponsorship Analytics',
        path: '/owner/analytics/sponsorship',
        roles: ['GLOBAL_OWNER'],
      },
      {
        icon: Gift,
        label: 'Vouchers',
        path: '/owner/analytics/vouchers',
        roles: ['GLOBAL_OWNER'],
      },
    ],
  },
  {
    label: 'Analytics & Feedback',
    items: [
      {
        icon: TrendingUp,
        label: 'Department Analytics',
        path: '/owner/analytics/departments',
        roles: ['GLOBAL_OWNER', 'TENANT_ADMIN'],
      },
      {
        icon: Map,
        label: 'Heatmaps',
        path: '/owner/analytics/heatmaps',
        roles: ['GLOBAL_OWNER', 'TENANT_ADMIN'],
        requiresHeatmapFlag: true,
      },
      {
        icon: MessageSquare,
        label: 'Feedback',
        path: '/owner/analytics/feedback',
        roles: ['GLOBAL_OWNER', 'TENANT_ADMIN'],
      },
      {
        icon: Play,
        label: 'Simulator',
        path: '/owner/analytics/simulator',
        roles: ['GLOBAL_OWNER'],
      },
    ],
  },
  {
    label: 'System',
    items: [
      {
        icon: Settings,
        label: 'Settings',
        path: '/owner/settings',
        roles: ['GLOBAL_OWNER', 'TENANT_ADMIN'],
      },
      {
        icon: ShieldAlert,
        label: 'RBAC Manager',
        path: '/owner/system/rbac',
        roles: ['GLOBAL_OWNER'],
      },
      {
        icon: Zap,
        label: 'Feature Flags',
        path: '/owner/system/feature-flags',
        roles: ['GLOBAL_OWNER'],
      },
      {
        icon: TrendingUp,
        label: 'Leaderboards',
        path: '/owner/system/leaderboards',
        roles: ['GLOBAL_OWNER'],
      },
      {
        icon: Zap,
        label: 'Export Center',
        path: '/owner/system/export',
        roles: ['GLOBAL_OWNER'],
      },
      {
        icon: Zap,
        label: 'API Playground',
        path: '/owner/system/api-playground',
        roles: ['GLOBAL_OWNER'],
      },
    ],
  },
];

/* ─── Role display helpers ──────────────────────────────── */
const ROLE_LABEL: Record<string, string> = {
  GLOBAL_OWNER: 'Global Owner',
  TENANT_ADMIN: 'Tenant Admin',
  TENANT_MODERATOR: 'Moderator',
  SPONSOR: 'Sponsor',
  ATHLETE: 'Athlete',
};

/* ─── Layout component ──────────────────────────────────── */
export const Layout = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const userRole = user?.role ?? '';

  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('admin-sidebar-collapsed') === 'true';
  });
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('admin-sidebar-collapsed', String(next));
  };

  useEffect(() => {
    setGlobalErrorHandler((title, msg) => {
      notifications.show({ title, message: msg, color: 'red' });
    });
    return () => setGlobalErrorHandler(() => { });
  }, []);

  /* Filter nav sections by role and feature flags */
  const hasHeatmap = user?.tenantFlags?.has_heatmap_analytics ?? false;
  const filteredSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (!item.roles.includes(userRole)) return false;
      if ((item as any).requiresHeatmapFlag && !hasHeatmap) return false;
      return true;
    }),
  })).filter((section) => section.items.length > 0);

  const sidebarWidth = collapsed ? 72 : 260;
  const userInitial = user?.username?.[0]?.toUpperCase() ?? 'A';

  return (
    <AppShell
      navbar={{
        width: sidebarWidth,
        breakpoint: 'md',
        collapsed: { mobile: !mobileOpened },
      }}
      header={{ height: 58, collapsed: { desktop: true }, breakpoint: 'md' }}
      padding={0}
      style={{ background: 'var(--surface-secondary)' }}
    >
      {/* ── Mobile top bar ─────────────────────────────── */}
      <AppShell.Header
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
            <Box
              w={30} h={30}
              style={{
                borderRadius: 8,
                background: 'var(--brand-gradient)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Zap size={15} color="white" fill="white" />
            </Box>
            <Text fw={800} size="sm" style={{ color: 'var(--text-primary)' }}>4VELO</Text>
          </Group>
          <ActionIcon variant="subtle" size="lg" onClick={toggleMobile} aria-label="Toggle menu">
            <Menu size={20} />
          </ActionIcon>
        </Group>
      </AppShell.Header>

      {/* ── Sidebar ────────────────────────────────────── */}
      <AppShell.Navbar
        data-testid="admin-sidebar"
        style={{
          borderRight: '1px solid var(--sidebar-border)',
          background: 'var(--sidebar-bg)',
          transition: 'width 220ms cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Brand header */}
        <Box
          style={{
            padding: collapsed ? '14px 0' : '14px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            flexShrink: 0,
          }}
        >
          {collapsed ? (
            <UnstyledButton onClick={toggleCollapsed} style={{ display: 'flex' }}>
              <Box
                w={34} h={34}
                style={{
                  borderRadius: 9,
                  background: 'var(--brand-gradient)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Zap size={16} color="white" fill="white" />
              </Box>
            </UnstyledButton>
          ) : (
            <>
              <Group gap="xs" style={{ overflow: 'hidden' }}>
                <Box
                  w={34} h={34}
                  style={{
                    borderRadius: 9,
                    background: 'var(--brand-gradient)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Zap size={16} color="white" fill="white" />
                </Box>
                <Stack gap={0} style={{ overflow: 'hidden' }}>
                  <Text fw={800} size="sm" lh={1.2} style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    4VELO
                  </Text>
                  <Text size="10px" lh={1.2} style={{ color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                    Admin OS
                  </Text>
                </Stack>
              </Group>
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={toggleCollapsed}
                visibleFrom="md"
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}
              >
                <ChevronLeft size={14} />
              </ActionIcon>
            </>
          )}
        </Box>

        {/* Nav items — scrollable */}
        <Box style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: collapsed ? '8px 6px' : '8px 10px' }}>
          {filteredSections.map((section) => (
            <Box key={section.label} mb="xs">
              {/* Section label */}
              {!collapsed && (
                <Text
                  size="10px"
                  fw={700}
                  tt="uppercase"
                  px="xs"
                  py={6}
                  style={{
                    color: 'var(--text-tertiary)',
                    letterSpacing: '0.08em',
                    userSelect: 'none',
                  }}
                >
                  {section.label}
                </Text>
              )}

              {/* Nav items */}
              <Stack gap={2}>
                {section.items.map((item) => {
                  const active = location.pathname === item.path;
                  const Icon = item.icon;

                  const button = (
                    <UnstyledButton
                      key={item.path}
                      component={Link}
                      to={item.path}
                      data-testid={`nav-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: collapsed ? '9px 8px' : '9px 10px',
                        borderRadius: 8,
                        width: '100%',
                        position: 'relative',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        background: active ? 'var(--accent-light)' : 'transparent',
                        color: active ? 'var(--accent)' : 'var(--text-secondary)',
                        fontWeight: active ? 600 : 500,
                        fontSize: '13.5px',
                        transition: 'background 140ms ease, color 140ms ease',
                        textDecoration: 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!active) {
                          (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-tertiary)';
                          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
                        }
                      }}
                    >
                      {/* Active left bar */}
                      {active && (
                        <Box
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: 3,
                            height: '55%',
                            background: 'var(--accent)',
                            borderRadius: '0 3px 3px 0',
                          }}
                        />
                      )}

                      <Icon
                        size={17}
                        style={{
                          color: active ? 'var(--accent)' : 'currentColor',
                          flexShrink: 0,
                          transition: 'color 140ms ease',
                        }}
                      />

                      {!collapsed && (
                        <Text
                          style={{
                            fontSize: '13.5px',
                            fontWeight: 'inherit',
                            color: 'inherit',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.label}
                        </Text>
                      )}
                    </UnstyledButton>
                  );

                  return collapsed ? (
                    <Tooltip key={item.path} label={item.label} position="right" withArrow>
                      {button}
                    </Tooltip>
                  ) : button;
                })}
              </Stack>
            </Box>
          ))}

          {/* Mobile close */}
          <Box hiddenFrom="md" mt="md" pt="md" style={{ borderTop: '1px solid var(--border)' }}>
            <UnstyledButton
              onClick={toggleMobile}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                textAlign: 'center',
                fontSize: '13px',
                color: 'var(--text-secondary)',
                background: 'var(--surface-tertiary)',
              }}
            >
              Close menu
            </UnstyledButton>
          </Box>
        </Box>

        {/* Footer: theme toggle + user profile */}
        <Box
          style={{
            borderTop: '1px solid var(--border)',
            padding: collapsed ? '10px 6px' : '10px 12px',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {/* Dark / light toggle */}
          {collapsed ? (
            <Tooltip label={isDark ? 'Light mode' : 'Dark mode'} position="right" withArrow>
              <ActionIcon
                variant="subtle"
                size="lg"
                onClick={() => toggleColorScheme()}
                style={{ width: '100%', color: 'var(--text-secondary)' }}
                aria-label="Toggle colour scheme"
              >
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
              </ActionIcon>
            </Tooltip>
          ) : (
            <UnstyledButton
              onClick={() => toggleColorScheme()}
              aria-label="Toggle colour scheme"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 8px',
                borderRadius: 8,
                color: 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: 500,
                transition: 'background 140ms ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-tertiary)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
              <Text style={{ fontSize: '13px', color: 'inherit', whiteSpace: 'nowrap' }}>
                {isDark ? 'Light mode' : 'Dark mode'}
              </Text>
            </UnstyledButton>
          )}

          {/* User profile */}
          <Box
            style={{
              padding: collapsed ? '8px 4px' : '8px 10px',
              borderRadius: 10,
              background: 'var(--surface-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'space-between',
              gap: 8,
            }}
          >
            <Group gap={8} style={{ overflow: 'hidden', minWidth: 0 }}>
              <Avatar
                size={28}
                radius="md"
                style={{
                  background: 'var(--brand-gradient)',
                  flexShrink: 0,
                }}
              >
                <Text size="xs" fw={700} c="white">{userInitial}</Text>
              </Avatar>

              {!collapsed && (
                <Stack gap={0} style={{ overflow: 'hidden' }}>
                  <Text
                    size="xs"
                    fw={600}
                    style={{
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {user?.username ?? 'Admin'}
                  </Text>
                  <Text
                    size="10px"
                    style={{
                      color: 'var(--text-tertiary)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {ROLE_LABEL[userRole] ?? userRole.replace(/_/g, ' ')}
                  </Text>
                </Stack>
              )}
            </Group>

            {!collapsed && (
              <Tooltip label="Log out" position="top" withArrow>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  onClick={logout}
                  aria-label="Logout"
                  style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}
                >
                  <LogOut size={14} />
                </ActionIcon>
              </Tooltip>
            )}
          </Box>

          {collapsed && (
            <Tooltip label="Log out" position="right" withArrow>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="md"
                onClick={logout}
                aria-label="Logout"
                style={{ width: '100%', color: 'var(--text-tertiary)' }}
              >
                <LogOut size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Box>
      </AppShell.Navbar>

      {/* ── Main content ───────────────────────────────── */}
      <AppShell.Main>
        <Box
          p={{ base: 'md', md: 'xl' }}
          style={{ minHeight: '100%', background: 'var(--surface-secondary)' }}
        >
          <Outlet />
        </Box>
      </AppShell.Main>
    </AppShell>
  );
};