import React from 'react';
import { Card, SimpleGrid, Text, ThemeIcon, Group, Badge } from '@mantine/core';
import { Users, Activity, Building2, Palette, AlertTriangle, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';

interface TenantAdminQuickActionsProps {
  pendingReview?: number;
  tenantId?: string | null;
}

export const TenantAdminQuickActions: React.FC<TenantAdminQuickActionsProps> = ({
  pendingReview = 0,
  tenantId,
}) => {
  const { t } = useI18n();
  const usersLink = tenantId ? `/owner/users?tenant_id=${encodeURIComponent(tenantId)}` : '/owner/users';
  const activitiesLink = '/owner/activities?status=pending';
  const actions = [
    { id: 'athletes', icon: Users, label: t.tenant.quickAthletes, desc: t.tenant.quickAthletesDesc, to: '/owner/users', color: 'indigo' },
    { id: 'activities', icon: Activity, label: t.tenant.quickActivities, desc: t.tenant.quickActivitiesDesc, to: '/owner/activities', color: 'green' },
    { id: 'departments', icon: Building2, label: t.tenant.quickDepartments, desc: t.tenant.quickDepartmentsDesc, to: '/owner/departments', color: 'violet' },
    { id: 'whiteLabel', icon: Palette, label: t.tenant.quickWhiteLabel, desc: t.tenant.quickWhiteLabelDesc, to: '/owner/white-label', color: 'orange' },
    { id: 'moderation', icon: Inbox, label: t.tenant.quickModeration, desc: t.tenant.quickModerationDesc, to: '/owner/moderation', color: 'red' },
  ];

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
        <Text fw={700} size="sm">{t.tenant.cityControlPanel}</Text>
        {pendingReview > 0 && (
          <Badge color="orange" variant="light" leftSection={<AlertTriangle size={12} />}>
            {pendingReview.toLocaleString()} {t.tenant.pendingReview}
          </Badge>
        )}
      </Group>
      <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="md">
        {actions.map((item) => {
          const to = item.id === 'athletes' ? usersLink : item.id === 'activities' ? activitiesLink : item.to;
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
