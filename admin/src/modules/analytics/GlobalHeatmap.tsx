import React from 'react';
import { Box, Text } from '@mantine/core';
import { Map } from 'lucide-react';

export const GlobalHeatmap: React.FC = () => (
  <Box style={{ padding: 24, textAlign: 'center' }}>
    <Map size={48} style={{ color: 'var(--accent)', marginBottom: 16, opacity: 0.5 }} />
    <Text fw={600} mb={4}>Activity Heatmap</Text>
    <Text size="sm" c="dimmed">Heatmap visualization now available in the Dashboard via User Map View.</Text>
  </Box>
);
