import React, { Suspense, lazy, useEffect, useState } from 'react';
import { MantineProvider, Box, Text, Title, Button, Loader } from '@mantine/core';
import { HashRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Notifications } from '@mantine/notifications';
import '@mantine/notifications/styles.css';
import { theme } from './theme/index';

import { Layout } from './core/Layout';
import { RoleHomeRedirect } from './core/RoleHomeRedirect';
import { PermissionGuard } from './core/guards/PermissionGuard';
import { TenantAnalyticsScope } from './core/components/TenantAnalyticsScope';
import { LoginPage } from './core/auth/LoginPage';
import { LandingPage } from './modules/public/LandingPage';

const Dashboard = lazy(() => import('./modules/dashboard/Dashboard').then(m => ({ default: m.Dashboard })));
const AntiCheat = lazy(() => import('./modules/anti-cheat/AntiCheat').then(m => ({ default: m.AntiCheat })));
const Users = lazy(() => import('./modules/users/Users').then(m => ({ default: m.Users })));
const WhiteLabelEngine = lazy(() => import('./modules/tenants/WhiteLabelEngine').then(m => ({ default: m.WhiteLabelEngine })));
const SponsorDashboard = lazy(() => import('./modules/sponsor/SponsorDashboard').then(m => ({ default: m.SponsorDashboard })));
const SponsorPOIMap = lazy(() => import('./modules/sponsor/SponsorPOIMap').then(m => ({ default: m.SponsorPOIMap })));
const ModeratorInbox = lazy(() => import('./modules/moderation/ModerationInbox').then(m => ({ default: m.ModerationInbox })));
const ModerationHistory = lazy(() => import('./modules/moderation/ModerationHistory').then(m => ({ default: m.ModerationHistory })));
const ActionInbox = lazy(() => import('./modules/control-plane/ActionInbox').then(m => ({ default: m.ActionInbox })));
const RevenueDashboard = lazy(() => import('./modules/control-plane/RevenueDashboard').then(m => ({ default: m.RevenueDashboard })));
const SponsorCampaigns = lazy(() => import('./modules/sponsor/SponsorCampaigns').then(m => ({ default: m.SponsorCampaigns })));
const SponsorBrandStudio = lazy(() => import('./modules/sponsor/SponsorBrandStudio').then(m => ({ default: m.SponsorBrandStudio })));
const AiCoachStudio = lazy(() => import('./modules/premium/AiCoachStudio').then(m => ({ default: m.AiCoachStudio })));
const VoucherCustomizer3D = lazy(() => import('./modules/premium/VoucherCustomizer3D').then(m => ({ default: m.VoucherCustomizer3D })));
const EsgPortal = lazy(() => import('./modules/premium/EsgPortal').then(m => ({ default: m.EsgPortal })));
const SettingsScreen = lazy(() => import('./modules/settings/SettingsScreen').then(m => ({ default: m.SettingsScreen })));
const Departments = lazy(() => import('./modules/departments/Departments').then(m => ({ default: m.Departments })));
const DepartmentUsers = lazy(() => import('./modules/departments/DepartmentUsers').then(m => ({ default: m.DepartmentUsers })));
const EventsManager = lazy(() => import('./modules/analytics/EventsManager').then(m => ({ default: m.EventsManager })));
const SponsorshipAnalytics = lazy(() => import('./modules/analytics/SponsorshipAnalytics').then(m => ({ default: m.SponsorshipAnalytics })));
const RewardsVouchers = lazy(() => import('./modules/analytics/RewardsVouchers').then(m => ({ default: m.RewardsVouchers })));
const BetaFeedback = lazy(() => import('./modules/analytics/BetaFeedback').then(m => ({ default: m.BetaFeedback })));
const AuditLogPage = lazy(() => import('./modules/analytics/AuditLog').then(m => ({ default: m.AuditLog })));
const ExportCenter = lazy(() => import('./modules/analytics/ExportCenter').then(m => ({ default: m.ExportCenter })));
const LeaderboardManager = lazy(() => import('./modules/analytics/LeaderboardManager').then(m => ({ default: m.LeaderboardManager })));
const RbacManager = lazy(() => import('./modules/analytics/RbacManager').then(m => ({ default: m.RbacManager })));
const ApiPlayground = lazy(() => import('./modules/settings/ApiPlayground').then(m => ({ default: m.ApiPlayground })));
const FeatureFlags = lazy(() => import('./modules/settings/FeatureFlags').then(m => ({ default: m.FeatureFlags })));
const DepartmentAnalyticsPage = lazy(() => import('./modules/analytics/DepartmentAnalyticsPage').then(m => ({ default: m.DepartmentAnalyticsPage })));
const GlobalHeatmap = lazy(() => import('./modules/analytics/GlobalHeatmap').then(m => ({ default: m.GlobalHeatmap })));
const SimulatorPage = lazy(() => import('./modules/analytics/SimulatorPage').then(m => ({ default: m.SimulatorPage })));
const ActivityDetail = lazy(() => import('./modules/dashboard/ActivityDetail').then(m => ({ default: m.ActivityDetail })));
const ActivitiesList = lazy(() => import('./modules/analytics/ActivitiesList').then(m => ({ default: m.ActivitiesList })));

const PageLoader = () => {
  const { t } = useI18n();
  return <Box p="xl"><Loader size="md" /><Text size="sm" c="dimmed" mt="sm">{t.app.loading}</Text></Box>;
};
import { useAuth, profileToAuthUser } from './core/auth/useAuth';
import axios from 'axios';
import { API_PATHS } from '@4velo/api-client';
import { apiClient } from './api/client';
import { clearStoredSession } from './core/auth/tokens';
import { E2EAuthBootstrap } from './core/auth/E2EAuthBootstrap';
import { useI18n } from './i18n/useI18n';
const LiveMapPage = lazy(() => import('./modules/analytics/live-map/LiveMap').then(m => ({ default: m.LiveMap })));

const AuthCallback: React.FC<{ onLogin: (token: string, refresh: string, user: any) => void }> = ({ onLogin }) => {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    // 1. Try parsing from hash query string
    const hash = window.location.hash;
    const qIndex = hash.indexOf('?');
    const hashParams = new URLSearchParams(qIndex !== -1 ? hash.slice(qIndex) : '');
    let access = hashParams.get('access');
    let refresh = hashParams.get('refresh');

    // 2. Fall back to standard query string (window.location.search)
    if (!access) {
      const qp = new URLSearchParams(window.location.search);
      access = qp.get('access');
      refresh = qp.get('refresh');
    }

    if (access && refresh) {
      const finalAccess = access;
      const finalRefresh = refresh;
      // Fetch user profile
      import('./api/client').then(({ apiClient }) => {
        apiClient.get(API_PATHS.usersProfile, { headers: { Authorization: `Bearer ${finalAccess}` } })
          .then(r => {
            const d = r.data?.data || r.data;
            onLogin(finalAccess, finalRefresh, profileToAuthUser(d)).then(() => {
              window.history.replaceState({}, document.title, window.location.pathname);
              window.location.hash = '#/owner/dashboard';
            }).catch(() => setError(t.auth.callbackFailedComplete));
          })
          .catch(() => setError(t.auth.callbackFailedProfile));
      });
    } else {
      Promise.resolve().then(() => setError(t.auth.callbackNoToken));
    }
  }, [onLogin, t.auth.callbackFailedComplete, t.auth.callbackFailedProfile, t.auth.callbackNoToken]);

  if (error) return <Box p={50} ta="center"><Title order={2} c="red">{t.auth.callbackTitleFailed}</Title><Text c="dimmed" mt="md">{error}</Text></Box>;
  return <Box p={50} ta="center"><Loader size="lg" /><Text c="dimmed" mt="md">{t.auth.callbackCompleting}</Text></Box>;
};

export default function App() {
  const { t } = useI18n();
  const { isAuthenticated, login } = useAuth();

  const handleLogin = async (username: string, password: string) => {
    try {
      clearStoredSession();
      useAuth.getState().logout();

      const baseURL = apiClient.defaults.baseURL || '/api';
      const res = await axios.post(`${baseURL}${API_PATHS.authToken}`, { username, password });
      const { access, refresh } = res.data;

      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      useAuth.setState({ token: access, refreshToken: refresh });

      const profileRes = await apiClient.get(API_PATHS.usersProfile);
      const profileData = profileRes.data?.data || profileRes.data;

      await login(access, refresh, profileToAuthUser(profileData));
    } catch (error: any) {
      const data = error?.response?.data;
      const detail = data?.detail;
      const msg =
        (typeof detail === 'string' && detail) ||
        (Array.isArray(detail) && detail[0]) ||
        data?.non_field_errors?.[0] ||
        data?.error ||
        t.app.loginFailedDefault;
      throw new Error(msg);
    }
  };

  return (
    <MantineProvider defaultColorScheme="auto" theme={theme}>
      <E2EAuthBootstrap />
      <Notifications position="top-right" zIndex={9999} />
      <HashRouter>
        {!isAuthenticated ? (
          <Routes>
            <Route path="/auth/callback" element={<AuthCallback onLogin={login} />} />
            <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        ) : (
          <Suspense fallback={<PageLoader />}>
            <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/owner" element={<Layout />}>
              <Route index element={<RoleHomeRedirect />} />
              <Route
                path="dashboard"
                element={
                  <PermissionGuard permissions={['activities.view']}>
                    <Dashboard />
                  </PermissionGuard>
                }
              />
              <Route
                path="anti-cheat"
                element={
                  <PermissionGuard permissions={['activities.approve']}>
                    <AntiCheat />
                  </PermissionGuard>
                }
              />
              <Route
                path="users"
                element={
                  <PermissionGuard permissions={['users.view']}>
                    <Users />
                  </PermissionGuard>
                }
              />
              <Route
                path="white-label"
                element={
                  <PermissionGuard permissions={['users.edit']}>
                    <WhiteLabelEngine />
                  </PermissionGuard>
                }
              />
              <Route
                path="sponsor"
                element={
                  <PermissionGuard permissions={['poi.view', 'vouchers.view']}>
                    <SponsorDashboard />
                  </PermissionGuard>
                }
              />
              <Route
                path="sponsor/poi"
                element={
                  <PermissionGuard permissions={['poi.view']}>
                    <SponsorPOIMap />
                  </PermissionGuard>
                }
              />
              <Route
                path="sponsor/campaigns"
                element={
                  <PermissionGuard permissions={['poi.view', 'vouchers.view']}>
                    <SponsorCampaigns />
                  </PermissionGuard>
                }
              />
              <Route
                path="sponsor/brand"
                element={
                  <PermissionGuard permissions={['poi.view', 'vouchers.view']}>
                    <SponsorBrandStudio />
                  </PermissionGuard>
                }
              />
              <Route
                path="moderation"
                element={
                  <PermissionGuard permissions={['activities.approve', 'activities.view']}>
                    <ModeratorInbox />
                  </PermissionGuard>
                }
              />
              <Route
                path="moderation/history"
                element={
                  <PermissionGuard permissions={['activities.approve', 'activities.view']}>
                    <ModerationHistory />
                  </PermissionGuard>
                }
              />
              <Route
                path="control-plane/inbox"
                element={
                  <PermissionGuard roles={['GLOBAL_OWNER']}>
                    <ActionInbox />
                  </PermissionGuard>
                }
              />
              <Route
                path="analytics/revenue"
                element={
                  <PermissionGuard roles={['GLOBAL_OWNER']}>
                    <RevenueDashboard />
                  </PermissionGuard>
                }
              />
              <Route
                path="settings"
                element={
                  <PermissionGuard permissions={['users.edit']}>
                    <SettingsScreen />
                  </PermissionGuard>
                }
              />
              <Route
                path="departments"
                element={
                  <PermissionGuard permissions={['users.view']}>
                    <Departments />
                  </PermissionGuard>
                }
              />
              <Route
                path="departments/:id/users"
                element={
                  <PermissionGuard permissions={['users.view']}>
                    <DepartmentUsers />
                  </PermissionGuard>
                }
              />
              <Route
                path="activities/:id"
                element={
                  <PermissionGuard permissions={['activities.view']}>
                    <ActivityDetail />
                  </PermissionGuard>
                }
              />
              <Route
                path="activities"
                element={
                  <PermissionGuard permissions={['activities.view']}>
                    <ActivitiesList />
                  </PermissionGuard>
                }
              />
              <Route
                path="analytics/events"
                element={
                  <PermissionGuard permissions={['activities.view']}>
                    <EventsManager />
                  </PermissionGuard>
                }
              />
              <Route
                path="analytics/sponsorship"
                element={
                  <PermissionGuard permissions={['poi.view']}>
                    <SponsorshipAnalytics />
                  </PermissionGuard>
                }
              />
              <Route
                path="analytics/vouchers"
                element={
                  <PermissionGuard permissions={['vouchers.view']}>
                    <RewardsVouchers />
                  </PermissionGuard>
                }
              />
              <Route
                path="analytics/feedback"
                element={
                  <PermissionGuard permissions={['activities.view']}>
                    <TenantAnalyticsScope><BetaFeedback /></TenantAnalyticsScope>
                  </PermissionGuard>
                }
              />
              <Route
                path="analytics/audit-log"
                element={
                  <PermissionGuard roles={['GLOBAL_OWNER', 'TENANT_ADMIN']}>
                    <TenantAnalyticsScope><AuditLogPage /></TenantAnalyticsScope>
                  </PermissionGuard>
                }
              />
              <Route
                path="analytics/export"
                element={
                  <PermissionGuard roles={['TENANT_ADMIN']}>
                    <TenantAnalyticsScope><ExportCenter scoped /></TenantAnalyticsScope>
                  </PermissionGuard>
                }
              />
              <Route
                path="system/export"
                element={
                  <PermissionGuard roles={['GLOBAL_OWNER']}>
                    <ExportCenter />
                  </PermissionGuard>
                }
              />
              <Route
                path="system/leaderboards"
                element={
                  <PermissionGuard roles={['GLOBAL_OWNER']}>
                    <LeaderboardManager />
                  </PermissionGuard>
                }
              />
              <Route
                path="system/rbac"
                element={
                  <PermissionGuard roles={['GLOBAL_OWNER']}>
                    <RbacManager />
                  </PermissionGuard>
                }
              />
              <Route
                path="system/api-playground"
                element={
                  <PermissionGuard roles={['GLOBAL_OWNER']}>
                    <ApiPlayground />
                  </PermissionGuard>
                }
              />
              <Route
                path="system/feature-flags"
                element={
                  <PermissionGuard roles={['GLOBAL_OWNER']}>
                    <FeatureFlags />
                  </PermissionGuard>
                }
              />
              <Route
                path="analytics/departments"
                element={
                  <PermissionGuard permissions={['activities.view']}>
                    <TenantAnalyticsScope><DepartmentAnalyticsPage /></TenantAnalyticsScope>
                  </PermissionGuard>
                }
              />
              <Route
                path="analytics/heatmaps"
                element={
                  <PermissionGuard permissions={['activities.view']}>
                    <TenantAnalyticsScope><GlobalHeatmap /></TenantAnalyticsScope>
                  </PermissionGuard>
                }
              />
              <Route
                path="analytics/live-map"
                element={
                  <PermissionGuard permissions={['activities.view']}>
                    <TenantAnalyticsScope>
                      <Box p="md" style={{ height: 'calc(100vh - 100px)' }}>
                        <LiveMapPage />
                      </Box>
                    </TenantAnalyticsScope>
                  </PermissionGuard>
                }
              />
              {/* Simulator: GLOBAL_OWNER only — nav in Layout.tsx matches this guard */}
              <Route
                path="analytics/simulator"
                element={
                  <PermissionGuard roles={['GLOBAL_OWNER']}>
                    <SimulatorPage />
                  </PermissionGuard>
                }
              />
              <Route
                path="premium/ai-coach"
                element={
                  <PermissionGuard roles={['GLOBAL_OWNER']}>
                    <AiCoachStudio />
                  </PermissionGuard>
                }
              />
              <Route
                path="premium/voucher-3d"
                element={
                  <PermissionGuard permissions={['vouchers.view']}>
                    <VoucherCustomizer3D />
                  </PermissionGuard>
                }
              />
              <Route
                path="premium/esg"
                element={
                  <PermissionGuard roles={['GLOBAL_OWNER']}>
                    <EsgPortal />
                  </PermissionGuard>
                }
              />
            </Route>
            <Route
              path="/unauthorized"
              element={
                <Box p={50} ta="center">
                  <Title order={1} c="red">{t.app.unauthorizedTitle}</Title>
                  <Text c="dimmed" mt="md">{t.app.unauthorizedDesc}</Text>
                  <Button mt="xl" component={Link} to="/owner/dashboard">{t.app.backToDashboard}</Button>
                </Box>
              }
            />
            <Route path="*" element={<Navigate to="/owner" replace />} />
          </Routes>
          </Suspense>
        )}
      </HashRouter>
    </MantineProvider>
  );
}