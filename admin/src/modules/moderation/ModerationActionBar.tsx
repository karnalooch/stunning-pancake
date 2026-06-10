import React, { useState } from 'react';
import { Group, Button, Card, Text } from '@mantine/core';
import { Check, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_PATHS } from '@4velo/api-client';
import { apiClient } from '../../api/client';
import { notifications } from '@mantine/notifications';
import { RejectReasonModal } from './RejectReasonModal';
import { useI18n } from '../../i18n/useI18n';

interface ModerationActionBarProps {
  activityId: number;
  isVerified: boolean;
  onDecided?: () => void;
}

export const ModerationActionBar: React.FC<ModerationActionBarProps> = ({
  activityId,
  isVerified,
  onDecided,
}) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const queueMode = searchParams.get('queue') === '1';

  if (isVerified) return null;

  const goNext = () => {
    if (queueMode) {
      navigate('/owner/moderation?auto=1');
    }
  };

  const approve = async () => {
    setBusy(true);
    try {
      await apiClient.post(`${API_PATHS.activitiesApprove}${activityId}/`);
      notifications.show({ title: t.moderation.approved, message: `#${activityId}`, color: 'green' });
      onDecided?.();
      goNext();
    } catch {
      notifications.show({ title: t.common.error, message: t.moderation.approveFailed, color: 'red' });
    } finally {
      setBusy(false);
    }
  };

  const reject = async (reason: string, notes: string) => {
    setBusy(true);
    try {
      await apiClient.post(`${API_PATHS.activitiesReject}${activityId}/`, {
        reason,
        notes,
      });
      notifications.show({ title: t.moderation.rejected, message: reason, color: 'orange' });
      setRejectOpen(false);
      onDecided?.();
      goNext();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || t.moderation.rejectFailed;
      notifications.show({ title: t.common.error, message: msg, color: 'red' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card mb="md" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
        <Group justify="space-between">
          <Text fw={600} size="sm">{t.moderation.decisionTitle}</Text>
          <Group>
            <Button
              leftSection={<Check size={16} />}
              color="green"
              loading={busy}
              onClick={() => void approve()}
            >
              {t.moderation.approve}
            </Button>
            <Button
              leftSection={<X size={16} />}
              color="red"
              variant="light"
              loading={busy}
              onClick={() => setRejectOpen(true)}
            >
              {t.moderation.reject}
            </Button>
          </Group>
        </Group>
      </Card>
      <RejectReasonModal
        opened={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onConfirm={(r, n) => void reject(r, n)}
        loading={busy}
      />
    </>
  );
};
