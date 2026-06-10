import React from 'react';
import { Menu, ActionIcon, Button } from '@mantine/core';
import { MoreHorizontal, Users, Activity, Map } from 'lucide-react';
import { Link } from 'react-router-dom';
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
        <Menu.Item
          component={Link}
          to={tenantUsersUrl(tenantId, tenantName)}
          leftSection={<Users size={14} />}
        >
          Users
        </Menu.Item>
        <Menu.Item
          component={Link}
          to={tenantActivitiesUrl(tenantId, tenantName)}
          leftSection={<Activity size={14} />}
        >
          Activities
        </Menu.Item>
        <Menu.Item
          component={Link}
          to={tenantLiveMapUrl(tenantId, tenantName)}
          leftSection={<Map size={14} />}
        >
          Live Map
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};
