import React, { useEffect, useState } from 'react';
import { MantineProvider, Box, Text, Title, Button, Loader } from '@mantine/core';
import { HashRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Notifications } from '@mantine/notifications';
import '@mantine/notifications/styles.css';
import { theme } from './theme/index';

import { Layout } from './core/Layout';
import { Dashboard } from './modules/dashboard/Dashboard';
import { AntiCheat } from './modules/anti-cheat/AntiCheat';
import { Users } from './modules/users/Users';
import { WhiteLabelEngine } from './modules/tenants/WhiteLabelEngine';
import { PermissionGuard } from './core/guards/PermissionGuard';
import { SponsorDashboard } from './modules/sponsor/SponsorDashboard';
import { LandingPage } from './modules/public/LandingPage';
import { LoginPage } from './core/auth/LoginPage';
import { SettingsScreen } from './modules/settings/SettingsScreen';
import { Departments } from './modules/departments/Departments';
import { DepartmentUsers } from './modules/departments/DepartmentUsers';
import { EventsManager } from './modules/analytics/EventsManager';
import { SponsorshipAnalytics } from './modules/analytics/SponsorshipAnalytics';
import { RewardsVouchers } from './modules/analytics/RewardsVouchers';
import { BetaFeedback } from './modules/analytics/BetaFeedback';
import { ExportCenter } from './modules/analytics/ExportCenter';
import { LeaderboardManager } from './modules/analytics/LeaderboardManager';
import { RbacManager } from './modules/analytics/RbacManager';
import { ApiPlayground } from './modules/settings/ApiPlayground';
import { FeatureFlags } from './modules/settings/FeatureFlags';
import { DepartmentAnalyticsPage } from './modules/analytics/DepartmentAnalyticsPage';
import { GlobalHeatmap } from './modules/analytics/GlobalHeatmap';
import { SimulatorPage } from './modules/analytics/SimulatorPage';
import { ActivityDetail } from './modules/dashboard/ActivityDetail';
import { ActivitiesList } from './modules/analytics/ActivitiesList';
import { useAuth } from './core/auth/useAuth';
import { apiClient } from './api/client';

const AuthCallback: React.FC<{ onLogin: (token: string, refresh: string, user: any) => void }> = ({ onLogin }) => {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(2)); // after #/auth/callback
    const access = params.get('access');
    const refresh = params.get('refresh');
    if (!access) {
      // Try query params (direct URL from backend redirect)
      const qp = new URLSearchParams(window.location.search);
      const qAccess = qp.get('access');
      const qRefresh = qp.get('refresh');
      if (qAccess && qRefresh) {
        // Fetch user profile
        import('./api/client').then(({ apiClient }) => {
          apiClient.get('/users/profile/', { headers: { Authorization: `Bearer ${qAccess}` } })
            .then(r => {
              const d = r.data?.data || r.data;
              onLogin(qAccess, qRefresh, { id: d.id, username: d.username, role: d.role, tenantId: d.tenant_id || null, tenantFlags: d.role === 'GLOBAL_OWNER' ? { has_heatmap_analytics: true } : null, isImpersonated: false });
              window.location.hash = '#/owner/dashboard';
            })
            .catch(() => setError('Failed to load profile'));
        });
        return;
      }
      setError('No token received from Google login');
    }
  }, [onLogin]);

  if (error) return <Box p={50} ta="center"><Title order={2} c="red">Login Failed</Title><Text c="dimmed" mt="md">{error}</Text></Box>;
  return <Box p={50} ta="center"><Loader size="lg" /><Text c="dimmed" mt="md">Completing Google login...</Text></Box>;
};

export default function App() {
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, login, user } = useAuth();

  const handleLogin = async (username: string, password: string) => {
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/token/', { username, password });
      const { access, refresh } = res.data;

      const profileRes = await apiClient.get('/users/profile/', {
        headers: { Authorization: `Bearer ${access}` },
      });
      const profileData = profileRes.data?.data || profileRes.data;

      login(access, refresh, {
        id: profileData.id,
        username: profileData.username,
        role: profileData.role,
        tenantId: profileData.tenant_id || null,
        tenantFlags: profileData.role === 'GLOBAL_OWNER' ? { has_heatmap_analytics: true } : null,
        isImpersonated: false,
      });
    } catch (error: any) {
      const msg = error?.response?.data?.error || error?.response?.data?.detail || 'Invalid credentials.';
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MantineProvider defaultColorScheme="auto" theme={theme}>
      <Notifications position="top-right" zIndex={9999} />
      <HashRouter>
        {!isAuthenticated ? (
          <Routes>
            <Route path="/auth/callback" element={<AuthCallback onLogin={handleLogin} />} />
            <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/owner" element={<Layout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
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
                    <BetaFeedback />
                  </PermissionGuard>
                }
              />
              <Route
                path="system/export"
                element={
                  <PermissionGuard permissions={['activities.view']}>
                    <ExportCenter />
                  </PermissionGuard>
                }
              />
              <Route
                path="system/leaderboards"
                element={
                  <PermissionGuard permissions={['activities.view']}>
                    <LeaderboardManager />
                  </PermissionGuard>
                }
              />
              <Route
                path="system/rbac"
                element={
                  <PermissionGuard permissions={['users.edit']}>
                    <RbacManager />
                  </PermissionGuard>
                }
              />
              <Route
                path="system/api-playground"
                element={
                  <PermissionGuard permissions={['users.view']}>
                    <ApiPlayground />
                  </PermissionGuard>
                }
              />
              <Route
                path="system/feature-flags"
                element={
                  <PermissionGuard permissions={['users.edit']}>
                    <FeatureFlags />
                  </PermissionGuard>
                }
              />
              <Route
                path="analytics/departments"
                element={
                  <PermissionGuard permissions={['activities.view']}>
                    <DepartmentAnalyticsPage />
                  </PermissionGuard>
                }
              />
              <Route
                path="analytics/heatmaps"
                element={
                  <PermissionGuard permissions={['activities.view']}>
                    <GlobalHeatmap />
                  </PermissionGuard>
                }
              />
              <Route
                path="analytics/simulator"
                element={
                  <PermissionGuard permissions={['activities.view']}>
                    <SimulatorPage />
                  </PermissionGuard>
                }
              />
            </Route>
            <Route
              path="/unauthorized"
              element={
                <Box p={50} ta="center">
                  <Title order={1} c="red">Access Denied</Title>
                  <Text c="dimmed" mt="md">Your role does not have access to this section.</Text>
                  <Button mt="xl" component={Link} to="/owner/dashboard">Back to Dashboard</Button>
                </Box>
              }
            />
            <Route path="*" element={<Navigate to="/owner/dashboard" replace />} />
          </Routes>
        )}
      </HashRouter>
    </MantineProvider>
  );
}