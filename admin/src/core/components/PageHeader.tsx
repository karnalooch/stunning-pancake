import React from 'react';
import { Group, Stack, Text, Box } from '@mantine/core';

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  gradient?: boolean;
  breadcrumbs?: Breadcrumb[];
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  gradient = false,
  breadcrumbs,
  children,
}) => (
  <Box mb="xl">
    {breadcrumbs && breadcrumbs.length > 0 && (
      <Group gap={6} mb={6}>
        {breadcrumbs.map((crumb, i) => (
          <React.Fragment key={i}>
            {i > 0 && (
              <Text size="xs" style={{ color: 'var(--text-tertiary)' }}>/</Text>
            )}
            <Text
              size="xs"
              fw={500}
              style={{
                color: i === breadcrumbs.length - 1
                  ? 'var(--text-secondary)'
                  : 'var(--text-tertiary)',
              }}
            >
              {crumb.label}
            </Text>
          </React.Fragment>
        ))}
      </Group>
    )}

    <Group justify="space-between" align="flex-start">
      <Stack gap={2}>
        <Text
          component="h1"
          style={{
            fontSize: '26px',
            fontWeight: 800,
            lineHeight: 1.25,
            letterSpacing: '-0.02em',
            color: gradient ? undefined : 'var(--text-primary)',
            ...(gradient
              ? {
                  background: 'var(--brand-gradient)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }
              : {}),
          }}
        >
          {title}
        </Text>
        {subtitle && (
          <Text size="sm" style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
            {subtitle}
          </Text>
        )}
      </Stack>

      {children && (
        <Group gap="sm" align="center">
          {children}
        </Group>
      )}
    </Group>
  </Box>
);