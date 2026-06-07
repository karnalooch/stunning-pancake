import React, { useEffect, useState } from 'react';
import { Box, Loader, Stack, Text, ThemeIcon } from '@mantine/core';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

export type DashboardBootStep = 'session' | 'metrics' | 'widgets';

interface DashboardBootOverlayProps {
  visible: boolean;
  step: DashboardBootStep;
  elapsedMs?: number;
  activityCount?: number;
}

const STEPS: { id: DashboardBootStep; label: string }[] = [
  { id: 'session', label: 'Session verified' },
  { id: 'metrics', label: 'Aggregating platform metrics' },
  { id: 'widgets', label: 'Preparing live map & monitoring' },
];

const stepIndex = (step: DashboardBootStep) =>
  STEPS.findIndex((s) => s.id === step);

const StepIcon: React.FC<{ status: 'done' | 'active' | 'pending' }> = ({ status }) => {
  if (status === 'done') {
    return (
      <ThemeIcon size={22} radius="xl" color="green" variant="light">
        <CheckCircle2 size={14} />
      </ThemeIcon>
    );
  }
  if (status === 'active') {
    return (
      <ThemeIcon size={22} radius="xl" color="indigo" variant="light">
        <Loader2 size={14} className="boot-spin" />
      </ThemeIcon>
    );
  }
  return (
    <ThemeIcon size={22} radius="xl" color="gray" variant="light">
      <Circle size={14} />
    </ThemeIcon>
  );
};

export const DashboardBootOverlay: React.FC<DashboardBootOverlayProps> = ({
  visible,
  step,
  elapsedMs,
  activityCount,
}) => {
  const [hint, setHint] = useState(0);
  const activeIdx = stepIndex(step);

  const hints =
    activityCount && activityCount >= 100_000
      ? [
          `Processing ${activityCount.toLocaleString()} activities across tenants…`,
          'Building per-tenant breakdown and verification rates…',
          'Warming live map telemetry — this may take a moment at scale…',
        ]
      : [
          'Fetching cached KPIs from control plane…',
          'Syncing tenant rollups and verification stats…',
          'Initializing live activity map…',
        ];

  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => setHint((h) => (h + 1) % hints.length), 3200);
    return () => window.clearInterval(id);
  }, [visible, hints.length]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="dashboard-boot"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(248, 250, 252, 0.92)',
            backdropFilter: 'blur(8px)',
            borderRadius: 16,
            minHeight: 420,
          }}
        >
          <Box
            style={{
              width: 'min(440px, 92%)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: '32px 28px',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <Stack gap="lg" align="center">
              <Loader size="md" type="dots" color="indigo" />

              <Stack gap={4} align="center">
                <Text fw={700} size="lg" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  Loading platform overview
                </Text>
                <Text size="sm" c="dimmed" ta="center" maw={360}>
                  {hints[hint]}
                </Text>
              </Stack>

              <Stack gap="sm" w="100%" mt={4}>
                {STEPS.map((s, i) => {
                  const status =
                    i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'pending';
                  return (
                    <GroupRow key={s.id} label={s.label} status={status} />
                  );
                })}
              </Stack>

              {elapsedMs != null && elapsedMs >= 2500 && (
                <Text size="xs" c="dimmed">
                  {Math.round(elapsedMs / 1000)}s — large datasets are served from cache after the first load
                </Text>
              )}
            </Stack>
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const GroupRow: React.FC<{ label: string; status: 'done' | 'active' | 'pending' }> = ({
  label,
  status,
}) => (
  <Box
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 12px',
      borderRadius: 10,
      background: status === 'active' ? 'rgba(99,102,241,0.06)' : 'var(--surface-secondary)',
      border: `1px solid ${status === 'active' ? 'rgba(99,102,241,0.2)' : 'var(--border-subtle)'}`,
    }}
  >
    <StepIcon status={status} />
    <Text
      size="sm"
      fw={status === 'active' ? 600 : 500}
      style={{ color: status === 'pending' ? 'var(--text-tertiary)' : 'var(--text-primary)' }}
    >
      {label}
    </Text>
  </Box>
);
