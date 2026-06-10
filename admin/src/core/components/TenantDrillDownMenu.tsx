import React, { useState } from 'react';
import { Menu, ActionIcon, Button } from '@mantine/core';
import { MoreHorizontal, Users, Activity, Map, Ban, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { apiClient } from '../../api/client';
import { useAuth } from '../auth/useAuth';
import { useI18n } from '../../i18n/useI18n';
import {
  tenantActivitiesUrl,
  tenantLiveMapUrl,
  tenantUsersUrl,
} from '../../utils/tenantDrillDown';

interface TenantDrillDownMenuProps {
  tenantId: string;
  tenantName: string;
  variant?: 'icon' | 'button';
}

export const TenantDrillDownMenu: React.FC<TenantDrillDownMenuProps> = ({
  tenantId,
  tenantName,
  variant = 'icon',
}) => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [suspended, setSuspended] = useState(false);
  const isGo = user?.role === 'GLOBAL_OWNER';

  const toggleSuspend = async () => {
    const next = !suspended;
    try {
      await apiClient.patch(`/users/branding/${tenantId}/update/`, { is_active: !next });
      setSuspended(next);
      notifications.show({
        title: next ? t.dashboard.tenantSuspended : t.dashboard.tenantReactivated,
        color: next ? 'orange' : 'green',
        message: tenantName,
      });
    } catch {
      notifications.show({ title: t.common.error, message: t.settings.saveFailed, color: 'red' });
    }
  };

  const trigger =
    variant === 'button' ? (
      <Button size="xs" variant="light" rightSection={<MoreHorizontal size={14} />}>
        Drill down
      </Button>
    ) : (
      <ActionIcon variant="subtle" size="sm" aria-label={`Drill down ${tenantName}`}>
        <MoreHorizontal size={16} />
      </ActionIcon>
    );

  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>{trigger}</Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{tenantName}</Menu.Label>
        <Menu.Item component={Link} to={tenantUsersUrl(tenantId, tenantName)} leftSection={<Users size={14} />}>
          {t.nav.items.users}
        </Menu.Item>
        <Menu.Item component={Link} to={tenantActivitiesUrl(tenantId, tenantName)} leftSection={<Activity size={14} />}>
          {t.nav.items.activities}
        </Menu.Item>
        <Menu.Item component={Link} to={tenantLiveMapUrl(tenantId, tenantName)} leftSection={<Map size={14} />}>
          {t.nav.items.liveMap}
        </Menu.Item>
        {isGo && (
          <Menu.Item
            leftSection={suspended ? <CheckCircle size={14} /> : <Ban size={14} />}
            color={suspended ? 'green' : 'red'}
            onClick={() => void toggleSuspend()}
          >
            {suspended ? t.dashboard.reactivateTenant : t.dashboard.suspendTenant}
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  );
};
