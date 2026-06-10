import React from 'react';
import { Stack, Text, Group, Button } from '@mantine/core';
import { Gift, MapPin, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

interface SponsorEmptyCtaProps {
  title?: string;
  description?: string;
}

export const SponsorEmptyCta: React.FC<SponsorEmptyCtaProps> = ({
  title = 'Welcome to your sponsor portal',
  description = 'Create your first voucher pool and add a POI so athletes can discover and redeem your rewards.',
}) => (
  <Stack align="center" py="xl" gap="md">
    <Gift size={48} style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} />
    <Text fw={600}>{title}</Text>
    <Text c="dimmed" size="sm" maw={420} ta="center">
      {description}
    </Text>
    <Group>
      <Button component={Link} to="/owner/analytics/vouchers" leftSection={<Plus size={16} />}>
        Create first voucher
      </Button>
      <Button component={Link} to="/owner/sponsor/poi" variant="light" leftSection={<MapPin size={16} />}>
        Add POI location
      </Button>
    </Group>
  </Stack>
);
