import React, { useState } from 'react';
import { Box, Card, TextInput, ColorInput, Button, Stack } from '@mantine/core';
import { PageHeader } from '../../core/components/PageHeader';
import { notifications } from '@mantine/notifications';
import { useI18n } from '../../i18n/useI18n';

export const SponsorBrandStudio: React.FC = () => {
  const { t } = useI18n();
  const [primary, setPrimary] = useState('#4f46e5');
  const [logoUrl, setLogoUrl] = useState('');

  const save = () => {
    notifications.show({
      title: t.sponsor.brandSaved,
      message: t.sponsor.brandSavedMsg,
      color: 'green',
    });
  };

  return (
    <Box>
      <PageHeader title={t.sponsor.brandTitle} subtitle={t.sponsor.brandSubtitle} />
      <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <Stack maw={400}>
          <ColorInput label={t.sponsor.primaryColor} value={primary} onChange={setPrimary} />
          <TextInput label={t.sponsor.logoUrl} value={logoUrl} onChange={(e) => setLogoUrl(e.currentTarget.value)} />
          <Button onClick={save}>{t.sponsor.savePreview}</Button>
        </Stack>
      </Card>
    </Box>
  );
};
