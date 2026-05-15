import React, { useState } from 'react';
import { Card, Text, Group, Stack, ColorInput, TextInput, Button, SimpleGrid, Box, ThemeIcon } from '@mantine/core';
import { PaintBucket, Globe, Palette, Check } from 'lucide-react';
import { PageHeader } from '../../core/components/PageHeader';
import { notifications } from '@mantine/notifications';

export const WhiteLabelEngine: React.FC = () => {
  const [brand, setBrand] = useState({ name: 'Siedlce City', domain: 'siedlce.sport.com', primary: '#2563EB', secondary: '#10B981' });
  const [saved, setSaved] = useState(false);

  const handleSave = () => { setSaved(true); notifications.show({ title: 'Branding', message: 'Brand deployed.', color: 'green' }); setTimeout(() => setSaved(false), 3000); };

  return (
    <Box><PageHeader title="White-Label Engine" subtitle="Customize tenant branding" />
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <Group mb="md"><ThemeIcon size={36} radius="md" color="indigo" variant="light"><Globe size={18} /></ThemeIcon><Text fw={700} size="lg">Domain</Text></Group>
          <Stack gap="md"><TextInput label="Tenant Name" value={brand.name} onChange={(e) => setBrand({ ...brand, name: e.target.value })} /><TextInput label="Custom Domain" value={brand.domain} onChange={(e) => setBrand({ ...brand, domain: e.target.value })} /></Stack>
        </Card>
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <Group mb="md"><ThemeIcon size={36} radius="md" color="violet" variant="light"><Palette size={18} /></ThemeIcon><Text fw={700} size="lg">Colors</Text></Group>
          <Stack gap="md"><ColorInput label="Primary Color" value={brand.primary} onChange={(v) => setBrand({ ...brand, primary: v })} /><ColorInput label="Secondary Color" value={brand.secondary} onChange={(v) => setBrand({ ...brand, secondary: v })} /></Stack>
        </Card>
      </SimpleGrid>
      <Card mt="md" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <Group mb="md"><PaintBucket size={18} style={{ color: 'var(--accent)' }} /><Text fw={700}>Live Preview</Text></Group>
        <Box style={{ padding: 24, borderRadius: 14, background: `linear-gradient(135deg, ${brand.primary}, ${brand.secondary})`, textAlign: 'center' }}>
          <Text fw={900} size="xl" c="white">{brand.name}</Text><Text size="sm" c="rgba(255,255,255,0.8)" mt={4}>{brand.domain}</Text>
        </Box>
      </Card>
      <Button mt="xl" size="md" onClick={handleSave} style={{ background: 'var(--brand-gradient)', borderRadius: 10 }} leftSection={saved ? <Check size={16} /> : <PaintBucket size={16} />}>{saved ? 'Deployed!' : 'Deploy Branding'}</Button>
    </Box>
  );
};
