import React, { useState } from 'react';
import { Box, Card, Text, Select, Textarea, Slider, Button, Group, Badge } from '@mantine/core';
import { PageHeader } from '../../core/components/PageHeader';

const PERSONALITIES = ['ZEN', 'STRICT', 'FRIENDLY', 'CHAMPION'];

export const AiCoachStudio: React.FC = () => {
  const [personality, setPersonality] = useState<string | null>('FRIENDLY');
  const [prompt, setPrompt] = useState('');
  const [hrThreshold, setHrThreshold] = useState(165);
  const [paceDrop, setPaceDrop] = useState(15);

  return (
    <Box>
      <PageHeader
        title="AI Coach Studio"
        subtitle="Configure avatar coach personality and voice (ROADMAP_V3 §7.1)"
      >
        <Badge variant="light" color="violet">Premium · Phase 2</Badge>
      </PageHeader>
      <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <Select label="Personality" data={PERSONALITIES} value={personality} onChange={setPersonality} mb="md" />
        <Textarea
          label="Custom system prompt"
          description={`${prompt.length}/150 characters`}
          maxLength={150}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          mb="md"
        />
        <Text size="sm" fw={500} mb={4}>HR alert threshold</Text>
        <Slider mb="lg" value={hrThreshold} onChange={setHrThreshold} min={120} max={200} label={(v) => `${v} bpm`} />
        <Text size="sm" fw={500} mb={4}>Pace drop threshold</Text>
        <Slider mb="lg" value={paceDrop} onChange={setPaceDrop} min={5} max={40} label={(v) => `${v}%`} />
        <Group>
          <Button disabled>Synthesize voice (preview)</Button>
          <Text size="xs" c="dimmed">Voice synthesis requires backend ADR-007 integration.</Text>
        </Group>
      </Card>
    </Box>
  );
};
