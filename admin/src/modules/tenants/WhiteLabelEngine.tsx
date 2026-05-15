import React, { useState, useEffect } from 'react';
import { Card, Text, Group, Button, ColorInput, Stack, Divider, Box } from '@mantine/core';
import { Palette } from 'lucide-react';
import { useAuth } from '../../core/auth/useAuth';
import { apiClient } from '../../api/client';
import { notifications } from '@mantine/notifications';
import { PageHeader } from '../../core/components/PageHeader';

export const WhiteLabelEngine: React.FC = () => {
  const { user } = useAuth();
  const [primaryColor, setPrimaryColor] = useState('#2563EB');
  const [secondaryColor, setSecondaryColor] = useState('#10B981');
  const [loading, setLoading] = useState(false);
  const tenantId = user?.tenantId;

  useEffect(() => {
    if (tenantId) {
      apiClient.get(`/users/branding/${tenantId}/`)
        .then(res => {
          if (res.data?.primary_color) setPrimaryColor(res.data.primary_color);
          if (res.data?.secondary_color) setSecondaryColor(res.data.secondary_color);
        })
        .catch(() => {
          notifications.show({ title: 'White-Label Engine', message: 'Failed to load branding.', color: 'red' });
        });
    }
  }, [tenantId]);

  const handleSave = async () => {
    if (!tenantId) {
      notifications.show({ title: 'No tenant', message: 'No tenant selected.', color: 'red' });
      return;
    }
    setLoading(true);
    try {
      await apiClient.put(`/users/branding/${tenantId}/update/`, {
        primary_color: primaryColor,
        secondary_color: secondaryColor,
      });
      notifications.show({ title: 'Branding Updated', message: 'Changes will apply on next app launch.', color: 'green' });
    } catch (e: any) {
      notifications.show({ title: 'Error', message: e?.message || 'Update failed.', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <PageHeader title="White-Label Engine" subtitle="Customize tenant branding colors and assets" />

      <Card withBorder mb="xl">
        <Group mb="md">
          <Palette size={18} />
          <Text fw={600}>Brand Colors</Text>
        </Group>
        <Divider mb="md" />
        <Stack gap="md">
          <Group grow>
            <ColorInput label="Primary Color" value={primaryColor} onChange={setPrimaryColor} format="hex" />
            <ColorInput label="Secondary Color" value={secondaryColor} onChange={setSecondaryColor} format="hex" />
          </Group>
          <Box h={80} style={{ borderRadius: 8, background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Text c="white" fw={700} size="lg">Preview</Text>
          </Box>
        </Stack>
      </Card>

      <Button onClick={handleSave} loading={loading} size="md">
        Save Branding
      </Button>
    </Box>
  );
};
