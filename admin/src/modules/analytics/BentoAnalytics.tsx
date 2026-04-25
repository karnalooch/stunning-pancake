import React from 'react';
import { Container, Grid, Paper, Title, Text, Group, Stack, SimpleGrid } from '@mantine/core';
import { motion } from 'framer-motion';
import { AreaChart, Card, Metric, Text as TremorText, Title as TremorTitle } from '@tremor/react';

// Milestone 7.1 & 7.3: Bento Grid + Tremor + Framer Motion
const chartdata = [
  { date: 'Jan 22', 'Active Users': 2890, 'Distance (km)': 2338 },
  { date: 'Feb 22', 'Active Users': 2756, 'Distance (km)': 2103 },
  { date: 'Mar 22', 'Active Users': 3322, 'Distance (km)': 2194 },
  { date: 'Apr 22', 'Active Users': 3470, 'Distance (km)': 2108 },
  { date: 'May 22', 'Active Users': 3475, 'Distance (km)': 1812 },
  { date: 'Jun 22', 'Active Users': 3129, 'Distance (km)': 1726 },
];

const MotionPaper = motion(Paper);

export const BentoAnalytics: React.FC = () => {
  return (
    <Container fluid p="md">
      <Stack gap="xl">
        <Stack gap={0}>
          <Title order={1} fw={900} lts={-1.5} style={{ fontSize: '42px' }}>
            Hyperscale Analytics
          </Title>
          <Text c="dimmed" fw={600}>Milestone 7: The New Era Visualization Engine</Text>
        </Stack>

        <Grid gutter="md">
          {/* Main Chart - Large Bento Item */}
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <MotionPaper
              p="xl"
              radius="lg"
              withBorder
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <TremorTitle>User Engagement Trend</TremorTitle>
              <TremorText>Real-time telemetry ingestion across 200 cities.</TremorText>
              <AreaChart
                className="h-72 mt-4"
                data={chartdata}
                index="date"
                categories={['Active Users', 'Distance (km)']}
                colors={['cyan', 'indigo']}
                valueFormatter={(number: number) =>
                  Intl.NumberFormat('us').format(number).toString()
                }
              />
            </MotionPaper>
          </Grid.Col>

          {/* Side Metrics - Vertical Bento Item */}
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Stack gap="md" h="100%">
              <MotionPaper
                p="xl"
                radius="lg"
                withBorder
                flex={1}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                style={{ background: 'linear-gradient(135deg, rgba(0,209,255,0.1) 0%, transparent 100%)' }}
              >
                <Metric>184.2k</Metric>
                <TremorText>Total Active Athletes</TremorText>
                <Badge mt="xs" color="teal" variant="light">+12.5% this week</Badge>
              </MotionPaper>
              <MotionPaper
                p="xl"
                radius="lg"
                withBorder
                flex={1}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <Metric>38M km</Metric>
                <TremorText>Cumulative Distance</TremorText>
              </MotionPaper>
            </Stack>
          </Grid.Col>

          {/* Small Bento Grid Items */}
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
             <BentoSmallItem title="Ingestion Rate" value="10.2k/s" status="Optimal" delay={0.4} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
             <BentoSmallItem title="Anti-Cheat Load" value="45%" status="Healthy" delay={0.5} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
             <BentoSmallItem title="Redis Latency" value="1.2ms" status="Excellent" delay={0.6} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
             <BentoSmallItem title="Active Sessions" value="12,402" status="Peak" delay={0.7} />
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
};

const Badge = ({ children, color, variant, mt }: any) => (
  <div style={{ 
    marginTop: mt, 
    display: 'inline-block', 
    padding: '4px 12px', 
    borderRadius: '20px', 
    fontSize: '12px', 
    fontWeight: 700, 
    background: variant === 'light' ? `rgba(0,255,148,0.1)` : '#eee',
    color: color === 'teal' ? '#00FF94' : '#666'
  }}>
    {children}
  </div>
);

const BentoSmallItem = ({ title, value, status, delay }: any) => (
  <MotionPaper
    p="lg"
    radius="lg"
    withBorder
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.5, delay }}
    whileHover={{ scale: 1.02 }}
  >
    <Stack gap={0}>
      <Text size="xs" c="dimmed" fw={700} tt="uppercase">{title}</Text>
      <Title order={2} fw={900}>{value}</Title>
      <Text size="xs" c="teal" fw={700} mt={4}>{status}</Text>
    </Stack>
  </MotionPaper>
);
