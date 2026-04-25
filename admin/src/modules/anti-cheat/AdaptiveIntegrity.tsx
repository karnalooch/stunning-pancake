import React, { useState } from 'react';
import { Box, Card, Text, Slider, Switch, Group, Button, Badge } from '@mantine/core';

export const AdaptiveIntegrity: React.FC = () => {
  const [brouterCutoff, setBrouterCutoff] = useState<number>(1.5);
  const [mlSensitivity, setMlSensitivity] = useState<number>(0.8);
  const [autoBan, setAutoBan] = useState<boolean>(true);
  
  const handleSave = () => {
    console.log("Saving Adaptive Integrity Settings:", { brouterCutoff, mlSensitivity, autoBan });
    // TODO: Send to backend /api/telemetry/config
  };

  return (
    <Card shadow="sm" p="lg" radius="md" withBorder>
      <Group justify="space-between" mb="md">
        <Box>
          <Text fw={700} size="lg">Adaptive Integrity Engine</Text>
          <Text size="xs" color="dimmed">Tune Anti-Cheat parameters in real-time (no server restart required).</Text>
        </Box>
        <Badge color="red" variant="light">LIVE CONTROL</Badge>
      </Group>

      <Box mb="xl">
        <Group justify="space-between">
          <Text fw={500} size="sm">BRouter Adaptive Cost-Cutoff</Text>
          <Text fw={700} size="sm">{brouterCutoff}x</Text>
        </Group>
        <Text size="xs" color="dimmed" mb="xs">
          Multiplier for topological path cost. Higher values are more forgiving for GPS drift. Lower values enforce strict adherence to OSM paths.
        </Text>
        <Slider
          value={brouterCutoff}
          onChange={setBrouterCutoff}
          min={1.0}
          max={3.0}
          step={0.1}
          marks={[
            { value: 1.0, label: 'Strict' },
            { value: 2.0, label: 'Normal' },
            { value: 3.0, label: 'Loose' }
          ]}
          color="indigo"
        />
      </Box>

      <Box mb="xl" mt="xl">
        <Group justify="space-between">
          <Text fw={500} size="sm">ML Anomaly Sensitivity (Z-Score)</Text>
          <Text fw={700} size="sm">{mlSensitivity}</Text>
        </Group>
        <Text size="xs" color="dimmed" mb="xs">
          Threshold for Kinematic V-Max and Acceleration profiling.
        </Text>
        <Slider
          value={mlSensitivity}
          onChange={setMlSensitivity}
          min={0.1}
          max={1.0}
          step={0.05}
          marks={[
            { value: 0.1, label: 'Aggressive' },
            { value: 0.5, label: 'Balanced' },
            { value: 1.0, label: 'Forgiving' }
          ]}
          color="teal"
        />
      </Box>

      <Box mb="xl" mt="xl">
        <Group justify="space-between">
          <Box>
            <Text fw={500} size="sm">Autonomous Ban System</Text>
            <Text size="xs" color="dimmed">If enabled, tracks exceeding both BRouter and ML thresholds are instantly rejected.</Text>
          </Box>
          <Switch 
            checked={autoBan} 
            onChange={(event) => setAutoBan(event.currentTarget.checked)} 
            color="red"
            size="md"
          />
        </Group>
      </Box>

      <Button fullWidth color="blue" onClick={handleSave} mt="md">
        Deploy New Configuration
      </Button>
    </Card>
  );
};
