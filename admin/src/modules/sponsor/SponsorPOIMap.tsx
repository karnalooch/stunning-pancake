import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, Text, Table, Button, Group, Badge, Stack, Skeleton, Modal,
  TextInput, Select, NumberInput,
} from '@mantine/core';
import { MapPin, Plus } from 'lucide-react';
import { notifications } from '@mantine/notifications';
import { Link } from 'react-router-dom';
import { POIsApi } from '../../api/client';
import { PageHeader } from '../../core/components/PageHeader';

const CATEGORIES = [
  { value: 'COFFEE', label: 'Coffee Shop' },
  { value: 'SHOP', label: 'Retail Store' },
  { value: 'BIKE', label: 'Bike Shop' },
  { value: 'OTHER', label: 'Other' },
];

export const SponsorPOIMap: React.FC = () => {
  const [pois, setPois] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: 'OTHER',
    latitude: 52.23,
    longitude: 21.01,
    description: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await POIsApi.getPOIs();
      setPois(Array.isArray(data) ? data : data?.results ?? []);
    } catch {
      setPois([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      notifications.show({ title: 'Validation', message: 'Name is required.', color: 'orange' });
      return;
    }
    try {
      await POIsApi.createPOI(form);
      notifications.show({ title: 'POI created', message: form.name, color: 'green' });
      setModalOpen(false);
      setForm({ name: '', category: 'OTHER', latitude: 52.23, longitude: 21.01, description: '' });
      load();
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to create POI.', color: 'red' });
    }
  };

  return (
    <Box>
      <PageHeader
        title="Sponsor POI Map"
        subtitle="Manage partner locations on the map"
        breadcrumbs={[
          { label: 'Sponsor', href: '/owner/sponsor' },
          { label: 'POI Map' },
        ]}
      >
        <Button leftSection={<Plus size={16} />} onClick={() => setModalOpen(true)}>
          Add POI
        </Button>
      </PageHeader>

      <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        {loading ? (
          <Stack gap="sm">{[...Array(4)].map((_, i) => <Skeleton key={i} height={40} radius="md" />)}</Stack>
        ) : pois.length === 0 ? (
          <Stack align="center" py="xl" gap="md">
            <MapPin size={48} style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} />
            <Text fw={600}>No sponsor POIs yet</Text>
            <Text c="dimmed" size="sm" maw={400} ta="center">
              Add your first point of interest so athletes can discover your locations and redeem vouchers nearby.
            </Text>
            <Group>
              <Button leftSection={<Plus size={16} />} onClick={() => setModalOpen(true)}>
                Create first POI
              </Button>
              <Button variant="light" component={Link} to="/owner/analytics/vouchers">
                Set up vouchers
              </Button>
            </Group>
          </Stack>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Category</Table.Th>
                <Table.Th>Coordinates</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {pois.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td><Text fw={500}>{p.name}</Text></Table.Td>
                  <Table.Td><Badge variant="light">{p.category}</Badge></Table.Td>
                  <Table.Td>
                    <Text size="xs" ff="monospace" c="dimmed">
                      {p.latitude?.toFixed?.(5) ?? '—'}, {p.longitude?.toFixed?.(5) ?? '—'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="New POI" centered>
        <Stack gap="sm">
          <TextInput label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Select label="Category" data={CATEGORIES} value={form.category} onChange={(v) => setForm({ ...form, category: v || 'OTHER' })} />
          <Group grow>
            <NumberInput label="Latitude" value={form.latitude} decimalScale={6} onChange={(v) => setForm({ ...form, latitude: Number(v) || 0 })} />
            <NumberInput label="Longitude" value={form.longitude} decimalScale={6} onChange={(v) => setForm({ ...form, longitude: Number(v) || 0 })} />
          </Group>
          <TextInput label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Button onClick={handleCreate}>Save POI</Button>
        </Stack>
      </Modal>
    </Box>
  );
};
