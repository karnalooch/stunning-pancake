import React from 'react';
import { motion } from 'framer-motion';
import { Text, Group, Box, Skeleton } from '@mantine/core';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export type StatCardVariant =
  | 'blue' | 'indigo' | 'violet' | 'green' | 'orange' | 'red' | 'cyan' | 'pink';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number | null;
  trend?: {
    value: string;
    direction: 'up' | 'down' | 'flat';
    label?: string;
  };
  variant?: StatCardVariant;
  loading?: boolean;
  index?: number;
}

const VARIANT_COLORS: Record<StatCardVariant, string> = {
  blue:   'var(--mantine-color-blue-6)',
  indigo: 'var(--accent)',
  violet: 'var(--mantine-color-violet-6)',
  green:  'var(--success)',
  orange: 'var(--warning)',
  red:    'var(--danger)',
  cyan:   'var(--info)',
  pink:   '#EC4899',
};

const VARIANT_BG: Record<StatCardVariant, string> = {
  blue:   'rgba(59,130,246,0.08)',
  indigo: 'rgba(99,102,241,0.08)',
  violet: 'rgba(139,92,246,0.08)',
  green:  'rgba(16,185,129,0.08)',
  orange: 'rgba(245,158,11,0.08)',
  red:    'rgba(239,68,68,0.08)',
  cyan:   'rgba(6,182,212,0.08)',
  pink:   'rgba(236,72,153,0.08)',
};

export const StatCard: React.FC<StatCardProps> = ({
  icon,
  label,
  value,
  trend,
  variant = 'indigo',
  loading = false,
  index = 0,
}) => {
  const color = VARIANT_COLORS[variant];
  const bg = VARIANT_BG[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -3, transition: { duration: 0.18, ease: 'easeOut' } }}
      style={{ height: '100%' }}
    >
      <Box
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '20px 22px',
          height: '100%',
          boxShadow: 'var(--shadow-sm)',
          cursor: 'default',
          transition: 'box-shadow 200ms ease',
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)';
        }}
      >
        {/* Subtle gradient corner accent */}
        <Box
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 80,
            height: 80,
            background: `radial-gradient(circle at top right, ${bg.replace('0.08', '0.5')}, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />

        <Group justify="space-between" align="flex-start" mb={14}>
          <Text
            size="xs"
            fw={600}
            tt="uppercase"
            style={{
              color: 'var(--text-tertiary)',
              letterSpacing: '0.06em',
              fontSize: '11px',
            }}
          >
            {label}
          </Text>

          {/* Icon container */}
          <Box
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        </Group>

        {/* Value */}
        {loading ? (
          <Skeleton height={32} width="60%" radius="md" mb={8} />
        ) : (
          <Text
            style={{
              fontSize: '28px',
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              fontFeatureSettings: '"cv11"',
            }}
          >
            {value ?? '—'}
          </Text>
        )}

        {/* Trend indicator */}
        {trend && !loading && (
          <Group gap={5} mt={8} align="center">
            {trend.direction === 'up' && (
              <TrendingUp size={13} style={{ color: 'var(--success)', flexShrink: 0 }} />
            )}
            {trend.direction === 'down' && (
              <TrendingDown size={13} style={{ color: 'var(--danger)', flexShrink: 0 }} />
            )}
            {trend.direction === 'flat' && (
              <Minus size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            )}
            <Text
              size="xs"
              fw={600}
              style={{
                color:
                  trend.direction === 'up'
                    ? 'var(--success)'
                    : trend.direction === 'down'
                    ? 'var(--danger)'
                    : 'var(--text-tertiary)',
              }}
            >
              {trend.value}
            </Text>
            {trend.label && (
              <Text size="xs" style={{ color: 'var(--text-tertiary)' }}>
                {trend.label}
              </Text>
            )}
          </Group>
        )}

        {loading && trend && (
          <Skeleton height={14} width="50%" radius="sm" mt={8} />
        )}
      </Box>
    </motion.div>
  );
};