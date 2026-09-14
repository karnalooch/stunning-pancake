import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  SimpleGrid, Card, Text, Group, Badge, Progress, Table, Box, Stack,
  Skeleton, Divider, ThemeIcon, Alert, Button, Popover, Switch,
} from '@mantine/core';
import { motion } from 'framer-motion';
import {
  Users, Activity, Gauge, ShieldCheck, TrendingUp, Brain,
  Map, CheckCircle2, AlertTriangle, Radio, PauseCircle, Route,
} from 'lucide-react';
import { notifications } from '@mantine/notifications';
import { apiClient } from '../../api/client';
import { useDashboardStats } from '../../hooks/queries/useDashboardStats';
import { useDashboardWidgets, type DashboardWidgetId } from '../../hooks/useDashboardWidgets';
import { PageHeader } from '../../core/components/PageHeader';
import { StatCard } from '../../core/components/StatCard';
import { useAuth } from '../../core/auth/useAuth';
import { isE2eMode } from '../../core/auth/e2eEnv';
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
import { useModeratorDashboardStats } from '../../hooks/useModeratorDashboardStats';
import { API_PATHS } from '@4velo/api-client';
import { DataSourceBanner } from '../../core/components/DataSourceBanner';
import { TenantScopeBanner } from '../../core/components/TenantScopeBanner';
import { TenantAdminQuickActions } from '../../core/components/TenantAdminQuickActions';
import { useTenantScope } from '../../hooks/useTenantScope';
import { TenantDrillDownMenu } from '../../core/components/TenantDrillDownMenu';
import { tenantUsersUrl } from '../../utils/tenantDrillDown';
import { useI18n } from '../../i18n/useI18n';
import {
  DashboardBootOverlay,
  type DashboardBootStep,
} from '../../core/components/DashboardBootOverlay';

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
const HealthBadge: React.FC<{ pct: number; healthy: string; review: string; critical: string }> = ({
  pct,
  healthy,
  review,
  critical,
}) => {
  if (pct >= 80) return <Badge size="xs" color="green" variant="light" radius="sm">{healthy}</Badge>;
  if (pct >= 50) return <Badge size="xs" color="yellow" variant="light" radius="sm">{review}</Badge>;
  return <Badge size="xs" color="red" variant="light" radius="sm">{critical}</Badge>;
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
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const statsQuery = useDashboardStats(Boolean(user));
  const stats = statsQuery.data ?? null;
  const loading = statsQuery.isLoading;
  const { widgets, setWidget } = useDashboardWidgets();
  const [apiLatencyMs, setApiLatencyMs] = useState<number | null>(null);
  const [infraStatus, setInfraStatus] = useState<string | null>(null);
  const [bootOverlayVisible, setBootOverlayVisible] = useState(false);
  const [bootStep, setBootStep] = useState<DashboardBootStep>('session');
  const [bootElapsedMs, setBootElapsedMs] = useState(0);
  const [heavyWidgetsReady, setHeavyWidgetsReady] = useState(false);
  const loadStarted = useRef(0);

  const isGlobalOwner = user?.role === 'GLOBAL_OWNER';
  const isTenantAdmin = user?.role === 'TENANT_ADMIN';
  const isModerator = user?.role === 'TENANT_MODERATOR';
  const modStats = useModeratorDashboardStats(isModerator || isTenantAdmin);
  const tenantScope = useTenantScope(stats);

  useEffect(() => {
    if (!user) {
      setHeavyWidgetsReady(true);
      return;
    }
    setHeavyWidgetsReady(false);
    setBootOverlayVisible(false);
    setBootStep('session');
    loadStarted.current = performance.now();
    if (user?.role === 'GLOBAL_OWNER') {
      apiClient.get(API_PATHS.infraHealth)
        .then((r) => setInfraStatus(r.data?.status ?? null))
        .catch(() => setInfraStatus(null));
    }
  }, [user]);

  useEffect(() => {
    if (statsQuery.isSuccess) {
      setApiLatencyMs(Math.round(performance.now() - loadStarted.current));
    }
    if (statsQuery.isError) {
      notifications.show({ title: t.nav.items.dashboard, message: t.dashboard.loadFailed, color: 'red' });
    }
  }, [statsQuery.isSuccess, statsQuery.isError, t.dashboard.loadFailed, t.nav.items.dashboard]);

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
    hour < 12 ? t.dashboard.greetingMorning : hour < 18 ? t.dashboard.greetingAfternoon : t.dashboard.greetingEvening;

  /* ── Simulator / data-source signals ──────────────────── */
  const isSyntheticKpi = stats?.data_source === 'sim-lab' || Boolean(stats?.synthetic);
  const simulatorBadge = isSyntheticKpi
    ? { text: `${t.dashboard.syntheticKpis} (${stats?.sim_lab_label ?? 'sim-lab'})`, color: 'orange' as const }
    : stats?.batch_running
      ? { text: t.dashboard.simulatorRunningStale, color: 'orange' as const }
      : stats?.federation_fallback
        ? { text: t.dashboard.federationFallback, color: 'yellow' as const }
        : stats?.stale
          ? { text: t.dashboard.staleKpis, color: 'yellow' as const }
          : null;

  return (
    <Box>
      {/* ── Page header ──────────────────────────────── */}
      <PageHeader
        title={
          isGlobalOwner
            ? `${greeting}, ${user?.username ?? t.dashboard.ownerFallbackName} 👋`
            : `${greeting}, ${user?.username ?? t.dashboard.adminFallbackName}`
        }
        subtitle={
          isGlobalOwner
            ? t.dashboard.allTenantsCombined
            : tenantScope.tenantName
              ? `${t.dashboard.cityDashboard} — ${tenantScope.tenantName}`
              : `${t.dashboard.cityDashboard} — ${tenantScope.tenantId ?? t.dashboard.yourInstance}`
        }
      >
        <Group gap="xs">
          {simulatorBadge && (
            <Badge size="sm" color={simulatorBadge.color} variant="light">
              {simulatorBadge.text}
            </Badge>
          )}
          {(isTenantAdmin || isGlobalOwner) && (
            <Popover width={260} position="bottom-end" withArrow shadow="md">
              <Popover.Target>
                <Button size="compact-xs" variant="subtle">{t.dashboard.customizeWidgets}</Button>
              </Popover.Target>
              <Popover.Dropdown>
                <Stack gap="xs">
                  {([
                    ['kpi', t.dashboard.widgetKpi],
                    ['moderationSla', t.dashboard.widgetModerationSla],
                    ['departments', t.dashboard.widgetDepartments],
                    ['goHealth', t.dashboard.widgetGoHealth],
                    ['tenantQuickActions', t.dashboard.widgetTenantActions],
                  ] as [DashboardWidgetId, string][]).map(([id, label]) => (
                    <Switch
                      key={id}
                      label={label}
                      checked={widgets[id]}
                      onChange={(e) => setWidget(id, e.currentTarget.checked)}
                    />
                  ))}
                </Stack>
              </Popover.Dropdown>
            </Popover>
          )}
        </Group>
      </PageHeader>

      {isModerator && (
        <TenantScopeBanner
          tenantId={tenantScope.tenantId}
          tenantName={tenantScope.tenantName}
          roleLabel={t.tenant.moderator}
        />
      )}

      {isTenantAdmin && (
        <>
          <TenantScopeBanner
            tenantId={tenantScope.tenantId}
            tenantName={tenantScope.tenantName}
            roleLabel={t.tenant.tenantAdmin}
          />
          {widgets.tenantQuickActions && (
            <TenantAdminQuickActions
              tenantId={tenantScope.tenantId}
              pendingReview={stats?.unverified_total}
            />
          )}
          {widgets.moderationSla && (
          <Card mb="xl" padding="lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14 }}>
            <Text fw={700} size="sm" mb="md">{t.tenant.slaStripTitle}</Text>
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <Box>
                <Text size="xs" c="dimmed">{t.dashboard.openQueue}</Text>
                <Text fw={800} size="xl">{modStats.loading ? '…' : modStats.stats?.openQueue ?? stats?.unverified_total ?? '—'}</Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed">{t.dashboard.sla48h}</Text>
                <Text fw={800} size="xl" c={(modStats.stats?.olderThan48h ?? 0) > 0 ? 'orange' : undefined}>
                  {modStats.loading ? '…' : modStats.stats?.olderThan48h ?? '—'}
                </Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed">{t.dashboard.anomalies}</Text>
                <Text fw={800} size="xl">{modStats.loading ? '…' : modStats.stats?.anomalies ?? '—'}</Text>
              </Box>
            </SimpleGrid>
          </Card>
          )}
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
          {widgets.goHealth && (
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
            infraStatus={infraStatus}
          />
          )}
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
          label={isTenantAdmin ? t.dashboard.tenantAthletes : t.dashboard.totalAthletes}
          value={stats ? stats.total_users.toLocaleString() : null}
          variant="indigo"
          loading={kpiLoading}
          trend={
            stats
              ? {
                value: `${stats.new_users_last_7d.toLocaleString()}`,
                direction: stats.new_users_last_7d > 0 ? 'up' : 'flat',
                label: t.dashboard.newLast7d,
              }
              : undefined
          }
        />
        <StatCard
          index={1}
          icon={<Activity size={18} />}
          label={t.dashboard.totalActivities}
          value={stats ? stats.total_activities.toLocaleString() : null}
          variant="green"
          loading={kpiLoading}
          trend={
            stats
              ? {
                value: `${stats.new_activities_last_7d.toLocaleString()}`,
                direction: stats.new_activities_last_7d > 0 ? 'up' : 'flat',
                label: t.dashboard.newLast7d,
              }
              : undefined
          }
        />
        <StatCard
          index={2}
          icon={<Gauge size={18} />}
          label={t.dashboard.totalDistance}
          value={stats ? `${stats.total_distance_km.toFixed(1)} km` : null}
          variant="violet"
          loading={kpiLoading}
        />
        <StatCard
          index={3}
          icon={<ShieldCheck size={18} />}
          label={t.dashboard.verificationRate}
          value={stats ? `${stats.verified_pct}%` : null}
          variant={stats && stats.unverified_total > 10 ? 'orange' : 'green'}
          loading={kpiLoading}
          trend={
            stats
              ? {
                value: `${stats.unverified_total.toLocaleString()}`,
                direction: stats.unverified_total > 10 ? 'down' : 'flat',
                label: t.dashboard.pendingReviewTotal,
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
            title={t.dashboard.liveSimulator}
            badge={stats.sim_kpi.sim_on ? t.common.on : t.common.off}
            badgeColor={stats.sim_kpi.sim_on ? 'green' : 'gray'}
          />
          <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="md">
            <Stack gap={2}>
              <Text size="xs" c="dimmed">{t.dashboard.state}</Text>
              <Group gap={6}>
                {stats.sim_kpi.live_running ? (
                  <Badge color="green" variant="light" leftSection={<Radio size={12} />}>{t.dashboard.running}</Badge>
                ) : stats.sim_kpi.batch_running ? (
                  <Badge color="orange" variant="light">{t.dashboard.batch} {stats.sim_kpi.batch_phase}</Badge>
                ) : (
                  <Badge color="gray" variant="light" leftSection={<PauseCircle size={12} />}>{t.dashboard.idle}</Badge>
                )}
              </Group>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">{t.dashboard.onMap}</Text>
              <Text fw={700} ff="monospace">{stats.sim_kpi.currently_riding}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">{t.dashboard.warming}</Text>
              <Text fw={700} ff="monospace" c={stats.sim_kpi.ride_warming > 0 ? 'orange' : undefined}>
                {stats.sim_kpi.ride_warming}
              </Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">{t.dashboard.routing}</Text>
              <Text fw={700} ff="monospace">{stats.sim_kpi.ride_routing}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">{t.dashboard.asyncRouting}</Text>
              <Badge size="sm" color={stats.sim_kpi.async_routing_enabled ? 'teal' : 'gray'} variant="light">
                {stats.sim_kpi.async_routing_enabled ? t.common.on : t.common.off}
              </Badge>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">{t.dashboard.queueDepth}</Text>
              <Group gap={6}>
                <ThemeIcon size={22} variant="light" color="violet">
                  <Route size={14} />
                </ThemeIcon>
                <Text fw={700} ff="monospace">{stats.sim_kpi.routing_queue_depth}</Text>
                {stats.sim_kpi.routing_backpressure_active && (
                  <Badge size="xs" color="red" variant="filled">{t.dashboard.backpressure}</Badge>
                )}
                {stats.sim_kpi.dispatches_throttled && !stats.sim_kpi.routing_backpressure_active && (
                  <Badge size="xs" color="yellow" variant="light">{t.dashboard.throttled}</Badge>
                )}
              </Group>
            </Stack>
          </SimpleGrid>
          {stats.sim_kpi.tick_stale && stats.sim_kpi.live_running && (
            <Text size="xs" c="orange" mt="sm">
              {t.dashboard.liveTicksStale}
            </Text>
          )}
          {(stats.sim_kpi.sim_lab_unreachable || stats.federation_fallback) && (
            <Alert color="yellow" variant="light" mt="sm" icon={<AlertTriangle size={16} />} title={t.dashboard.simLabUnavailable}>
              <Text size="sm">
                {t.dashboard.simLabUnavailableDesc.replace('{label}', stats.sim_lab_label || '4velo-sim-lab')}
              </Text>
            </Alert>
          )}
          {!stats.sim_kpi.sim_on && stats.sim_kpi.sim_kpi_source === 'sim-lab' && !stats.sim_kpi.sim_lab_unreachable && (
            <Text size="xs" c="dimmed" mt="sm">
              {t.dashboard.simLabIdle}
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
              title={t.dashboard.perTenantBreakdown}
              badge={`${stats.per_tenant.length} ${t.dashboard.tenantsCount}`}
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
                      <Table.Th>{t.dashboard.tenant}</Table.Th>
                      <Table.Th>{t.dashboard.users}</Table.Th>
                      <Table.Th>{t.dashboard.activities}</Table.Th>
                      <Table.Th>{t.dashboard.distance}</Table.Th>
                      <Table.Th>{t.dashboard.verified}</Table.Th>
                      <Table.Th>{t.dashboard.health}</Table.Th>
                      <Table.Th style={{ width: 48 }} />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {stats.per_tenant.map((tenant) => (
                      <motion.tr
                        key={tenant.tenant_id}
                        variants={rowVariants}
                        style={{ cursor: 'pointer' }}
                        onClick={() => drillDownTenant(tenant.tenant_id, tenant.tenant_name)}
                        title={t.dashboard.drillDownHint}
                      >
                        <Table.Td>
                          <Group gap="xs">
                            <Box
                              w={10} h={10}
                              style={{
                                borderRadius: '50%',
                                background: tenant.primary_color || 'var(--accent)',
                                flexShrink: 0,
                                boxShadow: `0 0 0 2px ${tenant.primary_color || 'var(--accent)'}33`,
                              }}
                            />
                            <Text fw={600} size="sm">{tenant.tenant_name}</Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" ff="monospace">{tenant.users.toLocaleString()}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" ff="monospace">{tenant.activities.toLocaleString()}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{tenant.distance_km.toFixed(1)} km</Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={8}>
                            <Progress
                              value={tenant.verified_pct}
                              size="sm"
                              w={72}
                              color={
                                tenant.verified_pct >= 80
                                  ? 'green'
                                  : tenant.verified_pct >= 50
                                    ? 'yellow'
                                    : 'red'
                              }
                              radius="xl"
                            />
                            <Text size="xs" fw={600} style={{ color: 'var(--text-secondary)' }}>
                              {tenant.verified_pct}%
                            </Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <HealthBadge
                            pct={tenant.verified_pct}
                            healthy={t.dashboard.healthHealthy}
                            review={t.dashboard.healthReview}
                            critical={t.dashboard.healthCritical}
                          />
                        </Table.Td>
                        <Table.Td onClick={(e) => e.stopPropagation()}>
                          <TenantDrillDownMenu
                            tenantId={tenant.tenant_id}
                            tenantName={tenant.tenant_name}
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
                title={t.dashboard.systemIntelligence}
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
                title={t.dashboard.liveActivity}
                badgeColor="green"
              />
              <Divider mb="md" style={{ borderColor: 'var(--border)' }} />
              {isE2eMode() ? (
                <Alert variant="light" color="blue" title={t.dashboard.e2eModeTitle}>
                  {t.dashboard.e2eModeDesc}
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
                <Text size="xs" style={{ color: 'var(--text-tertiary)' }}>{t.dashboard.verifiedActivities}</Text>
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
                <Text size="xs" style={{ color: 'var(--text-tertiary)' }}>{t.dashboard.pendingReviewLabel}</Text>
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
                <Text size="xs" style={{ color: 'var(--text-tertiary)' }}>{t.dashboard.totalKcalBurned}</Text>
              </Stack>
            </Box>
          </SimpleGrid>
        </motion.div>
      )}

      {/* ── Moderator view (3 KPI — no global platform stats) ── */}
      {isModerator && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          <SimpleGrid cols={{ base: 1, sm: 3 }} mb="xl">
            <Card padding="lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14 }}>
              <Text size="xs" c="dimmed">{t.dashboard.openQueue}</Text>
              <Text fw={800} size="xl">{modStats.loading ? '…' : modStats.stats?.openQueue ?? '—'}</Text>
            </Card>
            <Card padding="lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14 }}>
              <Text size="xs" c="dimmed">{t.dashboard.sla48h}</Text>
              <Text fw={800} size="xl" c={(modStats.stats?.olderThan48h ?? 0) > 0 ? 'orange' : undefined}>
                {modStats.loading ? '…' : modStats.stats?.olderThan48h ?? '—'}
              </Text>
            </Card>
            <Card padding="lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14 }}>
              <Text size="xs" c="dimmed">{t.dashboard.anomalies}</Text>
              <Text fw={800} size="xl">{modStats.loading ? '…' : modStats.stats?.anomalies ?? '—'}</Text>
            </Card>
          </SimpleGrid>
          <Button component={Link} to="/owner/moderation" variant="light">
            {t.dashboard.openModerationInbox}
          </Button>
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
          <SectionHeader icon={<TrendingUp size={16} />} title={t.dashboard.departments} badge={`${stats.per_department.length}`} />
          <Divider mb="md" style={{ borderColor: 'var(--border)' }} />
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t.dashboard.department}</Table.Th>
                <Table.Th>{t.dashboard.users}</Table.Th>
                <Table.Th>{t.dashboard.activities}</Table.Th>
                <Table.Th>{t.dashboard.distance}</Table.Th>
                <Table.Th>{t.dashboard.verified}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {stats.per_department.map((d) => (
                <Table.Tr key={d.department_id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/owner/analytics/departments?department_id=${d.department_id}`)}>
                  <Table.Td><Text fw={600} size="sm" c="indigo">{d.department_name}</Text></Table.Td>
                  <Table.Td>{d.users}</Table.Td>
                  <Table.Td>{d.activities}</Table.Td>
                  <Table.Td>{d.distance_km.toFixed(1)} km</Table.Td>
                  <Table.Td>
                    <HealthBadge
                      pct={d.verified_pct}
                      healthy={t.dashboard.healthHealthy}
                      review={t.dashboard.healthReview}
                      critical={t.dashboard.healthCritical}
                    />
                  </Table.Td>
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
          <Divider label={t.dashboard.activitySystemMonitoring} labelPosition="center" />
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
