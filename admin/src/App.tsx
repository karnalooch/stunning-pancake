import { Box } from '@mantine/core';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Sidebar, Taskbar, WinWindow } from './core/Layout';
import { Dashboard } from './modules/dashboard/Dashboard';
import { Tenants } from './modules/tenants/Tenants';
import { AntiCheat } from './modules/anti-cheat/AntiCheat';
import { Users } from './modules/users/Users';
import { DesignerProvider } from './providers/DesignerProvider';
import { RoleGuard } from './core/guards/RoleGuard';
import { useAuth } from './core/auth/useAuth';

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

export default function App() {
  const mode = import.meta.env.VITE_APP_MODE || 'DEVELOPMENT';
  
  return (
    <DesignerProvider>
      <BrowserRouter>
        <Box h="100vh" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box style={{ flex: 1, display: 'flex', gap: '20px', padding: '20px', overflow: 'hidden' }}>
            <Sidebar mode={mode} />
            
            <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <Routes>
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
                
                {/* FALLBACKS */}
                <Route path="/unauthorized" element={<PlaceholderView title="403 - Unauthorized Access" />} />
                <Route path="/login" element={<PlaceholderView title="Authentication System" />} />
              </Routes>
            </Box>
          </Box>

          <Taskbar />
        </Box>
      </BrowserRouter>
    </DesignerProvider>
  );
}
