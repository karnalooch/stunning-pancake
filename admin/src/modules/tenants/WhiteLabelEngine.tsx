import React, { useState } from 'react';
import { Box, Card, Text, Group, Button, ColorInput, FileInput, Stack, Divider, Badge } from '@mantine/core';
import { Palette, Image as ImageIcon, Smartphone } from 'lucide-react';

export const WhiteLabelEngine: React.FC = () => {
  const [primaryColor, setPrimaryColor] = useState('#2563EB');
  const [secondaryColor, setSecondaryColor] = useState('#10B981');
  
  const handleDeploy = () => {
    console.log("Deploying branding to Edge CDN...", { primaryColor, secondaryColor });
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

      <Button fullWidth color="indigo" onClick={handleDeploy} mt="xl">
        Inject Assets to Production
      </Button>
    </Card>
  );
};
