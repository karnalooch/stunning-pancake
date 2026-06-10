import React, { useState } from 'react';
import { Modal, Select, Textarea, Button, Group, Stack } from '@mantine/core';
import { useI18n } from '../../i18n/useI18n';

interface RejectReasonModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: (reason: string, notes: string) => void;
  loading?: boolean;
}

export const RejectReasonModal: React.FC<RejectReasonModalProps> = ({
  opened,
  onClose,
  onConfirm,
  loading,
}) => {
  const { t } = useI18n();
  const [reason, setReason] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const REASONS = [
    { value: 'GPS_SPOOF', label: t.moderation.reasons.GPS_SPOOF },
    { value: 'DISTANCE_MISMATCH', label: t.moderation.reasons.DISTANCE_MISMATCH },
    { value: 'DUPLICATE', label: t.moderation.reasons.DUPLICATE },
    { value: 'OTHER', label: t.moderation.reasons.OTHER },
  ];

  const handleConfirm = () => {
    if (!reason) return;
    onConfirm(reason, notes);
  };

  return (
    <Modal opened={opened} onClose={onClose} title={t.moderation.rejectTitle} centered>
      <Stack gap="md">
        <Select
          label={t.moderation.reason}
          placeholder={t.moderation.rejectReasonPlaceholder}
          data={REASONS}
          value={reason}
          onChange={setReason}
          required
        />
        <Textarea
          label={t.moderation.notes}
          placeholder={t.moderation.rejectNotesPlaceholder}
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
          minRows={2}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>{t.moderation.cancel}</Button>
          <Button color="red" loading={loading} disabled={!reason} onClick={handleConfirm}>
            {t.moderation.reject}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
