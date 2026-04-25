import React from 'react';
import { Container, Grid, Paper, Title, Text, Stack, Group, RingProgress } from '@mantine/core';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Float, MeshDistortMaterial } from '@react-three/drei';
import { AreaChart, Card, Title as TremorTitle } from '@tremor/react';

// Milestone 6.2: Biometric Data Studio (New Era)
export const BiometricDataStudio: React.FC = () => {
  return (
    <Container fluid p="md">
      <Stack gap="xl">
        <Group justify="space-between">
          <Stack gap={0}>
            <Title order={1} fw={900} lts={-1.5}>Biometric Data Studio</Title>
            <Text c="dimmed" fw={600}>Immersive Wearable Fusion & Health Analytics</Text>
          </Stack>
        </Group>

        <Grid gutter="md">
          {/* 3D Biometric Visualization */}
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <Paper radius="lg" withBorder h={500} style={{ position: 'relative', overflow: 'hidden', background: '#0b0e14' }}>
              <Canvas camera={{ position: [0, 0, 5] }}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} />
                <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
                  <mesh>
                    <sphereGeometry args={[1.5, 64, 64]} />
                    <MeshDistortMaterial color="#B066FF" distort={0.4} speed={2} roughness={0.1} metalness={0.9} />
                  </mesh>
                </Float>
                <OrbitControls enableZoom={false} />
              </Canvas>
              <div style={{ position: 'absolute', top: 24, left: 24 }}>
                <Title order={3} c="white">Heart Rate Variability (3D Fusion)</Title>
                <Text size="xs" c="dimmed">Real-time HRV stream from Apple Watch</Text>
              </div>
            </Paper>
          </Grid.Col>

          {/* HRV and Stress Analytics */}
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <Stack gap="md">
              <Card>
                <TremorTitle>Activity Sync (Garmin / HealthKit)</TremorTitle>
                <AreaChart
                  className="h-48 mt-4"
                  data={[
                    { time: '08:00', heart: 65, stress: 20 },
                    { time: '10:00', heart: 85, stress: 45 },
                    { time: '12:00', heart: 145, stress: 80 },
                    { time: '14:00', heart: 75, stress: 30 },
                  ]}
                  index="time"
                  categories={['heart', 'stress']}
                  colors={['rose', 'indigo']}
                />
              </Card>
              <Grid gutter="md">
                <Grid.Col span={6}>
                  <Paper p="md" radius="lg" withBorder align="center">
                    <RingProgress
                      size={120}
                      thickness={12}
                      roundCaps
                      sections={[{ value: 75, color: 'blue' }]}
                      label={<Text size="xs" align="center" fw={700}>Sleep Quality</Text>}
                    />
                    <Text fw={900} size="xl" mt="xs">75%</Text>
                  </Paper>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Paper p="md" radius="lg" withBorder align="center">
                    <RingProgress
                      size={120}
                      thickness={12}
                      roundCaps
                      sections={[{ value: 88, color: 'teal' }]}
                      label={<Text size="xs" align="center" fw={700}>Recovery</Text>}
                    />
                    <Text fw={900} size="xl" mt="xs">Optimal</Text>
                  </Paper>
                </Grid.Col>
              </Grid>
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
};
