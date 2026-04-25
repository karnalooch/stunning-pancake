import React from 'react';
import { Box } from '@mantine/core';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Sidebar, Taskbar, WinWindow } from './core/Layout';
import { Dashboard } from './modules/dashboard/Dashboard';

// Dummy views for Phase 1
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
    <BrowserRouter>
      <Box h="100vh" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box style={{ flex: 1, display: 'flex', gap: '20px', padding: '20px', overflow: 'hidden' }}>
          <Sidebar mode={mode} />
          
          <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Routes>
              <Route path="/" element={<Dashboard mode={mode} />} />
              <Route path="/tenants" element={<PlaceholderView title="Tenant Management" />} />
              <Route path="/users" element={<PlaceholderView title="User Audit Suite" />} />
              <Route path="/anti-cheat" element={<PlaceholderView title="Anti-Cheat Command Center" />} />
              <Route path="/settings" element={<PlaceholderView title="System Settings" />} />
            </Routes>
          </Box>
        </Box>

        {/* OS Taskbar */}
        <Taskbar />
      </Box>
    </BrowserRouter>
  );
}
