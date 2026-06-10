import React from 'react';
import { Alert, Text, Badge, Group } from '@mantine/core';
import { Building2 } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';

export interface TenantScopeBannerProps {
  tenantName?: string | null;
  tenantId?: string | null;
  roleLabel?: string;
}

export const TenantScopeBanner: React.FC<TenantScopeBannerProps> = ({
  tenantName,
  tenantId,
  roleLabel,
}) => {
  const { t } = useI18n();
  if (!tenantId) return null;
  const label = tenantName || tenantId;

  return (
    <Alert
      mb="md"
      variant="light"
      color="blue"
      icon={<Building2 size={18} />}
      title={
        <Group gap="xs">
          <Text span fw={600}>{label}</Text>
          {roleLabel && (
            <Badge size="xs" variant="light" color="blue">{roleLabel}</Badge>
          )}
        </Group>
      }
    >
      <Text size="sm">{t.tenant.scopeMessage}</Text>
    </Alert>
  );
};
