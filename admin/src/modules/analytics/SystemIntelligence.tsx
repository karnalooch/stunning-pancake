import React, { useState, useEffect } from 'react';
import { Box, Text, Stack, Skeleton, Badge, Group, Card, ThemeIcon } from '@mantine/core';
import { Brain, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const SystemIntelligence: React.FC = () => {
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulated AI insights — replace with real API call
    setTimeout(() => {
      setInsights([
        { type: 'positive', icon: CheckCircle2, title: 'Platform Health', desc: '94.2% verification rate across all tenants. 127 pending reviews.', color: 'green' },
        { type: 'warning', icon: TrendingUp, title: 'Growth Insight', desc: 'Siedlce tenant grew 23% this week. Consider scaling resources.', color: 'indigo' },
        { type: 'alert', icon: AlertTriangle, title: 'Integrity Alert', desc: '3 anomalies detected in Warsaw. All flagged for manual review.', color: 'orange' },
        { type: 'positive', icon: Brain, title: 'Global Strategy', desc: 'Department adoption at 67%. Cities with departments show 2.3x engagement.', color: 'violet' },
      ]);
      setLoading(false);
    }, 1500);
  }, []);

  return (
    <Box>
      {loading ? <Stack gap="sm">{[...Array(3)].map((_, i) => <Skeleton key={i} height={56} radius="md" />)}</Stack> : (
        <Stack gap="sm">
          {insights.map((insight, i) => (
            <Group key={i} p="sm" style={{ borderRadius: 12, background: 'var(--surface-secondary)', border: '1px solid var(--border-subtle)' }} wrap="nowrap">
              <ThemeIcon size={36} radius="md" color={insight.color} variant="light"><insight.icon size={18} /></ThemeIcon>
              <Box>
                <Group gap={8} mb={2}><Text fw={600} size="sm">{insight.title}</Text><Badge size="xs" color={insight.color} variant="light">{insight.type}</Badge></Group>
                <Text size="xs" c="dimmed">{insight.desc}</Text>
              </Box>
            </Group>
          ))}
        </Stack>
      )}
    </Box>
  );
};
