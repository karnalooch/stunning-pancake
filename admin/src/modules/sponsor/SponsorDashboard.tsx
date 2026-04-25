import React from 'react';
import { Box, SimpleGrid, Group, Stack, Text, Badge, Progress } from '@mantine/core';
import { WinWindow } from '../../core/Layout';
import { Gift, Store, Users, Eye } from 'lucide-react';
import { Metric, Flex, BarChart } from '@tremor/react';
import { motion } from 'framer-motion';


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
        {[
          { icon: <Store size={14} color="#60cdff" />, label: 'Your POIs', value: '12', badge: 'ACTIVE', color: 'blue', progress: 100, glow: 'glow-blue' },
          { icon: <Gift size={14} color="var(--mantine-primary-color-filled)" />, label: 'Vouchers Distributed', value: '1,842', badge: '65%', color: 'lime', progress: 65, glow: 'glow-lime' },
          { icon: <Eye size={14} color="#ffcc00" />, label: 'Impressions', value: '42.1K', badge: 'TOP 5%', color: 'amber', progress: 88, glow: '' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Box p="lg" className={`fluent-acrylic stat-card-premium ${stat.glow}`}>
              <Flex alignItems="start">
                <Stack gap={0}>
                  <Group gap="xs">
                    {stat.icon}
                    <Text size="xs" tt="uppercase" fw={700} c="dimmed">{stat.label}</Text>
                  </Group>
                  <Metric style={{ color: 'white', fontWeight: 900 }}>{stat.value}</Metric>
                </Stack>
                <Badge variant="light" color={stat.color} size="sm">{stat.badge}</Badge>
              </Flex>
              <Progress value={stat.progress} color={stat.color} mt="md" size="xs" />
            </Box>
          </motion.div>
        ))}
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
