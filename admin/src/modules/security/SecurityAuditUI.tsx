import React from 'react';
import { Card, Title, Text, AreaChart, BarList, Flex, Grid, Badge, Table } from '@tremor/react';
import { Container, Stack, Group, Title as MantineTitle } from '@mantine/core';
import { IconShieldCheck, IconLock, IconEye } from '@tabler/icons-react';

// Milestone 6.1: Security Audit UI (New Era)
const isolationData = [
  { name: 'Siedlce Tenant', value: 98 },
  { name: 'Warszawa Tenant', value: 99 },
  { name: 'Gdynia Tenant', value: 100 },
  { name: 'Corporate Plan A', value: 95 },
];

export const SecurityAuditUI: React.FC = () => {
  return (
    <Container fluid p="md">
      <Stack gap="lg">
        <Group justify="space-between">
          <Stack gap={0}>
            <MantineTitle order={1} fw={900} lts={-1}>Security Command Center</MantineTitle>
            <Text>Zero-Trust RLS & Policy Enforcement Monitoring</Text>
          </Stack>
          <Badge color="emerald">System Secure</Badge>
        </Group>

        <Grid numItemsLg={3} className="gap-6">
          <Card decoration="top" decorationColor="cyan">
            <Flex justifyContent="start" alignItems="center" className="space-x-2">
              <IconShieldCheck className="text-cyan-500" />
              <Title>RLS Integrity</Title>
            </Flex>
            <Text className="mt-2">Real-time isolation score per tenant</Text>
            <BarList data={isolationData} className="mt-4" />
          </Card>

          <Card decoration="top" decorationColor="indigo">
            <Flex justifyContent="start" alignItems="center" className="space-x-2">
              <IconLock className="text-indigo-500" />
              <Title>Policy Hits</Title>
            </Flex>
            <Text className="mt-2">Row Level Security access denied events</Text>
            <AreaChart
              className="h-48 mt-4"
              data={[
                { time: '00:00', hits: 2 },
                { time: '04:00', hits: 5 },
                { time: '08:00', hits: 1 },
                { time: '12:00', hits: 12 },
              ]}
              index="time"
              categories={['hits']}
              colors={['indigo']}
              showLegend={false}
            />
          </Card>

          <Card decoration="top" decorationColor="rose">
            <Flex justifyContent="start" alignItems="center" className="space-x-2">
              <IconEye className="text-rose-500" />
              <Title>Audit Log</Title>
            </Flex>
            <Table className="mt-4">
              <thead>
                <tr>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>akarn</td>
                  <td>Update RLS</td>
                  <td><Badge color="emerald">Success</Badge></td>
                </tr>
                <tr>
                  <td>system</td>
                  <td>Rotate Keys</td>
                  <td><Badge color="emerald">Success</Badge></td>
                </tr>
              </tbody>
            </Table>
          </Card>
        </Grid>
      </Stack>
    </Container>
  );
};
