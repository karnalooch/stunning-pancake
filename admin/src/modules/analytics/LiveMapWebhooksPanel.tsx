import React, { useCallback, useEffect, useState } from 'react';
import {
    Stack, Text, TextInput, Button, Group, Switch, MultiSelect, Badge, Divider,
} from '@mantine/core';
import { TelemetryApi } from '../../api/client';

const EVENT_OPTIONS = [
    { value: 'viewport_capped', label: 'Viewport capped' },
    { value: 'sync_stale', label: 'Sync stale' },
    { value: 'flagged_spike', label: 'Flagged spike' },
    { value: 'zero_positions_anomaly', label: 'Zero positions' },
];

type WebhookRow = {
    id: number;
    url: string;
    events: string[];
    enabled: boolean;
    failure_count: number;
    last_delivery_at: string | null;
};

export const LiveMapWebhooksPanel: React.FC = () => {
    const [rows, setRows] = useState<WebhookRow[]>([]);
    const [url, setUrl] = useState('');
    const [secret, setSecret] = useState('');
    const [events, setEvents] = useState<string[]>(['viewport_capped']);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        try {
            const data = await TelemetryApi.listLiveMapWebhooks();
            setRows(Array.isArray(data) ? data : data?.results ?? []);
        } catch {
            setRows([]);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const create = async () => {
        if (!url || !secret) return;
        setLoading(true);
        try {
            await TelemetryApi.createLiveMapWebhook({ url, secret, events, enabled: true });
            setUrl('');
            setSecret('');
            await load();
        } finally {
            setLoading(false);
        }
    };

    const testPing = async (id: number) => {
        await TelemetryApi.testLiveMapWebhook(id);
    };

    return (
        <Stack gap="sm" data-testid="live-map-webhooks">
            <Divider label="Webhooki alertów" labelPosition="center" />
            <Text size="xs" c="dimmed">
                Integracja Slack/PagerDuty — dostawa async z podpisem HMAC.
            </Text>
            {rows.map((row) => (
                <Stack key={row.id} gap={4}>
                    <Group gap="xs" wrap="wrap">
                        <Text size="xs" truncate style={{ flex: 1, minWidth: 120 }}>{row.url}</Text>
                        <Badge size="xs" color={row.enabled ? 'teal' : 'gray'} variant="dot">
                            {row.enabled ? 'on' : 'off'}
                        </Badge>
                        <Badge size="xs" color={row.failure_count > 0 ? 'red' : 'teal'}>
                            fail={row.failure_count}
                        </Badge>
                        <Button size="xs" variant="light" onClick={() => testPing(row.id)}>
                            Test ping
                        </Button>
                    </Group>
                    <Text size="2xs" c="dimmed">
                        {row.events.join(', ')}
                        {row.last_delivery_at
                            ? ` · ostatnia dostawa: ${new Date(row.last_delivery_at).toLocaleString()}`
                            : ' · brak dostaw'}
                    </Text>
                </Stack>
            ))}
            <TextInput
                size="xs"
                label="URL"
                placeholder="https://hooks.example.com/live-map"
                value={url}
                onChange={(e) => setUrl(e.currentTarget.value)}
            />
            <TextInput
                size="xs"
                label="Secret (HMAC)"
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.currentTarget.value)}
            />
            <MultiSelect
                size="xs"
                label="Eventy"
                data={EVENT_OPTIONS}
                value={events}
                onChange={setEvents}
                comboboxProps={{ withinPortal: true }}
            />
            <Group>
                <Switch size="xs" label="Włączony" checked disabled />
                <Button size="xs" loading={loading} onClick={create}>
                    Dodaj webhook
                </Button>
            </Group>
        </Stack>
    );
};
