import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SimpleGrid, Card, Text, Group, Badge, Progress, Table, Box, Stack,
  Skeleton, Divider, ThemeIcon, Alert,
} from '@mantine/core';
import { motion } from 'framer-motion';
import {
  Users, Activity, Gauge, ShieldCheck, TrendingUp, Brain,
  Map, CheckCircle2, AlertTriangle, Radio, PauseCircle, Route,
} from 'lucide-react';
import { notifications } from '@mantine/notifications';
import { apiClient } from '../../api/client';
import { PageHeader } from '../../core/components/PageHeader';
import { StatCard } from '../../core/components/StatCard';
import { useAuth } from '../../core/auth/useAuth';
import { isE2eMode } from '../../core/auth/e2eEnv';
import { ModeratorWorklist } from './ModeratorWorklist';
import { CityAnalytics } from '../analytics/CityAnalytics';
const LiveMapLazy = lazy(() => import('../analytics/live-map/LiveMap').then(m => ({ default: m.LiveMap })));
const SystemIntelligenceLazy = lazy(() =>
  import('../analytics/SystemIntelligence').then(m => ({ default: m.SystemIntelligence })),
);
const ActivityTimelineLazy = lazy(() =>
  import('../analytics/ActivityTimeline').then(m => ({ default: m.ActivityTimeline })),
);
const AuditLogLazy = lazy(() => import('../analytics/AuditLog').then(m => ({ default: m.AuditLog })));
const TrendAnalysisLazy = lazy(() =>
  import('../analytics/TrendAnalysis').then(m => ({ default: m.TrendAnalysis })),
);
const SystemHealthLazy = lazy(() =>
  import('../analytics/SystemHealth').then(m => ({ default: m.SystemHealth })),
);
import { GoHealthStrip } from '../../core/components/GoHealthStrip';
import { DataSourceBanner } from '../../core/components/DataSourceBanner';
import { TenantScopeBanner } from '../../core/components/TenantScopeBanner';
import { TenantAdminQuickActions } from '../../core/components/TenantAdminQuickActions';
import { useTenantScope } from '../../hooks/useTenantScope';
import { TenantDrillDownMenu } from '../../core/components/TenantDrillDownMenu';
import { tenantUsersUrl } from '../../utils/tenantDrillDown';
import {
  DashboardBootOverlay,
  type DashboardBootStep,
} from '../../core/components/DashboardBootOverlay';

/* ─── Types ─────────────────────────────────────────────── */
interface TenantRow {
  tenant_id: string;
  tenant_name: string;
  users: number;
  activities: number;
  distance_km: number;
  verified_pct: number;
  primary_color: string;
  secondary_color: string;
}

interface SimKpi {
  sim_on: boolean;
  live_running: boolean;
  batch_running: boolean;
  batch_phase?: string;
  currently_riding: number;
  ride_warming: number;
  ride_routing: number;
  ride_routed?: number;
  ride_active?: number;
  async_routing_enabled: boolean;
  routing_queue_depth: number;
  routing_backpressure_active: boolean;
  dispatches_throttled: boolean;
  max_routing_queue_depth?: number | null;
  tick_stale?: boolean;
}

interface DashboardStats {
  total_users: number;
  total_activities: number;
  total_distance_km: number;
  total_calories: number;
  new_users_last_7d: number;
  new_activities_last_7d: number;
  verified_total: number;
  verified_pct: number;
  unverified_total: number;
  per_tenant: TenantRow[];
  stale?: boolean;
  batch_running?: boolean;
  sim_kpi?: SimKpi;
  data_source?: 'production' | 'sim-lab';
  synthetic?: boolean;
  federation_fallback?: boolean;
  sim_lab_label?: string;
  scoped_tenant_id?: string | null;
  per_department?: Array<{
    department_id: number;
    department_name: string;
    users: number;
    activities: number;
    distance_km: number;
    verified_pct: number;
  }>;
}

/* ─── Animation variants ────────────────────────────────── */
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

const rowVariants = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3 } },
};

/* ─── Tenant health badge ────────────────────────────────── */
const HealthBadge: React.FC<{ pct: number }> = ({ pct }) => {
  if (pct >= 80) return <Badge size="xs" color="green" variant="light" radius="sm">Healthy</Badge>;
  if (pct >= 50) return <Badge size="xs" color="yellow" variant="light" radius="sm">Review</Badge>;
  return <Badge size="xs" color="red" variant="light" radius="sm">Critical</Badge>;
};

/* ─── Section header ─────────────────────────────────────── */
const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; badge?: string; badgeColor?: string }> = ({
  icon, title, badge, badgeColor = 'indigo',
}) => (
  <Group mb="md" gap="sm">
    <Box style={{ color: 'var(--accent)' }}>{icon}</Box>
    <Text fw={700} size="sm" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
      {title}
    </Text>
    {badge && (
      <Badge size="xs" color={badgeColor} variant="light" radius="sm">
        {badge}
      </Badge>
    )}
  </Group>
);

/* ─── Dashboard ─────────────────────────────────────────── */
export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiLatencyMs, setApiLatencyMs] = useState<number | null>(null);
  const [bootOverlayVisible, setBootOverlayVisible] = useState(false);
  const [bootStep, setBootStep] = useState<DashboardBootStep>('session');
  const [bootElapsedMs, setBootElapsedMs] = useState(0);
  const [heavyWidgetsReady, setHeavyWidgetsReady] = useState(false);
  const loadStarted = useRef(0);

  const isGlobalOwner = user?.role === 'GLOBAL_OWNER';
  const isTenantAdmin = user?.role === 'TENANT_ADMIN';
  const isModerator = user?.role === 'TENANT_MODERATOR';
  const tenantScope = useTenantScope(stats);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setHeavyWidgetsReady(true);
      return;
    }
    setHeavyWidgetsReady(false);
    setBootOverlayVisible(false);
    setBootStep('session');
    loadStarted.current = performance.now();
    apiClient.get('/activities/admin/stats/')
      .then((res) => {
        setStats(res.data);
        setApiLatencyMs(Math.round(performance.now() - loadStarted.current));
      })
      .catch(() =>
        notifications.show({ title: 'Dashboard', message: 'Failed to load stats.', color: 'red' }),
      )
      .finally(() => setLoading(false));
  }, [user]);

  /* Delayed boot overlay — avoids flash on fast cache hits (enterprise pattern). */
  useEffect(() => {
    if (!isGlobalOwner || !loading) return;
    const showTimer = window.setTimeout(() => setBootOverlayVisible(true), 450);
    const stepTimer = window.setTimeout(() => setBootStep('metrics'), 180);
    const elapsedTimer = window.setInterval(() => {
      setBootElapsedMs(Math.round(performance.now() - loadStarted.current));
    }, 400);
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(stepTimer);
      window.clearInterval(elapsedTimer);
    };
  }, [isGlobalOwner, loading]);

  useEffect(() => {
    if (!isGlobalOwner) {
      if (!loading) setHeavyWidgetsReady(true);
      return;
    }
    if (loading) return;
    setBootStep('widgets');
    if (!bootOverlayVisible) {
      setHeavyWidgetsReady(true);
      return;
    }
    const hideTimer = window.setTimeout(() => {
      setBootOverlayVisible(false);
      window.setTimeout(() => setHeavyWidgetsReady(true), 160);
    }, 420);
    return () => window.clearTimeout(hideTimer);
  }, [loading, isGlobalOwner, bootOverlayVisible]);

  const showGlobalBoot = isGlobalOwner && (loading || bootOverlayVisible);
  const kpiLoading = loading && !showGlobalBoot;

  const drillDownTenant = (tenantId: string, tenantName?: string) => {
    navigate(tenantUsersUrl(tenantId, tenantName));
  };

  /* ── Greeting ────────────────────────────────────────── */
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  /* ── Simulator / data-source signals ──────────────────── */
  const isSyntheticKpi = stats?.data_source === 'sim-lab' || Boolean(stats?.synthetic);
  const simulatorBadge = isSyntheticKpi
    ? { text: `Synthetic KPIs (${stats?.sim_lab_label ?? 'sim-lab'})`, color: 'orange' as const }
    : stats?.batch_running
      ? { text: 'Simulator running (prod KPIs may be stale)', color: 'orange' as const }
      : stats?.federation_fallback
        ? { text: 'Sim-lab federation fallback', color: 'yellow' as const }
        : stats?.stale
          ? { text: 'Stale KPIs (served from cache)', color: 'yellow' as const }
          : null;

  return (
    <Box>
      {/* ── Page header ──────────────────────────────── */}
      <PageHeader
        title={
          isGlobalOwner
            ? `${greeting}, ${user?.username ?? 'Owner'} 👋`
            : `${greeting}, ${user?.username ?? 'Admin'}`
        }
        subtitle={
          isGlobalOwner
            ? 'Global platform overview — all tenants combined'
            : tenantScope.tenantName
              ? `City dashboard — ${tenantScope.tenantName}`
              : `City dashboard — ${tenantScope.tenantId ?? 'your instance'}`
        }
      >
        {simulatorBadge && (
          <Badge size="sm" color={simulatorBadge.color} variant="light">
            {simulatorBadge.text}
          </Badge>
        )}
      </PageHeader>

      {isModerator && (
        <TenantScopeBanner
          tenantId={tenantScope.tenantId}
          tenantName={tenantScope.tenantName}
          roleLabel="Moderator"
        />
      )}

      {isTenantAdmin && (
        <>
          <TenantScopeBanner
            tenantId={tenantScope.tenantId}
            tenantName={tenantScope.tenantName}
            roleLabel="Tenant Admin"
          />
          <TenantAdminQuickActions
            tenantId={tenantScope.tenantId}
            pendingReview={stats?.unverified_total}
          />
        </>
      )}

      {isGlobalOwner && (
        <>
          <DataSourceBanner
            dataSource={stats?.data_source}
            synthetic={stats?.synthetic}
            federationFallback={stats?.federation_fallback}
            simLabLabel={stats?.sim_lab_label}
          />
          <GoHealthStrip
            loading={loading}
            unverifiedTotal={stats?.unverified_total}
            simOn={Boolean(stats?.sim_kpi?.sim_on)}
            routingQueueDepth={stats?.sim_kpi?.routing_queue_depth}
            routingBackpressure={Boolean(stats?.sim_kpi?.routing_backpressure_active)}
            maxRoutingQueueDepth={stats?.sim_kpi?.max_routing_queue_depth}
            apiLatencyMs={apiLatencyMs}
            dataSource={stats?.data_source}
            synthetic={stats?.synthetic}
            federationFallback={stats?.federation_fallback}
            dataStale={Boolean(stats?.stale)}
          />
        </>
      )}

      <Box style={{ position: 'relative', minHeight: showGlobalBoot ? 420 : undefined }}>
        {isGlobalOwner && (
          <DashboardBootOverlay
            visible={showGlobalBoot}
            step={bootStep}
            elapsedMs={bootElapsedMs}
            activityCount={stats?.total_activities}
          />
        )}

        <Box
          style={{
            opacity: showGlobalBoot ? 0 : 1,
            pointerEvents: showGlobalBoot ? 'none' : 'auto',
            transition: 'opacity 0.32s ease',
          }}
        >
      {/* ── KPI stat cards ────────────────────────────── */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="xl" spacing="md">
        <StatCard
          index={0}
          icon={<Users size={18} />}
          label={isTenantAdmin ? 'Athletes (your tenant)' : 'Total Athletes'}
          value={stats ? stats.total_users.toLocaleString() : null}
          variant="indigo"
          loading={kpiLoading}
          trend={
            stats
              ? {
                value: `${stats.new_users_last_7d.toLocaleString()}`,
                direction: stats.new_users_last_7d > 0 ? 'up' : 'flat',
                label: 'new last 7d',
              }
              : undefined
          }
        />
        <StatCard
          index={1}
          icon={<Activity size={18} />}
          label="Total Activities"
          value={stats ? stats.total_activities.toLocaleString() : null}
          variant="green"
          loading={kpiLoading}
          trend={
            stats
              ? {
                value: `${stats.new_activities_last_7d.toLocaleString()}`,
                direction: stats.new_activities_last_7d > 0 ? 'up' : 'flat',
                label: 'new last 7d',
              }
              : undefined
          }
        />
        <StatCard
          index={2}
          icon={<Gauge size={18} />}
          label="Total Distance"
          value={stats ? `${stats.total_distance_km.toFixed(1)} km` : null}
          variant="violet"
          loading={kpiLoading}
        />
        <StatCard
          index={3}
          icon={<ShieldCheck size={18} />}
          label="Verification Rate"
          value={stats ? `${stats.verified_pct}%` : null}
          variant={stats && stats.unverified_total > 10 ? 'orange' : 'green'}
          loading={kpiLoading}
          trend={
            stats
              ? {
                value: `${stats.unverified_total.toLocaleString()}`,
                direction: stats.unverified_total > 10 ? 'down' : 'flat',
                label: 'pending review (total)',
              }
              : undefined
          }
        />
      </SimpleGrid>

      {/* ── Live simulator KPI (platform — not athlete DB counts) ── */}
      {isGlobalOwner && stats?.sim_kpi && (
        <Card
          mb="xl"
          style={{
            background: 'var(--surface)',
            border: `1px solid ${stats.sim_kpi.sim_on ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 14,
            padding: '18px 22px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <SectionHeader
            icon={<Radio size={16} />}
            title="Live Simulator"
            badge={stats.sim_kpi.sim_on ? 'ON' : 'OFF'}
            badgeColor={stats.sim_kpi.sim_on ? 'green' : 'gray'}
          />
          <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="md">
            <Stack gap={2}>
              <Text size="xs" c="dimmed">State</Text>
              <Group gap={6}>
                {stats.sim_kpi.live_running ? (
                  <Badge color="green" variant="light" leftSection={<Radio size={12} />}>Running</Badge>
                ) : stats.sim_kpi.batch_running ? (
                  <Badge color="orange" variant="light">Batch {stats.sim_kpi.batch_phase}</Badge>
                ) : (
                  <Badge color="gray" variant="light" leftSection={<PauseCircle size={12} />}>Idle</Badge>
                )}
              </Group>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">On map</Text>
              <Text fw={700} ff="monospace">{stats.sim_kpi.currently_riding}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">Warming</Text>
              <Text fw={700} ff="monospace" c={stats.sim_kpi.ride_warming > 0 ? 'orange' : undefined}>
                {stats.sim_kpi.ride_warming}
              </Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">Routing</Text>
              <Text fw={700} ff="monospace">{stats.sim_kpi.ride_routing}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">Async routing</Text>
              <Badge size="sm" color={stats.sim_kpi.async_routing_enabled ? 'teal' : 'gray'} variant="light">
                {stats.sim_kpi.async_routing_enabled ? 'ON' : 'OFF'}
              </Badge>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">Queue depth</Text>
              <Group gap={6}>
                <ThemeIcon size={22} variant="light" color="violet">
                  <Route size={14} />
                </ThemeIcon>
                <Text fw={700} ff="monospace">{stats.sim_kpi.routing_queue_depth}</Text>
                {stats.sim_kpi.routing_backpressure_active && (
                  <Badge size="xs" color="red" variant="filled">Backpressure</Badge>
                )}
                {stats.sim_kpi.dispatches_throttled && !stats.sim_kpi.routing_backpressure_active && (
                  <Badge size="xs" color="yellow" variant="light">Throttled</Badge>
                )}
              </Group>
            </Stack>
          </SimpleGrid>
          {stats.sim_kpi.tick_stale && stats.sim_kpi.live_running && (
            <Text size="xs" c="orange" mt="sm">
              Live ticks stale — check celery-worker-simulation or use simulator-reset.
            </Text>
          )}
        </Card>
      )}

      {/* ── Global Owner: per-tenant table ────────────── */}
      {isGlobalOwner && Array.isArray(stats?.per_tenant) && stats.per_tenant.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          <Card
            mb="xl"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: '22px 24px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <SectionHeader
              icon={<TrendingUp size={16} />}
              title="Per-Tenant Breakdown"
              badge={`${stats.per_tenant.length} tenants`}
            />
            <Divider mb="md" style={{ borderColor: 'var(--border)' }} />

            {loading ? (
              <Stack gap="sm">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} height={42} radius="md" />
                ))}
              </Stack>
            ) : (
              <motion.div variants={containerVariants} initial="hidden" animate="show">
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Tenant</Table.Th>
                      <Table.Th>Users</Table.Th>
                      <Table.Th>Activities</Table.Th>
                      <Table.Th>Distance</Table.Th>
                      <Table.Th>Verified</Table.Th>
                      <Table.Th>Health</Table.Th>
                      <Table.Th style={{ width: 48 }} />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {stats.per_tenant.map((t) => (
                      <motion.tr
                        key={t.tenant_id}
                        variants={rowVariants}
                        style={{ cursor: 'pointer' }}
                        onClick={() => drillDownTenant(t.tenant_id, t.tenant_name)}
                        title="Drill down — open Users for this tenant"
                      >
                        <Table.Td>
                          <Group gap="xs">
                            <Box
                              w={10} h={10}
                              style={{
                                borderRadius: '50%',
                                background: t.primary_color || 'var(--accent)',
                                flexShrink: 0,
                                boxShadow: `0 0 0 2px ${t.primary_color || 'var(--accent)'}33`,
                              }}
                            />
                            <Text fw={600} size="sm">{t.tenant_name}</Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" ff="monospace">{t.users.toLocaleString()}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" ff="monospace">{t.activities.toLocaleString()}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{t.distance_km.toFixed(1)} km</Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={8}>
                            <Progress
                              value={t.verified_pct}
                              size="sm"
                              w={72}
                              color={
                                t.verified_pct >= 80
                                  ? 'green'
                                  : t.verified_pct >= 50
                                    ? 'yellow'
                                    : 'red'
                              }
                              radius="xl"
                            />
                            <Text size="xs" fw={600} style={{ color: 'var(--text-secondary)' }}>
                              {t.verified_pct}%
                            </Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <HealthBadge pct={t.verified_pct} />
                        </Table.Td>
                        <Table.Td onClick={(e) => e.stopPropagation()}>
                          <TenantDrillDownMenu
                            tenantId={t.tenant_id}
                            tenantName={t.tenant_name}
                          />
                        </Table.Td>
                      </motion.tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </motion.div>
            )}
          </Card>
        </motion.div>
      )}

      {/* ── Platform insights (2-col) ─────────────────── */}
      {isGlobalOwner && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
        >
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mb="xl">
            {/* System Intelligence */}
            <Card
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: '22px 24px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <SectionHeader
                icon={<Brain size={16} />}
                title="System Intelligence"
                badge="AI"
                badgeColor="violet"
              />
              <Divider mb="md" style={{ borderColor: 'var(--border)' }} />
              {heavyWidgetsReady ? (
                <Suspense fallback={<Skeleton height={180} radius="md" />}>
                  <SystemIntelligenceLazy />
                </Suspense>
              ) : (
                <Skeleton height={180} radius="md" />
              )}
            </Card>

            {/* Live Activity */}
            <Card
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: '22px 24px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <SectionHeader
                icon={<Map size={16} />}
                title="Live Activity"
                badgeColor="green"
              />
              <Divider mb="md" style={{ borderColor: 'var(--border)' }} />
              {isE2eMode() ? (
                <Alert variant="light" color="blue" title="Tryb E2E (VITE_E2E=1)">
                  Mapa na żywo i API wymagają backendu. Do pracy w przeglądarce uruchom{' '}
                  <Text span fw={600}>npm run dev</Text> bez VITE_E2E, albo testy Playwright.
                </Alert>
              ) : heavyWidgetsReady ? (
                <Suspense fallback={<Skeleton height={450} radius="md" />}>
                  <LiveMapLazy />
                </Suspense>
              ) : (
                <Skeleton height={450} radius="md" />
              )}
            </Card>
          </SimpleGrid>
        </motion.div>
      )}

      {/* ── Quick summary cards (globalowner only) ────── */}
      {isGlobalOwner && stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.55 }}
        >
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mb="xl">
            {/* Verified */}
            <Box
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: '18px 20px',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <ThemeIcon size={42} radius="md" color="green" variant="light">
                <CheckCircle2 size={20} />
              </ThemeIcon>
              <Stack gap={0}>
                <Text size="xl" fw={800} style={{ lineHeight: 1.15, color: 'var(--text-primary)' }}>
                  {stats.verified_total.toLocaleString()}
                </Text>
                <Text size="xs" style={{ color: 'var(--text-tertiary)' }}>Verified activities</Text>
              </Stack>
            </Box>

            {/* Unverified */}
            <Box
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: '18px 20px',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <ThemeIcon size={42} radius="md" color={stats.unverified_total > 10 ? 'orange' : 'green'} variant="light">
                <AlertTriangle size={20} />
              </ThemeIcon>
              <Stack gap={0}>
                <Text size="xl" fw={800} style={{ lineHeight: 1.15, color: 'var(--text-primary)' }}>
                  {stats.unverified_total.toLocaleString()}
                </Text>
                <Text size="xs" style={{ color: 'var(--text-tertiary)' }}>Pending review</Text>
              </Stack>
            </Box>

            {/* Calories */}
            <Box
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: '18px 20px',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <ThemeIcon size={42} radius="md" color="red" variant="light">
                <Activity size={20} />
              </ThemeIcon>
              <Stack gap={0}>
                <Text size="xl" fw={800} style={{ lineHeight: 1.15, color: 'var(--text-primary)' }}>
                  {stats.total_calories
                    ? `${(stats.total_calories / 1000).toFixed(1)}k`
                    : '—'}
                </Text>
                <Text size="xs" style={{ color: 'var(--text-tertiary)' }}>Total kcal burned</Text>
              </Stack>
            </Box>
          </SimpleGrid>
        </motion.div>
      )}

      {/* ── Moderator view ────────────────────────────── */}
      {isModerator && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          <ModeratorWorklist />
        </motion.div>
      )}

      {/* ── Tenant admin: departments + city analytics ── */}
      {isTenantAdmin && Array.isArray(stats?.per_department) && stats.per_department.length > 0 && (
        <Card
          mb="xl"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: '22px 24px',
          }}
        >
          <SectionHeader icon={<TrendingUp size={16} />} title="Departments" badge={`${stats.per_department.length}`} />
          <Divider mb="md" style={{ borderColor: 'var(--border)' }} />
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Department</Table.Th>
                <Table.Th>Users</Table.Th>
                <Table.Th>Activities</Table.Th>
                <Table.Th>Distance</Table.Th>
                <Table.Th>Verified</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {stats.per_department.map((d) => (
                <Table.Tr key={d.department_id}>
                  <Table.Td><Text fw={600} size="sm">{d.department_name}</Text></Table.Td>
                  <Table.Td>{d.users}</Table.Td>
                  <Table.Td>{d.activities}</Table.Td>
                  <Table.Td>{d.distance_km.toFixed(1)} km</Table.Td>
                  <Table.Td><HealthBadge pct={d.verified_pct} /></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      {!isGlobalOwner && !isModerator && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          <CityAnalytics
            cityId={tenantScope.tenantId || undefined}
            cityName={tenantScope.tenantName || undefined}
            stats={stats}
          />
        </motion.div>
      )}

      {/* ── Live activity timeline ───────────────────── */}
      {isGlobalOwner && heavyWidgetsReady && (
        <Stack mt="xl" gap="md">
          <Divider label="Activity & System Monitoring" labelPosition="center" />
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Box>
              <Suspense fallback={<Skeleton height={320} radius="md" />}>
                <ActivityTimelineLazy />
              </Suspense>
            </Box>
            <Box>
              <Suspense fallback={<Skeleton height={400} radius="md" />}>
                <AuditLogLazy />
              </Suspense>
            </Box>
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Box>
              <Suspense fallback={<Skeleton height={320} radius="md" />}>
                <TrendAnalysisLazy />
              </Suspense>
            </Box>
            <Box>
              <Suspense fallback={<Skeleton height={320} radius="md" />}>
                <SystemHealthLazy />
              </Suspense>
            </Box>
          </SimpleGrid>
        </Stack>
      )}
        </Box>
      </Box>
    </Box>
  );
};