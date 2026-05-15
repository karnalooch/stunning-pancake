import React, { useState } from 'react';
import { MantineProvider, Box, Text, Title, Button } from '@mantine/core';
import { HashRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Notifications } from '@mantine/notifications';
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
import { useAuth } from './core/auth/useAuth';
import { apiClient } from './api/client';

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
    <MantineProvider defaultColorScheme="light" theme={theme}>
      <Notifications position="top-right" />
      <HashRouter>
        {!isAuthenticated ? (
          <Routes>
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
