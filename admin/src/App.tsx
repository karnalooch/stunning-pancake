import React, { useState, useEffect } from 'react';
import { MantineProvider, Box } from '@mantine/core';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

import { motion, AnimatePresence } from 'framer-motion';

const MeshBackground = () => (
  <Box
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: -1,
      background: 'radial-gradient(circle at 50% 50%, #0a0a0a 0%, #000 100%)',
      overflow: 'hidden'
    }}
  >
    <motion.div
      animate={{ 
        scale: [1, 1.2, 1],
        rotate: [0, 90, 0],
      }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      style={{
        position: 'absolute',
        top: '-50%',
        left: '-50%',
        width: '200%',
        height: '200%',
        background: 'radial-gradient(circle at 30% 30%, rgba(37, 99, 235, 0.08) 0%, transparent 50%), radial-gradient(circle at 70% 70%, rgba(16, 185, 129, 0.05) 0%, transparent 50%)',
        filter: 'blur(80px)'
      }}
    />
  </Box>
);

export default function App() {
  const [loading, setLoading] = useState(true);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Simulate platform core boot sequence
    const timer = setTimeout(() => setLoading(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = () => {
    setTenantLoading(true);
    setTimeout(() => {
      setIsAuthenticated(true);
      setTenantLoading(false);
    }, 2000);
  };


  return (
    <MantineProvider defaultColorScheme="dark" theme={theme}>
      <GlobalLoader visible={loading} />
      <TenantLoader visible={tenantLoading} />
      <DesignerProvider>

        <BrowserRouter>
          <MeshBackground />
          <AnimatePresence mode="wait">
            {!isAuthenticated ? (
              <Routes>
                <Route path="*" element={<LoginPage onLogin={handleLogin} />} />
              </Routes>
            ) : (

              <Routes>
                {/* Public Landing Page */}
                <Route path="/" element={<LandingPage />} />
                
                <Route path="/admin" element={<Layout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route 
                    path="dashboard" 
                    element={
                      <RoleGuard allowedRoles={['GLOBAL_OWNER', 'TENANT_ADMIN']}>
                        <Dashboard mode="dark" />
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
                <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
              </Routes>
            )}
          </AnimatePresence>
        </BrowserRouter>
      </DesignerProvider>
    </MantineProvider>
  );
}
