import React from 'react';
import { Card, SimpleGrid, Text, ThemeIcon, Group, Badge } from '@mantine/core';
import { Users, Activity, Building2, Palette, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface TenantAdminQuickActionsProps {
  pendingReview?: number;
  tenantId?: string | null;
}

const actions = [
  { icon: Users, label: 'Athletes', desc: 'Manage users', to: '/owner/users', color: 'indigo' },
  { icon: Activity, label: 'Activities', desc: 'Review sessions', to: '/owner/activities', color: 'green' },
  { icon: Building2, label: 'Departments', desc: 'Org structure', to: '/owner/departments', color: 'violet' },
  { icon: Palette, label: 'White-Label', desc: 'City branding', to: '/owner/white-label', color: 'orange' },
];

export const TenantAdminQuickActions: React.FC<TenantAdminQuickActionsProps> = ({
  pendingReview = 0,
  tenantId,
}) => {
  const usersLink = tenantId ? `/owner/users?tenant_id=${encodeURIComponent(tenantId)}` : '/owner/users';
  const activitiesLink = '/owner/activities?status=pending';

  return (
    <Card
      mb="xl"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '18px 22px',
      }}
    >
      <Group justify="space-between" mb="md">
        <Text fw={700} size="sm">City control panel</Text>
        {pendingReview > 0 && (
          <Badge color="orange" variant="light" leftSection={<AlertTriangle size={12} />}>
            {pendingReview.toLocaleString()} pending review
          </Badge>
        )}
      </Group>
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        {actions.map((item) => {
          const to = item.label === 'Athletes' ? usersLink : item.label === 'Activities' ? activitiesLink : item.to;
          return (
            <Card
              key={item.label}
              component={Link}
              to={to}
              style={{
                textDecoration: 'none',
                background: 'var(--surface-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                padding: 14,
                cursor: 'pointer',
              }}
            >
              <ThemeIcon size={32} radius="md" color={item.color} variant="light" mb="xs">
                <item.icon size={16} />
              </ThemeIcon>
              <Text fw={600} size="sm" c="var(--text-primary)">{item.label}</Text>
              <Text size="xs" c="dimmed">{item.desc}</Text>
            </Card>
          );
        })}
      </SimpleGrid>
    </Card>
  );
};
