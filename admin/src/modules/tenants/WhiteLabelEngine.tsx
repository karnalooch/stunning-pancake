import React, { useState, useEffect, useCallback } from 'react';
import { Card, Text, Group, Stack, ColorInput, TextInput, Button, SimpleGrid, Box, ThemeIcon, Skeleton } from '@mantine/core';
import { PaintBucket, Globe, Palette, Check } from 'lucide-react';
import { PageHeader } from '../../core/components/PageHeader';
import { notifications } from '@mantine/notifications';
import { apiClient } from '../../api/client';
import { useAuth } from '../../core/auth/useAuth';
import { useI18n } from '../../i18n/useI18n';

export const WhiteLabelEngine: React.FC = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const tenantId = user?.tenantId;
  const [brand, setBrand] = useState({ name: '', domain: '', primary: '#2563EB', secondary: '#10B981' });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.get(`/users/branding/${tenantId}/`);
      const d = res.data?.data || res.data;
      setBrand({
        name: d.name || '',
        domain: '',
        primary: d.primary_color || '#2563EB',
        secondary: d.secondary_color || '#10B981',
      });
    } catch {
      notifications.show({ title: t.whiteLabel.loadFailed, message: t.whiteLabel.loadFailedMsg, color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [tenantId, t.whiteLabel.loadFailed, t.whiteLabel.loadFailedMsg]);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async () => {
    if (!tenantId) return;
    try {
      await apiClient.put(`/users/branding/${tenantId}/update/`, {
        primary_color: brand.primary,
        secondary_color: brand.secondary,
      });
      setSaved(true);
      notifications.show({ title: t.whiteLabel.title, message: t.whiteLabel.brandingSaved, color: 'green' });
      setTimeout(() => setSaved(false), 3000);
    } catch {
      notifications.show({ title: t.common.error, message: t.whiteLabel.saveFailed, color: 'red' });
    }
  };

  if (loading) {
    return <Box p="md"><Skeleton height={200} /></Box>;
  }

  return (
    <Box>
      <PageHeader title={t.whiteLabel.title} subtitle={t.whiteLabel.subtitle} />
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <Group mb="md"><ThemeIcon size={36} radius="md" color="indigo" variant="light"><Globe size={18} /></ThemeIcon><Text fw={700} size="lg">{t.whiteLabel.identity}</Text></Group>
          <Stack gap="md">
            <TextInput label={t.whiteLabel.tenantName} value={brand.name} readOnly />
            <TextInput label={t.whiteLabel.customDomain} value={brand.domain} onChange={(e) => setBrand({ ...brand, domain: e.target.value })} placeholder={t.whiteLabel.customDomainPlaceholder} />
          </Stack>
        </Card>
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <Group mb="md"><ThemeIcon size={36} radius="md" color="violet" variant="light"><Palette size={18} /></ThemeIcon><Text fw={700} size="lg">{t.whiteLabel.colors}</Text></Group>
          <Stack gap="md">
            <ColorInput label={t.whiteLabel.primaryColor} value={brand.primary} onChange={(v) => setBrand({ ...brand, primary: v })} />
            <ColorInput label={t.whiteLabel.secondaryColor} value={brand.secondary} onChange={(v) => setBrand({ ...brand, secondary: v })} />
          </Stack>
        </Card>
      </SimpleGrid>
      <Card mt="md" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <Group mb="md"><PaintBucket size={18} style={{ color: 'var(--accent)' }} /><Text fw={700}>{t.whiteLabel.livePreview}</Text></Group>
        <Box style={{ padding: 24, borderRadius: 14, background: `linear-gradient(135deg, ${brand.primary}, ${brand.secondary})`, textAlign: 'center' }}>
          <Text fw={900} size="xl" c="white">{brand.name || t.whiteLabel.fallbackCity}</Text>
        </Box>
      </Card>
      <Button mt="xl" size="md" onClick={() => void handleSave()} disabled={!tenantId} style={{ background: 'var(--brand-gradient)', borderRadius: 10 }} leftSection={saved ? <Check size={16} /> : <PaintBucket size={16} />}>
        {saved ? t.whiteLabel.saved : t.whiteLabel.saveBranding}
      </Button>
    </Box>
  );
};
