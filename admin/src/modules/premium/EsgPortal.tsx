import React, { useState } from 'react';
import { Box, Card, Text, NumberInput, SimpleGrid, ThemeIcon, Stack, Group } from '@mantine/core';
import { Leaf, Fuel, Heart } from 'lucide-react';
import { PageHeader } from '../../core/components/PageHeader';

export const EsgPortal: React.FC = () => {
  const [distanceKm, setDistanceKm] = useState(10000);

  const km = distanceKm / 1000;
  const co2Kg = km * 0.21;
  const fuelL = km * 0.07;

  return (
    <Box>
      <PageHeader title="Green City ESG Portal" subtitle="Sustainability metrics for city partners (ROADMAP_V3 §7.3)" />
      <NumberInput
        label="Total active distance (meters)"
        value={distanceKm}
        onChange={(v) => setDistanceKm(Number(v) || 0)}
        mb="xl"
        maw={320}
      />
      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="xl">
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
          <Group gap="sm">
            <ThemeIcon size={40} color="green" variant="light"><Leaf size={20} /></ThemeIcon>
            <Stack gap={0}>
              <Text size="xs" c="dimmed">CO₂ offset</Text>
              <Text fw={800} size="xl">{co2Kg.toFixed(0)} kg</Text>
            </Stack>
          </Group>
        </Card>
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
          <Group gap="sm">
            <ThemeIcon size={40} color="orange" variant="light"><Fuel size={20} /></ThemeIcon>
            <Stack gap={0}>
              <Text size="xs" c="dimmed">Fuel saved</Text>
              <Text fw={800} size="xl">{fuelL.toFixed(0)} L</Text>
            </Stack>
          </Group>
        </Card>
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
          <Group gap="sm">
            <ThemeIcon size={40} color="red" variant="light"><Heart size={20} /></ThemeIcon>
            <Stack gap={0}>
              <Text size="xs" c="dimmed">Active health</Text>
              <Text fw={800} size="xl">Community KPI</Text>
            </Stack>
          </Group>
        </Card>
      </SimpleGrid>
      <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, minHeight: 200 }}>
        <Text c="dimmed" ta="center" py="xl">MapLibre green heatmap — connect to tenant activity aggregates in a future sprint.</Text>
      </Card>
    </Box>
  );
};
