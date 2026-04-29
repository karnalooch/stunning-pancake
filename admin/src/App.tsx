import React, { useState, useEffect } from 'react';
import { MantineProvider, Box, Text, Title, Button } from '@mantine/core';
import { HashRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { theme } from './theme/index';

import { DesignerProvider } from './providers/DesignerProvider';
import { Layout } from './core/Layout';
import { Dashboard } from './modules/dashboard/Dashboard';
import { AntiCheat } from './modules/anti-cheat/AntiCheat';
import { Users } from './modules/users/Users';
import { WhiteLabelEngine } from './modules/tenants/WhiteLabelEngine';
import { RoleGuard } from './core/guards/RoleGuard';
import { SponsorDashboard } from './modules/sponsor/SponsorDashboard';
import { LandingPage } from './modules/public/LandingPage';
import { GlobalLoader } from './core/components/GlobalLoader';
import { TenantLoader } from './core/components/TenantLoader';
import { LoginPage } from './core/auth/LoginPage';
import { useAuth } from './core/auth/useAuth';

import { motion, AnimatePresence } from 'framer-motion';

const MeshBackground = () => (
  <Box
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: -1,
      background: '#F8FAFC',
      overflow: 'hidden'
    }}
  >
    <motion.div
      animate={{ 
        scale: [1, 1.1, 1],
        opacity: [0.3, 0.5, 0.3],
      }}
      transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      style={{
        position: 'absolute',
        top: '10%',
        left: '10%',
        width: '80%',
        height: '80%',
        background: 'radial-gradient(circle at 50% 50%, rgba(0, 209, 255, 0.1) 0%, transparent 70%)',
        filter: 'blur(120px)'
      }}
    />
    <motion.div
      animate={{ 
        scale: [1.2, 1, 1.2],
        opacity: [0.2, 0.4, 0.2],
      }}
      transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      style={{
        position: 'absolute',
        bottom: '10%',
        right: '10%',
        width: '80%',
        height: '80%',
        background: 'radial-gradient(circle at 50% 50%, rgba(176, 102, 255, 0.08) 0%, transparent 70%)',
        filter: 'blur(120px)'
      }}
    />
  </Box>
);

import { apiClient } from './api/client';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [tenantLoading, setTenantLoading] = useState(false);
  const { isAuthenticated, login, user } = useAuth();

  useEffect(() => {
    // Simulate platform core boot sequence
    const timer = setTimeout(() => setLoading(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = async (username, password) => {
    setTenantLoading(true);
    try {
      const res = await apiClient.post('/auth/token/', { username, password });
      const { access, refresh } = res.data;
      
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      
      const profileRes = await apiClient.get('/users/profile/', {
        headers: { Authorization: `Bearer ${access}` }
      });
      
      const profileData = profileRes.data;
      
      login(access, {
        id: profileData.id,
        username: profileData.username,
        role: profileData.role,
        tenantId: profileData.tenant_id || null,
        tenantFlags: profileData.role === 'GLOBAL_OWNER' ? { has_heatmap_analytics: true } : null,
        isImpersonated: false
      });
    } catch (error) {
      console.error("Login failed:", error);
      alert("Invalid Operator ID or Access Token.");
    } finally {
      setTenantLoading(false);
    }
  };


  return (
    <MantineProvider defaultColorScheme="light" theme={theme}>
      <GlobalLoader visible={loading} />
      <TenantLoader visible={tenantLoading} />
      
      {/* Diagnostic Overlay (Hidden in production usually, but good for debug) */}
      <Box style={{ position: 'fixed', bottom: 5, left: 5, zIndex: 9999, pointerEvents: 'none' }}>
         <Text size="8px" c="dimmed">AUTH: {isAuthenticated ? 'YES' : 'NO'} | ROLE: {user?.role || 'NONE'} | PATH: {window.location.hash}</Text>
      </Box>

      <DesignerProvider>
        <HashRouter>
          <MeshBackground />
          <AnimatePresence mode="wait">
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
                      <RoleGuard allowedRoles={['GLOBAL_OWNER', 'TENANT_ADMIN']}>
                        <Dashboard mode="light" />
                      </RoleGuard>
                    } 
                  />
                  <Route 
                    path="anti-cheat" 
                    element={
                      <RoleGuard allowedRoles={['GLOBAL_OWNER', 'TENANT_MODERATOR']}>
                        <AntiCheat />
                      </RoleGuard>
                    } 
                  />
                  <Route 
                    path="users" 
                    element={
                      <RoleGuard allowedRoles={['GLOBAL_OWNER', 'TENANT_ADMIN']}>
                        <Users />
                      </RoleGuard>
                    } 
                  />
                  <Route 
                    path="white-label" 
                    element={
                      <RoleGuard allowedRoles={['GLOBAL_OWNER', 'TENANT_ADMIN']}>
                        <WhiteLabelEngine />
                      </RoleGuard>
                    } 
                  />
                  <Route 
                    path="sponsor" 
                    element={
                      <RoleGuard allowedRoles={['GLOBAL_OWNER', 'SPONSOR']}>
                        <SponsorDashboard />
                      </RoleGuard>
                    } 
                  />
                </Route>
                <Route path="/unauthorized" element={
                  <Box p={50} ta="center">
                    <Title order={1} c="red">Access Denied</Title>
                    <Text>Your operator level is insufficient for this zone.</Text>
                    <Button mt="xl" component={Link} to="/">Return to Base</Button>
                  </Box>
                } />
                <Route path="*" element={<Navigate to="/owner/dashboard" replace />} />
              </Routes>
            )}
          </AnimatePresence>
        </HashRouter>
      </DesignerProvider>
    </MantineProvider>
  );
}
