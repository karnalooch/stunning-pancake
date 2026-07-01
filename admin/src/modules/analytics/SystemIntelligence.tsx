import React, { useState, useEffect } from 'react';
import { Box, Text, Stack, Skeleton, Badge, Group, ThemeIcon } from '@mantine/core';
import { Brain, TrendingUp, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiClient } from '../../api/client';
import { normalizeInsightsPayload } from './systemIntelligenceLogic';

const iconMap: Record<string, React.FC<{ size?: number }>> = {
  positive: CheckCircle2,
  warning: TrendingUp,
  alert: AlertTriangle,
};

const defaultIcon = Brain;

export const SystemIntelligence: React.FC = () => {
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const { data } = await apiClient.get('/activities/ai/insights/');
        setInsights(normalizeInsightsPayload(data));
      } catch (err) {
        setError('Unable to load AI insights. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    fetchInsights();
  }, []);

  return (
    <Box>
      {loading ? (
        <Stack gap="sm">
          {[...Array(3)].map((_, i) => <Skeleton key={i} height={56} radius="md" />)}
        </Stack>
      ) : error ? (
        <Text c="dimmed" size="sm" ta="center" py="md">{error}</Text>
      ) : insights.length === 0 ? (
        <Text c="dimmed" size="sm" ta="center" py="md">No insights available yet.</Text>
      ) : (
        <Stack gap="sm">
          {insights.map((insight, i) => {
            const IconComponent = iconMap[insight.type] || defaultIcon;
            return (
              <Group key={i} p="sm" style={{ borderRadius: 12, background: 'var(--surface-secondary)', border: '1px solid var(--border-subtle)' }} wrap="nowrap">
                <ThemeIcon size={36} radius="md" color={insight.color} variant="light">
                  <IconComponent size={18} />
                </ThemeIcon>
                <Box>
                  <Group gap={8} mb={2}>
                    <Text fw={600} size="sm">{insight.title}</Text>
                    <Badge size="xs" color={insight.color} variant="light">{insight.type}</Badge>
                  </Group>
                  <Text size="xs" c="dimmed">{insight.desc}</Text>
                </Box>
              </Group>
            );
          })}
        </Stack>
      )}
    </Box>
  );
};
