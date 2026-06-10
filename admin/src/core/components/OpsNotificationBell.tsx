import React from 'react';
import { ActionIcon, Badge, Menu, Text, Group } from '@mantine/core';
import { Bell, Inbox, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOpsNotifications } from '../../hooks/useOpsNotifications';
import { useI18n } from '../../i18n/useI18n';

export const OpsNotificationBell: React.FC = () => {
  const { items, total } = useOpsNotifications();
  const { t } = useI18n();

  if (items.length === 0) return null;

  const labelFor = (key: 'moderation' | 'feedback') => {
    if (key === 'moderation') return t.nav.items.moderationInbox;
    return t.nav.items.feedback;
  };

  const iconFor = (key: 'moderation' | 'feedback') => {
    if (key === 'moderation') return <Inbox size={14} />;
    return <MessageSquare size={14} />;
  };

  return (
    <Menu position="bottom-end" withArrow shadow="md" width={260}>
      <Menu.Target>
        <ActionIcon variant="subtle" size="lg" aria-label={t.layout.opsAlerts} style={{ position: 'relative' }}>
          <Bell size={18} />
          {total > 0 && (
            <Badge
              size="xs"
              circle
              color="red"
              style={{ position: 'absolute', top: 2, right: 2, pointerEvents: 'none' }}
            >
              {total > 99 ? '99+' : total}
            </Badge>
          )}
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{t.layout.opsAlerts}</Menu.Label>
        {items.map((item) => (
          <Menu.Item
            key={item.id}
            component={Link}
            to={item.path}
            leftSection={iconFor(item.labelKey)}
            rightSection={
              <Badge size="sm" variant="light" color="orange">
                {item.count}
              </Badge>
            }
          >
            <Group gap={4}>
              <Text size="sm">{labelFor(item.labelKey)}</Text>
            </Group>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
};
