import React from 'react';
import { Box, Text, Title, Container, SimpleGrid, ThemeIcon, Button } from '@mantine/core';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Shield, Globe, Activity, ArrowRight } from 'lucide-react';
import { PublicFooter } from './PublicFooter';

const features = [
  { icon: Globe, title: 'Multi-tenant', desc: 'Isolated data per city/company. White-label branding.' },
  { icon: Shield, title: 'Anti-Cheat', desc: '4-layer detection: kinematic, ML, BRouter, Viterbi HMM.' },
  { icon: Activity, title: 'Real-time', desc: 'Live GPS tracking, leaderboards updated every second.' },
  { icon: Zap, title: 'Performance', desc: 'Redis caching, Celery workers, 99.9% uptime target.' },
];

export const LandingPage: React.FC = () => (
  <Box style={{ minHeight: '100vh', background: 'var(--surface-secondary)' }}>
    <Container size="lg" py={80}>
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <Box ta="center" mb={60}>
          <Box mx="auto" mb="md" w={64} h={64} style={{ borderRadius: 16, background: 'var(--brand-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={32} color="white" fill="white" />
          </Box>
          <Title order={1} style={{ fontSize: 42, fontWeight: 900, letterSpacing: '-0.03em' }}>4VELO Platform</Title>
          <Text size="lg" c="dimmed" maw={500} mx="auto" mt="sm">High-performance sport gamification for cities, companies, and communities.</Text>
          <Button size="lg" mt="xl" radius="md" rightSection={<ArrowRight size={18} />} component={Link} to="/login" style={{ background: 'var(--brand-gradient)' }}>Go to Admin Panel</Button>
        </Box>
      </motion.div>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="xl">
        {features.map((f, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}>
            <Box ta="center" p="xl" style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)' }}>
              <ThemeIcon size={48} radius="md" color="indigo" variant="light" mx="auto" mb="md"><f.icon size={24} /></ThemeIcon>
              <Title order={4} mb="xs">{f.title}</Title>
              <Text size="sm" c="dimmed">{f.desc}</Text>
            </Box>
          </motion.div>
        ))}
      </SimpleGrid>
      <PublicFooter />
    </Container>
  </Box>
);
