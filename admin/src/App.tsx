import { Box } from '@mantine/core';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sidebar, Taskbar, WinWindow } from './core/Layout';
import { Dashboard } from './modules/dashboard/Dashboard';
import { Tenants } from './modules/tenants/Tenants';
import { AntiCheat } from './modules/anti-cheat/AntiCheat';
import { Users } from './modules/users/Users';
import { DesignerProvider } from './providers/DesignerProvider';
import { RoleGuard } from './core/guards/RoleGuard';
import { SponsorDashboard } from './modules/sponsor/SponsorDashboard';
import { LandingPage } from './modules/public/LandingPage';
import { motion, AnimatePresence } from 'framer-motion';

const MeshBackground = () => (
  <Box 
    style={{ 
      position: 'fixed', 
      top: 0, left: 0, right: 0, bottom: 0, 
      zIndex: -1,
      background: 'radial-gradient(circle at 20% 30%, rgba(0, 210, 255, 0.05) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(146, 254, 157, 0.05) 0%, transparent 40%)',
    }} 
  />
);

// Dummy views for remaining modules
const PlaceholderView = ({ title }: { title: string }) => (
  <WinWindow title={`${title}.exe`}>
    <Box p="xl" style={{ textAlign: 'center' }}>
      <Box style={{ fontSize: '48px', marginBottom: '20px' }}>🚧</Box>
      <Box style={{ fontWeight: 600 }}>{title} Module Under Construction</Box>
      <Box style={{ fontSize: '12px', opacity: 0.5, marginTop: '10px' }}>
        Constitution §5.2: Adaptive Operational Control In-Flight
      </Box>
    </Box>
  </WinWindow>
);

const queryClient = new QueryClient();

export default function App() {
  const mode = import.meta.env.VITE_APP_MODE || 'DEVELOPMENT';
  
  return (
    <QueryClientProvider client={queryClient}>
      <DesignerProvider>
      <BrowserRouter>
        <Box h="100vh" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          <MeshBackground />
          <Box style={{ flex: 1, display: 'flex', gap: '20px', padding: '20px', overflow: 'hidden' }}>
            <Sidebar mode={mode} />
            
            <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key="content"
                  initial={{ opacity: 0, y: 10, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                >
                  <Routes>
                    <Route path="/landing" element={<LandingPage />} />
                    
                    {/* GLOBAL OWNER ROUTES */}
                    <Route element={<RoleGuard allowedRoles={['GLOBAL_OWNER']} />}>
                      <Route path="/" element={<Dashboard mode={mode} />} />
                      <Route path="/tenants" element={<Tenants />} />
                      <Route path="/settings" element={<PlaceholderView title="System Settings" />} />
                    </Route>

                    {/* TENANT ADMIN & MODERATOR ROUTES */}
                    <Route element={<RoleGuard allowedRoles={['GLOBAL_OWNER', 'TENANT_ADMIN', 'TENANT_MODERATOR']} />}>
                      <Route path="/users" element={<Users />} />
                      <Route path="/anti-cheat" element={<AntiCheat />} />
                    </Route>

                    {/* SPONSOR ROUTES */}
                    <Route element={<RoleGuard allowedRoles={['GLOBAL_OWNER', 'SPONSOR']} />}>
                      <Route path="/sponsor" element={<SponsorDashboard />} />
                    </Route>
                    
                    {/* FALLBACKS */}
                    <Route path="/unauthorized" element={<PlaceholderView title="403 - Unauthorized Access" />} />
                    <Route path="/login" element={<PlaceholderView title="Authentication System" />} />
                  </Routes>
                </motion.div>
              </AnimatePresence>
            </Box>
          </Box>

          <Taskbar />
        </Box>
      </BrowserRouter>
    </DesignerProvider>
    </QueryClientProvider>
  );
}
