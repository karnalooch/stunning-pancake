import React from 'react';
import { Box, SimpleGrid, Group, Stack, Text, Badge, Progress } from '@mantine/core';
import { WinWindow } from '../../core/Layout';
import { Gift, Store, Users, Eye } from 'lucide-react';
import { Metric, Flex, BarChart } from '@tremor/react';

const SPONSOR_DATA = [
  { name: 'Redeemed', 'Vouchers': 420 },
  { name: 'Active', 'Vouchers': 1200 },
  { name: 'Expired', 'Vouchers': 85 },
];

export const SponsorDashboard = () => {
  return (
    <Box style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
      <Group justify="space-between">
        <Stack gap={0}>
          <Text className="text-gradient" style={{ fontSize: '24px', fontWeight: 900 }}>Sponsor Command Center</Text>
          <Text size="xs" c="dimmed">Event: Masovian Cycling Tour 2026</Text>
        </Stack>
        <Badge variant="filled" color="violet">PREMIUM SPONSOR</Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xl">
        <Box p="lg" className="fluent-acrylic stat-card-premium glow-blue">
          <Flex alignItems="start">
            <Stack gap={0}>
              <Group gap="xs">
                <Store size={14} color="#60cdff" />
                <Text size="xs" tt="uppercase" fw={700} c="dimmed">Your POIs</Text>
              </Group>
              <Metric style={{ color: 'white', fontWeight: 900 }}>12</Metric>
            </Stack>
            <Badge variant="light" color="blue" size="sm">ACTIVE</Badge>
          </Flex>
          <Progress value={100} color="blue" mt="md" size="xs" />
        </Box>

        <Box p="lg" className="fluent-acrylic stat-card-premium glow-lime">
          <Flex alignItems="start">
            <Stack gap={0}>
              <Group gap="xs">
                <Gift size={14} color="var(--mantine-primary-color-filled)" />
                <Text size="xs" tt="uppercase" fw={700} c="dimmed">Vouchers Distributed</Text>
              </Group>
              <Metric style={{ color: 'white', fontWeight: 900 }}>1,842</Metric>
            </Stack>
          </Flex>
          <Progress value={65} color="lime" mt="md" size="xs" />
        </Box>

        <Box p="lg" className="fluent-acrylic stat-card-premium">
          <Flex alignItems="start">
            <Stack gap={0}>
              <Group gap="xs">
                <Eye size={14} color="#ffcc00" />
                <Text size="xs" tt="uppercase" fw={700} c="dimmed">Impressions</Text>
              </Group>
              <Metric style={{ color: 'white', fontWeight: 900 }}>42.1K</Metric>
            </Stack>
          </Flex>
          <Progress value={88} color="amber" mt="md" size="xs" />
        </Box>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" style={{ flex: 1 }}>
        <WinWindow title="Voucher Lifecycle Analytics">
          <BarChart
            className="h-72 mt-4"
            data={SPONSOR_DATA}
            index="name"
            categories={["Vouchers"]}
            colors={["blue"]}
            yAxisWidth={48}
          />
        </WinWindow>

        <WinWindow title="Recent Redemptions">
          <Stack gap="xs">
            {[1, 2, 3, 4, 5].map((i) => (
              <Group key={i} justify="space-between" p="xs" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <Group gap="sm">
                  <Box w={32} h={32} bg="rgba(255,255,255,0.05)" style={{ borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users size={14} />
                  </Box>
                  <Box>
                    <Text size="sm" fw={600}>Athlete #{4000 + i}</Text>
                    <Text size="xs" c="dimmed">Redeemed: -20% Coffee Voucher</Text>
                  </Box>
                </Group>
                <Text size="xs" c="dimmed">{i * 2} min ago</Text>
              </Group>
            ))}
          </Stack>
        </WinWindow>
      </SimpleGrid>
    </Box>
  );
};
