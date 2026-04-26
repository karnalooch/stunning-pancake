import React from 'react';
import { Card, Text, Group, Stack, Badge, Progress } from '@mantine/core';
import { motion } from 'framer-motion';

interface StatCardProps {
  label: string;
  value: string;
  badge: string;
  color: string;
  progress: number;
  icon: React.ReactNode;
  glow?: string;
}


export const StatCard: React.FC<StatCardProps> = ({ label, value, badge, color, progress, icon }) => {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card p="lg" radius="xl" className="fluent-acrylic glow-cyan stat-card-premium" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
        <Group justify="space-between" align="start">
          <Stack gap={0}>
            <Group gap="xs" mb={4}>
              <Box style={{ color: `var(--mantine-color-${color}-filled)` }}>{icon}</Box>
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">{label}</Text>
            </Group>
            <Text size="xl" fw={900} style={{ color: 'white' }}>{value}</Text>
          </Stack>
          <Badge variant="light" color={color} size="sm">{badge}</Badge>
        </Group>
        <Progress value={progress} color={color} mt="md" size="xs" radius="xl" />
      </Card>
    </motion.div>
  );
};

// Internal Box for icons if needed
const Box = ({ children, style }: any) => <div style={style}>{children}</div>;
