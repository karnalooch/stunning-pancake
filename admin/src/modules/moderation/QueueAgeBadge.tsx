import React from 'react';
import { Badge, Tooltip } from '@mantine/core';
import { useI18n } from '../../i18n/useI18n';

function hoursSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 3_600_000;
}

export const QueueAgeBadge: React.FC<{ createdAt?: string | null }> = ({ createdAt }) => {
  const { t } = useI18n();
  const h = hoursSince(createdAt);
  if (h == null) return null;
  const color = h >= 48 ? 'red' : h >= 24 ? 'orange' : 'gray';
  const label = h >= 48 ? '>48h' : h >= 24 ? '>24h' : `${Math.round(h)}h`;
  const tooltip = t.moderation.queueAgeHours.replace('{hours}', String(Math.round(h)));
  return (
    <Tooltip label={tooltip}>
      <Badge size="xs" color={color} variant="light">{label}</Badge>
    </Tooltip>
  );
};
