import React, { useEffect, useState } from 'react';
import { Box, Container, Group, Button, Text, Title, Anchor } from '@mantine/core';
import { Link, useLocation } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';
import { SimpleMarkdown } from './SimpleMarkdown';
import { POLICY_PL, POLICY_EN } from './policyContent';

type Lang = 'pl' | 'en';

export const AntiCheatPolicyPage: React.FC = () => {
  const location = useLocation();
  const [lang, setLang] = useState<Lang>('pl');

  useEffect(() => {
    if (location.hash === '#scoring') {
      const el = document.getElementById('2-normalizacja-wyniku-scoring')
        || document.getElementById('2-score-normalization-scoring');
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location.hash, lang]);

  const source = lang === 'pl' ? POLICY_PL : POLICY_EN;

  return (
    <Box style={{ minHeight: '100vh', background: 'var(--surface-secondary)' }}>
      <Container size="md" py={40}>
        <Group justify="space-between" mb="lg">
          <Button
            component={Link}
            to="/"
            variant="subtle"
            leftSection={<ArrowLeft size={16} />}
            size="sm"
          >
            {lang === 'pl' ? 'Strona główna' : 'Home'}
          </Button>
          <Group gap="xs">
            <Button
              size="xs"
              variant={lang === 'pl' ? 'filled' : 'default'}
              onClick={() => setLang('pl')}
            >
              PL
            </Button>
            <Button
              size="xs"
              variant={lang === 'en' ? 'filled' : 'default'}
              onClick={() => setLang('en')}
            >
              EN
            </Button>
          </Group>
        </Group>

        <Group gap="sm" mb="xl">
          <Box
            w={48}
            h={48}
            style={{
              borderRadius: 12,
              background: 'var(--brand-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Shield size={24} color="white" />
          </Box>
          <Box>
            <Title order={1} style={{ fontSize: 28, fontWeight: 800 }}>
              {lang === 'pl' ? 'Polityka Anti-Cheat i Scoring' : 'Anti-Cheat and Scoring Policy'}
            </Title>
            <Text size="sm" c="dimmed">4VELO Platform · v1.0 · 2026-06-12</Text>
          </Box>
        </Group>

        <Box
          p="xl"
          style={{
            background: 'var(--surface)',
            borderRadius: 16,
            border: '1px solid var(--border)',
          }}
        >
          <SimpleMarkdown source={source} />
        </Box>

        <Text size="xs" c="dimmed" mt="xl" ta="center">
          {lang === 'pl' ? 'Pytania:' : 'Questions:'}{' '}
          <Anchor href="mailto:support@4velo.app">support@4velo.app</Anchor>
          {' · '}
          <Anchor component={Link} to="/login">
            {lang === 'pl' ? 'Panel admin' : 'Admin panel'}
          </Anchor>
        </Text>
      </Container>
    </Box>
  );
};
