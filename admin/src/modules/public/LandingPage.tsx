import React from 'react';
import { Box, Container, Title, Text, Button, SimpleGrid, Group, Stack, Badge } from '@mantine/core';
import { motion } from 'framer-motion';
import { ShieldCheck, Zap, Building2, Gift, Globe, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

const FeatureCard = ({ icon: Icon, title, description, delay }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay, duration: 0.5 }}
  >
    <Box p="xl" style={{ borderRadius: '16px', height: '100%', border: '1px solid rgba(255,255,255,0.1)' }}>
      <Box mb="md" p="sm" bg="rgba(37, 99, 235, 0.1)" style={{ width: 'fit-content', borderRadius: '12px' }}>
        <Icon size={24} color="#2563EB" />
      </Box>
      <Text fw={800} size="lg" mb="sm">
        {title}
      </Text>
      <Text size="sm" c="dimmed" style={{ lineHeight: 1.6 }}>
        {description}
      </Text>
    </Box>
  </motion.div>
);

export const LandingPage = () => {
  return (
    <Box style={{ background: '#0a0a0a', minHeight: '100vh', overflowX: 'hidden' }}>
      {/* Hero Section */}
      <Box style={{ position: 'relative', paddingTop: '120px', paddingBottom: '100px' }}>
        <Box
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'radial-gradient(circle at 50% 50%, rgba(37, 99, 235, 0.15) 0%, transparent 50%)',
            zIndex: 0
          }}
        />

        <Container size="lg" style={{ position: 'relative', zIndex: 1 }}>
          <Stack align="center" gap="xl" ta="center">

            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <Badge variant="dot" color="blue" size="lg" p="md">V2.0 NEXT-GEN UPDATE</Badge>
            </motion.div>

            <Title order={1} style={{ fontSize: '72px', fontWeight: 900, letterSpacing: '-2px', color: 'white' }}>
              The <span style={{ color: '#2563EB' }}>Future</span> of Urban Fitness
            </Title>

            <Text size="xl" c="dimmed" maw={700} style={{ fontSize: '20px' }}>
              Multi-tenant ecosystem for cities and companies.
              Combat fraud with ML, reward athletes with local POIs,
              and build a healthy community with zero technical overhead.
            </Text>

            <Group gap="md">
              <Button size="xl" radius="md" color="blue" component={Link} to="/owner" rightSection={<Zap size={18} />}>
                Launch Platform
              </Button>
              <Button size="xl" radius="md" variant="outline" color="gray" leftSection={<Globe size={18} />}>
                Contact Sales
              </Button>
            </Group>
          </Stack>
        </Container>
      </Box>

      {/* Features Grid */}
      <Container size="lg" py={100}>
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xl">
          <FeatureCard
            icon={Building2}
            title="City White-Labeling"
            description="Remote asset injection for logos, splash screens, and colors. Your city, your brand, our engine."
            delay={0.1}
          />
          <FeatureCard
            icon={ShieldCheck}
            title="ML Anti-Cheat"
            description="3-Layer verification pipeline (Kinematics, BRouter & ML) ensuring 99.9% data integrity."
            delay={0.2}
          />
          <FeatureCard
            icon={Gift}
            title="Reward Engine"
            description="Connect local sponsors directly to athletes. Vouchers, POIs, and dynamic reward cycles."
            delay={0.3}
          />
        </SimpleGrid>
      </Container>

      {/* Stats Section */}
      <Box py={80} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
        <Container size="lg">
          <SimpleGrid cols={{ base: 2, md: 4 }} spacing="xl">
            <Stack gap={0} align="center">
              <Title order={2} style={{ color: 'white', fontWeight: 900 }}>200+</Title>
              <Text c="dimmed" size="xs" tt="uppercase" fw={700}>Cities Onboarded</Text>
            </Stack>
            <Stack gap={0} align="center">
              <Title order={2} style={{ color: 'white', fontWeight: 900 }}>38M+</Title>
              <Text c="dimmed" size="xs" tt="uppercase" fw={700}>Kilometers Logged</Text>
            </Stack>
            <Stack gap={0} align="center">
              <Title order={2} style={{ color: 'white', fontWeight: 900 }}>184K</Title>
              <Text c="dimmed" size="xs" tt="uppercase" fw={700}>Active Athletes</Text>
            </Stack>
            <Stack gap={0} align="center">
              <Title order={2} style={{ color: 'white', fontWeight: 900 }}>99.4%</Title>
              <Text c="dimmed" size="xs" tt="uppercase" fw={700}>Integrity Score</Text>
            </Stack>
          </SimpleGrid>
        </Container>
      </Box>

      {/* Footer */}
      <Container size="lg" py="xl">
        <Group justify="space-between" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '40px' }}>
          <Text fw={900} size="lg" c="blue">4VELO.</Text>
          <Text size="xs" c="dimmed">© 2026 4VELO Platform. Built with Python & TypeScript.</Text>
        </Group>
      </Container>
    </Box>
  );
};
