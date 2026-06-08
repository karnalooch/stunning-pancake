import React from 'react';
import {
    Drawer, Stack, Text, Badge, Group, Button, Code, ScrollArea, Divider,
} from '@mantine/core';
import { Copy, X } from 'lucide-react';
import type { LiveMapRequestLogEntry, IncidentBundle } from '../engine/liveMapDiagnostics';
import type { LiveMapHealthSnapshot } from '../engine/liveMapHealth';
import { LiveMapWebhooksPanel } from './LiveMapWebhooksPanel';

export type LiveMapDiagnosticsDrawerProps = {
    opened: boolean;
    onClose: () => void;
    health: LiveMapHealthSnapshot;
    meta: Record<string, unknown> | null;
    requestLog: LiveMapRequestLogEntry[];
    fps?: number;
    onCopyIncident: () => IncidentBundle;
};

export const LiveMapDiagnosticsDrawer: React.FC<LiveMapDiagnosticsDrawerProps> = ({
    opened,
    onClose,
    health,
    meta,
    requestLog,
    fps,
    onCopyIncident,
}) => {
    const copyBundle = () => {
        const bundle = onCopyIncident();
        void navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
    };

    return (
        <Drawer
            opened={opened}
            onClose={onClose}
            position="right"
            title="Live Map — diagnostyka"
            size="md"
            data-testid="live-map-diagnostics"
        >
            <Stack gap="sm">
                <Group gap="xs">
                    <Badge color="blue">{health.status}</Badge>
                    <Badge variant="outline">{health.readMode}</Badge>
                    {fps != null && fps > 0 && (
                        <Badge variant="light" color={fps < 28 ? 'red' : 'gray'}>
                            {fps} FPS
                        </Badge>
                    )}
                </Group>
                {health.message && <Text size="sm" c="dimmed">{health.message}</Text>}
                {health.positionsCapped && (
                    <Text size="xs" c="yellow.7">Viewport capped — pełna gęstość niedostępna.</Text>
                )}
                <Divider label="Ostatnie żądania" labelPosition="center" />
                <ScrollArea.Autosize mah={220}>
                    <Stack gap={6}>
                        {requestLog.length === 0 && (
                            <Text size="xs" c="dimmed">Brak logów w tej sesji.</Text>
                        )}
                        {requestLog.map((row) => (
                            <Code key={row.at} block style={{ fontSize: 11 }}>
                                {new Date(row.at).toLocaleTimeString()}
                                {' · '}
                                z={row.zoom ?? '—'}
                                {' · '}
                                {row.detail}
                                {' · '}
                                {row.latencyMs}ms
                                {' · '}
                                pos={row.positions}
                                {row.capped ? ' · CAPPED' : ''}
                            </Code>
                        ))}
                    </Stack>
                </ScrollArea.Autosize>
                <Divider label="Meta (skrót)" labelPosition="center" />
                <Code block style={{ fontSize: 11, maxHeight: 160, overflow: 'auto' }}>
                    {JSON.stringify(
                        {
                            read_mode: meta?.read_mode,
                            capped: meta?.capped,
                            viewport_total_estimate: meta?.viewport_total_estimate,
                            flagged_in_viewport: meta?.flagged_in_viewport,
                            filters: meta?.filters,
                            poll_after_ms: meta?.poll_after_ms,
                        },
                        null,
                        2,
                    )}
                </Code>
                <LiveMapWebhooksPanel />
                <Group>
                    <Button size="xs" leftSection={<Copy size={14} />} onClick={copyBundle}>
                        Kopiuj incident bundle
                    </Button>
                    <Button size="xs" variant="subtle" leftSection={<X size={14} />} onClick={onClose}>
                        Zamknij
                    </Button>
                </Group>
                <Text size="2xs" c="dimmed">
                    Skróty: +/− zoom, F dopasuj, H heatmapa, D diagnostyka, P prezentacja
                </Text>
            </Stack>
        </Drawer>
    );
};
