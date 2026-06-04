import React from 'react';
import { Alert, Badge, Button, Group, Text, Tooltip } from '@mantine/core';
import { AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import {
    computeLiveMapHealth,
    formatLastSyncAgo,
    statusColor,
    statusLabel,
    type LiveMapHealthInput,
} from './liveMapHealth';

export type LiveMapStatusBarProps = LiveMapHealthInput & {
    onRetry?: () => void;
    mapLoadError?: string | null;
    onRetryMap?: () => void;
    staleAfterMs?: number;
};

export const LiveMapStatusBar: React.FC<LiveMapStatusBarProps> = (props) => {
    const {
        onRetry,
        mapLoadError,
        onRetryMap,
        staleAfterMs,
        ...healthInput
    } = props;

    const health = computeLiveMapHealth({ ...healthInput, staleAfterMs });
    const showRetry =
        (health.status === 'error' || health.status === 'stale')
        && onRetry
        && healthInput.canFetch
        && !healthInput.liveFetchPaused;

    if (mapLoadError) {
        return (
            <Alert
                color="red"
                variant="filled"
                icon={<AlertCircle size={16} />}
                title="Mapa niedostępna"
                style={{
                    position: 'absolute',
                    bottom: 12,
                    right: 12,
                    left: 12,
                    zIndex: 12,
                    maxWidth: 420,
                    marginLeft: 'auto',
                }}
                data-testid="live-map-status-bar"
            >
                <Text size="sm" mb="xs">{mapLoadError}</Text>
                {onRetryMap && (
                    <Button size="xs" variant="white" color="red" leftSection={<RefreshCw size={14} />} onClick={onRetryMap}>
                        Ponów ładowanie
                    </Button>
                )}
            </Alert>
        );
    }

    const needsBanner =
        health.status !== 'live'
        || health.message != null
        || health.positionsCapped;

    if (!needsBanner && health.status === 'live') {
        return (
            <Group
                gap={6}
                data-testid="live-map-status-bar"
                aria-live="polite"
                style={{
                    position: 'absolute',
                    bottom: 12,
                    right: 12,
                    zIndex: 12,
                    pointerEvents: 'none',
                    padding: '4px 10px',
                    borderRadius: 8,
                    background: 'rgba(24,24,27,0.9)',
                    border: '1px solid rgba(255,255,255,0.1)',
                }}
            >
                <Badge size="xs" color={statusColor(health.status)} variant="dot">
                    {statusLabel(health.status)}
                </Badge>
                <Text size="xs" c="gray.4" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    sync {formatLastSyncAgo(health.lastSuccessAt)}
                    {health.lastLatencyMs != null ? ` · ${health.lastLatencyMs}ms` : ''}
                </Text>
            </Group>
        );
    }

    const Icon = health.status === 'offline' ? WifiOff : Wifi;

    return (
        <Alert
            color={statusColor(health.status)}
            variant="light"
            icon={<Icon size={16} />}
            title={statusLabel(health.status)}
            style={{
                position: 'absolute',
                bottom: 12,
                right: 12,
                left: 12,
                zIndex: 12,
                maxWidth: 480,
                marginLeft: 'auto',
                pointerEvents: 'auto',
            }}
            data-testid="live-map-status-bar"
            aria-live="polite"
        >
            <Group gap="xs" wrap="wrap" align="center">
                {health.message && <Text size="sm">{health.message}</Text>}
                <Text size="xs" c="dimmed">
                    Ostatnia synchronizacja: {formatLastSyncAgo(health.lastSuccessAt)}
                    {health.lastLatencyMs != null ? ` (${health.lastLatencyMs} ms)` : ''}
                </Text>
                {health.detailCeiling && (
                    <Badge size="xs" variant="outline">detail ≤ {health.detailCeiling}</Badge>
                )}
                {showRetry && (
                    <Button
                        size="xs"
                        variant="light"
                        leftSection={<RefreshCw size={14} />}
                        onClick={onRetry}
                        data-testid="live-map-retry-sync"
                    >
                        Odśwież
                    </Button>
                )}
            </Group>
        </Alert>
    );
};
