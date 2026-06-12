import React, { useEffect, useState } from 'react';
import {
  Box, Button, Card, Group, Modal, Stack, Text, TextInput, Textarea,
  Select, Switch, Skeleton, Alert, Badge,
} from '@mantine/core';
import { AlertCircle, Plus } from 'lucide-react';
import { PageHeader } from '../../core/components/PageHeader';
import { apiClient } from '../../api/client';

interface PlatformNotice {
  id: number;
  severity: string;
  title_pl: string;
  title_en: string;
  body_pl: string;
  body_en: string;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  dismissible: boolean;
}

const emptyForm = {
  severity: 'info',
  title_pl: '',
  title_en: '',
  body_pl: '',
  body_en: '',
  starts_at: new Date().toISOString().slice(0, 16),
  ends_at: '',
  is_active: true,
  dismissible: true,
};

export const PlatformNotices: React.FC = () => {
  const [notices, setNotices] = useState<PlatformNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    apiClient.get('/core/notices/')
      .then((r) => setNotices(Array.isArray(r.data) ? r.data : r.data?.results ?? []))
      .catch(() => setError('Failed to load platform notices.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (n: PlatformNotice) => {
    setEditingId(n.id);
    setForm({
      severity: n.severity,
      title_pl: n.title_pl,
      title_en: n.title_en,
      body_pl: n.body_pl,
      body_en: n.body_en,
      starts_at: n.starts_at?.slice(0, 16) ?? '',
      ends_at: n.ends_at?.slice(0, 16) ?? '',
      is_active: n.is_active,
      dismissible: n.dismissible,
    });
    setModalOpen(true);
  };

  const save = async () => {
    const payload = {
      ...form,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
    };
    if (editingId) {
      await apiClient.patch(`/core/notices/${editingId}/`, payload);
    } else {
      await apiClient.post('/core/notices/', payload);
    }
    setModalOpen(false);
    load();
  };

  const toggleActive = async (n: PlatformNotice) => {
    const path = n.is_active ? 'unpublish' : 'publish';
    await apiClient.post(`/core/notices/${n.id}/${path}/`);
    load();
  };

  if (loading) {
    return (
      <Box p="md">
        <Skeleton height={40} width={300} mb="md" />
        <Stack gap="md">{[...Array(3)].map((_, i) => <Skeleton key={i} height={80} />)}</Stack>
      </Box>
    );
  }

  return (
    <Box p="md">
      <Group justify="space-between" mb="md">
        <PageHeader title="Platform Notices" subtitle="In-app incident and campaign banners (mobile)" />
        <Button leftSection={<Plus size={16} />} onClick={openCreate}>New notice</Button>
      </Group>
      {error && <Alert color="red" icon={<AlertCircle size={18} />} mb="md">{error}</Alert>}
      <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <Stack gap="md">
          {notices.length === 0 && <Text c="dimmed">No notices yet.</Text>}
          {notices.map((n) => (
            <Group key={n.id} justify="space-between" p="sm" style={{ borderRadius: 10, background: 'var(--surface-secondary)' }}>
              <Box>
                <Group gap="xs" mb={4}>
                  <Badge size="sm" color={n.severity === 'critical' ? 'red' : n.severity === 'warning' ? 'orange' : 'blue'}>
                    {n.severity}
                  </Badge>
                  <Badge size="sm" variant="light" color={n.is_active ? 'green' : 'gray'}>
                    {n.is_active ? 'active' : 'draft'}
                  </Badge>
                </Group>
                <Text fw={600} size="sm">{n.title_pl}</Text>
                <Text size="xs" c="dimmed" lineClamp={2}>{n.body_pl}</Text>
              </Box>
              <Group gap="xs">
                <Button size="xs" variant="light" onClick={() => openEdit(n)}>Edit</Button>
                <Button size="xs" variant="default" onClick={() => void toggleActive(n)}>
                  {n.is_active ? 'Unpublish' : 'Publish'}
                </Button>
              </Group>
            </Group>
          ))}
        </Stack>
      </Card>

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit notice' : 'New notice'} size="lg">
        <Stack gap="sm">
          <Select
            label="Severity"
            data={[
              { value: 'info', label: 'Info' },
              { value: 'warning', label: 'Warning' },
              { value: 'critical', label: 'Critical' },
            ]}
            value={form.severity}
            onChange={(v) => setForm({ ...form, severity: v ?? 'info' })}
          />
          <TextInput label="Title (PL)" value={form.title_pl} onChange={(e) => setForm({ ...form, title_pl: e.target.value })} />
          <TextInput label="Title (EN)" value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} />
          <Textarea label="Body (PL)" minRows={3} value={form.body_pl} onChange={(e) => setForm({ ...form, body_pl: e.target.value })} />
          <Textarea label="Body (EN)" minRows={3} value={form.body_en} onChange={(e) => setForm({ ...form, body_en: e.target.value })} />
          <TextInput label="Starts at" type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
          <TextInput label="Ends at (optional)" type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
          <Switch label="Active" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.currentTarget.checked })} />
          <Switch label="Dismissible in app" checked={form.dismissible} onChange={(e) => setForm({ ...form, dismissible: e.currentTarget.checked })} />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()}>Save</Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
};
