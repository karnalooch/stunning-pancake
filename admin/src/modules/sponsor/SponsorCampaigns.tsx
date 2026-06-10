import React, { useEffect, useState } from 'react';
import {
  Box, Card, Table, Button, Group, Text, Badge, Modal, TextInput, NumberInput, Select, Stack,
} from '@mantine/core';
import { Plus } from 'lucide-react';
import { API_PATHS } from '@4velo/api-client';
import { apiClient } from '../../api/client';
import { PageHeader } from '../../core/components/PageHeader';
import { notifications } from '@mantine/notifications';
import { useI18n } from '../../i18n/useI18n';

interface Campaign {
  id: number;
  title: string;
  status: string;
  budget_points: number;
}

export const SponsorCampaigns: React.FC = () => {
  const { t } = useI18n();
  const [rows, setRows] = useState<Campaign[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [budget, setBudget] = useState(1000);
  const [status, setStatus] = useState('DRAFT');

  const load = () => {
    apiClient.get(API_PATHS.sponsorCampaigns).then((r) => setRows(r.data ?? [])).catch(() => setRows([]));
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      await apiClient.post(API_PATHS.sponsorCampaigns, { title, status, budget_points: budget });
      notifications.show({ title: t.sponsor.campaignCreated, color: 'green', message: title });
      setOpen(false);
      setTitle('');
      load();
    } catch {
      notifications.show({ title: t.common.error, color: 'red', message: t.sponsor.createFailed });
    }
  };

  return (
    <Box>
      <PageHeader title={t.sponsor.campaignsTitle} subtitle={t.sponsor.campaignsSubtitle}>
        <Button leftSection={<Plus size={16} />} onClick={() => setOpen(true)}>{t.sponsor.newCampaign}</Button>
      </PageHeader>
      <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        {rows.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">{t.sponsor.noCampaigns}</Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t.sponsor.title}</Table.Th>
                <Table.Th>{t.sponsor.status}</Table.Th>
                <Table.Th>{t.sponsor.budgetPts}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((c) => (
                <Table.Tr key={c.id}>
                  <Table.Td>{c.title}</Table.Td>
                  <Table.Td><Badge size="sm">{c.status}</Badge></Table.Td>
                  <Table.Td>{c.budget_points}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>
      <Modal opened={open} onClose={() => setOpen(false)} title={t.sponsor.newCampaign}>
        <Stack>
          <TextInput label={t.sponsor.title} value={title} onChange={(e) => setTitle(e.currentTarget.value)} required />
          <NumberInput label={t.sponsor.budgetPts} value={budget} onChange={(v) => setBudget(Number(v) || 0)} min={1} />
          <Select label={t.sponsor.status} value={status} onChange={(v) => setStatus(v ?? 'DRAFT')} data={['DRAFT', 'ACTIVE', 'PAUSED', 'ENDED']} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={() => void create()} disabled={!title.trim()}>{t.common.create}</Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
};
