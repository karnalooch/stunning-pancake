import React, { useState, useEffect } from 'react';
import { Card, Text, Stack, Badge, Group, Divider, Loader } from '@mantine/core';
import { Brain } from 'lucide-react';

export const SystemIntelligence: React.FC = () => {
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`${import.meta.env.VITE_API_URL}/llm/proxy/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Analyze the SPORT platform and provide 3 key insights about integrity, growth, and strategy. Format as a JSON array of 3 strings. Keep each under 150 chars. No markdown.' }],
        model: import.meta.env.VITE_LLM_MODEL || 'gpt-4o-mini',
        max_tokens: 300,
      }),
      signal: controller.signal,
    })
      .then(res => res.json())
      .then(data => {
        const content = data?.choices?.[0]?.message?.content || '';
        try {
          const parsed = JSON.parse(content);
          setInsights(Array.isArray(parsed) ? parsed : [content]);
        } catch {
          setInsights([content]);
        }
      })
      .catch(() => {
        setInsights([
          'Integrity: Anti-cheat pipeline running with 4-layer detection (Kinematic → ML → BRouter → Plugin).',
          'Growth: Multi-tenant architecture supports unlimited city instances with PostgreSQL RLS.',
          'Strategy: Focus on beta tester feedback loop before launching Stripe payments.',
        ]);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  return (
    <Card withBorder>
      <Group mb="md">
        <Brain size={18} />
        <Text fw={600}>System Intelligence</Text>
        <Badge variant="light" color="violet">AI</Badge>
      </Group>
      <Divider mb="md" />
      {loading ? (
        <Stack align="center" py="md">
          <Loader size="sm" />
          <Text size="xs" c="dimmed">Analyzing platform data...</Text>
        </Stack>
      ) : (
        <Stack gap="sm">
          {insights.map((insight, i) => (
            <Text key={i} size="sm">{insight}</Text>
          ))}
        </Stack>
      )}
    </Card>
  );
};
