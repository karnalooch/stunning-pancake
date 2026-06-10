import React from 'react';
import { Alert, Group, Button, Text } from '@mantine/core';
import { Building2, X } from 'lucide-react';
import { Link } from 'react-router-dom';

interface TenantFilterBannerProps {
  tenantId: string;
  tenantName?: string | null;
  onClearPath: string;
}

export const TenantFilterBanner: React.FC<TenantFilterBannerProps> = ({
  tenantId,
  tenantName,
  onClearPath,
}) => (
  <Alert
    mb="md"
    variant="light"
    color="indigo"
    icon={<Building2 size={18} />}
    title={`Filtered to ${tenantName || tenantId}`}
  >
    <Group justify="space-between" wrap="wrap" gap="sm">
      <Text size="sm">Global owner view — showing records for this tenant only.</Text>
      <Button
        component={Link}
        to={onClearPath}
        size="xs"
        variant="subtle"
        leftSection={<X size={14} />}
      >
        Clear filter
      </Button>
    </Group>
  </Alert>
);
