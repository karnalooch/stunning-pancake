import React, { useEffect, useMemo, useState } from 'react';
import { Modal, TextInput, Stack, Text, UnstyledButton, Group, Kbd } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { useI18n } from '../../i18n/useI18n';
import { NAV_CONFIG } from '../../i18n/navConfig';

export const CommandPalette: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const items = useMemo(() => {
    const role = user?.role ?? '';
    const q = query.trim().toLowerCase();
    const flat = NAV_CONFIG.flatMap((section) =>
      section.items
        .filter((item) => item.roles.includes(role))
        .map((item) => ({
          path: item.path,
          label: t.nav.items[item.labelKey],
        })),
    );
    if (!q) return flat;
    return flat.filter((r) => r.label.toLowerCase().includes(q) || r.path.includes(q));
  }, [query, user?.role, t]);

  const go = (path: string) => {
    setOpen(false);
    setQuery('');
    navigate(path);
  };

  return (
    <Modal opened={open} onClose={() => setOpen(false)} title={t.commandPalette.title} size="md" centered>
      <TextInput
        leftSection={<Search size={16} />}
        placeholder={t.commandPalette.placeholder}
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        autoFocus
        mb="sm"
      />
      <Text size="xs" c="dimmed" mb="xs">
        <Kbd>Ctrl</Kbd> + <Kbd>K</Kbd> {t.commandPalette.toggleHint}
      </Text>
      <Stack gap={4}>
        {items.map((r) => (
          <UnstyledButton
            key={r.path}
            onClick={() => go(r.path)}
            p="xs"
            style={{ borderRadius: 8, border: '1px solid var(--border)' }}
          >
            <Group justify="space-between">
              <Text size="sm" fw={500}>{r.label}</Text>
              <Text size="xs" c="dimmed">{r.path}</Text>
            </Group>
          </UnstyledButton>
        ))}
        {items.length === 0 && (
          <Text c="dimmed" size="sm" ta="center" py="md">{t.commandPalette.noMatches}</Text>
        )}
      </Stack>
    </Modal>
  );
};
