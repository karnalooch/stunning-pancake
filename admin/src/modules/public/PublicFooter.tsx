import React from 'react';
import { Group, Anchor, Text } from '@mantine/core';
import { Link } from 'react-router-dom';

type PublicFooterProps = {
  lang?: 'pl' | 'en';
};

export const PublicFooter: React.FC<PublicFooterProps> = ({ lang = 'en' }) => (
  <Group justify="center" gap="lg" mt={60} pt="xl" style={{ borderTop: '1px solid var(--border)' }}>
    <Anchor component={Link} to="/trust/anti-cheat" size="sm" c="dimmed">
      {lang === 'pl' ? 'Polityka Anti-Cheat' : 'Anti-Cheat Policy'}
    </Anchor>
    <Anchor component={Link} to="/trust/anti-cheat#scoring" size="sm" c="dimmed">
      {lang === 'pl' ? 'Scoring' : 'Scoring'}
    </Anchor>
    <Anchor component={Link} to="/login" size="sm" c="dimmed">
      {lang === 'pl' ? 'Logowanie' : 'Login'}
    </Anchor>
    <Text size="xs" c="dimmed">© 4VELO</Text>
  </Group>
);
