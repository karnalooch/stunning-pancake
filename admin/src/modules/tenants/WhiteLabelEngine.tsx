import React, { useState, useEffect } from 'react';
import { Box, Card, Text, Group, Button, ColorInput, FileInput, Stack, Divider, Badge, TextInput } from '@mantine/core';
import { Palette, Image as ImageIcon, Smartphone } from 'lucide-react';

import { useAuth } from '../../core/auth/useAuth';
import { apiClient } from '../../api/client';
import { notifications } from '@mantine/notifications';

interface WhiteLabelEngineProps {
  tenantId?: string;
}

export const WhiteLabelEngine: React.FC<WhiteLabelEngineProps> = ({ tenantId }) => {
  const { user } = useAuth();
  const [primaryColor, setPrimaryColor] = useState('#2563EB');
  const [secondaryColor, setSecondaryColor] = useState('#10B981');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const effectiveTenantId = tenantId || user?.tenantId;

  useEffect(() => {
    if (effectiveTenantId) {
      apiClient.get(`/users/branding/${effectiveTenantId}/`)
        .then(res => {
          if (res.data?.primary_color) setPrimaryColor(res.data.primary_color);
          if (res.data?.secondary_color) setSecondaryColor(res.data.secondary_color);
        })
        .catch(() => {});
    }
  }, [effectiveTenantId]);

  const handleDeploy = async () => {
    if (!effectiveTenantId) {
      notifications.show({ title: 'Error', message: 'No tenant selected.', color: 'red' });
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.put(`/users/branding/${effectiveTenantId}/update/`, {
        primary_color: primaryColor,
        secondary_color: secondaryColor,
      });
      notifications.show({
        title: 'Branding Deployed',
        message: `Colors synced to ${effectiveTenantId}. Mobile apps will update on next launch.`,
        color: 'green',
      });
    } catch (e: any) {
      notifications.show({ title: 'Deploy Failed', message: e?.message || 'Network error.', color: 'red' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card shadow="sm" p="lg" radius="md" withBorder className="fluent-acrylic">
      <Group justify="space-between" mb="md">
        <Box>
          <Text fw={700} size="lg">White-Label Engine</Text>
          <Text size="xs" color="dimmed">Remote Asset Injection & Branding Control</Text>
        </Box>
        <Badge color="violet" variant="light">EDGE SYNC</Badge>
      </Group>

      <Divider my="sm" color="rgba(255,255,255,0.1)" />

      <Stack gap="md">
        <Box>
          <Group mb="xs">
            <Palette size={16} />
            <Text fw={500} size="sm">Brand Colors</Text>
          </Group>
          <Group grow>
            <ColorInput 
              label="Primary Accent" 
              value={primaryColor} 
              onChange={setPrimaryColor} 
              format="hex"
            />
            <ColorInput 
              label="Secondary / Success" 
              value={secondaryColor} 
              onChange={setSecondaryColor} 
              format="hex"
            />
          </Group>
        </Box>

        <Box>
          <Group mb="xs">
            <ImageIcon size={16} />
            <Text fw={500} size="sm">Assets</Text>
          </Group>
          <Stack gap="xs">
            <FileInput 
              label="Organization Logo (SVG/PNG)" 
              placeholder="Upload logo..." 
              accept="image/png,image/svg+xml" 
            />
            <FileInput 
              label="App Splash Screen" 
              placeholder="Upload splash..." 
              accept="image/png,image/jpeg" 
            />
          </Stack>
        </Box>

        <Box>
          <Group mb="xs">
            <Smartphone size={16} />
            <Text fw={500} size="sm">Mobile Preview</Text>
          </Group>
          <Box 
            h={100} 
            w="100%" 
            style={{ 
              borderRadius: '12px', 
              background: `linear-gradient(45deg, ${primaryColor}, ${secondaryColor})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}
          >
            <Text c="white" fw={800} size="xl" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
              YOUR BRAND
            </Text>
          </Box>
        </Box>
      </Stack>

      <Button fullWidth color="indigo" onClick={handleDeploy} mt="xl" loading={isSubmitting}>
        Deploy Branding to Edge CDN
      </Button>
    </Card>
  );
};
