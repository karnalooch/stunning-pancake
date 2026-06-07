import React, { useEffect, useState } from 'react';
import { Box, Loader, Stack, Text } from '@mantine/core';

interface RouteLoadingCardProps {
  title: string;
  subtitle?: string;
  minDelayMs?: number;
}

export const RouteLoadingCard: React.FC<RouteLoadingCardProps> = ({
  title,
  subtitle = 'Fetching data from control plane…',
  minDelayMs = 0,
}) => {
  const [visible, setVisible] = useState(minDelayMs <= 0);

  useEffect(() => {
    if (minDelayMs <= 0) return;
    const t = window.setTimeout(() => setVisible(true), minDelayMs);
    return () => window.clearTimeout(t);
  }, [minDelayMs]);

  if (!visible) return null;

  return (
    <Box
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '28px 24px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <Stack gap="sm" align="center">
        <Loader size="sm" type="dots" color="indigo" />
        <Text fw={600} size="sm" style={{ color: 'var(--text-primary)' }}>{title}</Text>
        <Text size="xs" c="dimmed" ta="center">{subtitle}</Text>
      </Stack>
    </Box>
  );
};
