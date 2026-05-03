import React from 'react';
import { Title, Text, Group, Stack } from '@mantine/core';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, children }) => (
  <Group justify="space-between" align="flex-start" mb="xl">
    <Stack gap={0}>
      <Title order={1}>{title}</Title>
      {subtitle && <Text size="sm" c="dimmed" mt={4}>{subtitle}</Text>}
    </Stack>
    {children && <Group>{children}</Group>}
  </Group>
);
