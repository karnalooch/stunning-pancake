import React from 'react';
import { Box } from '@mantine/core';
import { TenantScopeBanner } from './TenantScopeBanner';
import { useTenantScope } from '../../hooks/useTenantScope';
import { useI18n } from '../../i18n/useI18n';

/** Wraps tenant-scoped analytics pages with scope banner. */
export const TenantAnalyticsScope: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const scope = useTenantScope(null);
  const { t } = useI18n();

  if (!scope.isTenantScoped) {
    return <>{children}</>;
  }

  const roleLabel = scope.isTenantAdmin ? t.tenant.tenantAdmin : t.tenant.moderator;

  return (
    <Box>
      <Box px="md" pt="md">
        <TenantScopeBanner
          tenantId={scope.tenantId}
          tenantName={scope.tenantName}
          roleLabel={roleLabel}
        />
      </Box>
      {children}
    </Box>
  );
};
