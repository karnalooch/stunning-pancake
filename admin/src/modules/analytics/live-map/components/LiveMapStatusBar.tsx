import React from 'react';
import { Alert, Badge, Button, Group, Text, Tooltip } from '@mantine/core';
import { AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import {
    computeLiveMapHealth,
    formatLastSyncAgo,
    statusColor,
    statusLabel,
    type LiveMapHealthInput,
} from '../engine/liveMapHealth';

export type LiveMapStatusBarProps = LiveMapHealthInput & {
    onRetry?: () => void;
    onForceRefresh?: () => void;
    mapLoadError?: string | null;
    onRetryMap?: () => void;
    staleAfterMs?: number;
    cachedPositionCount?: number;
};

export const LiveMapStatusBar: React.FC<LiveMapStatusBarProps> = (props) => {
    const {
        onRetry,
        onForceRefresh,
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

    const showCachedBadge = health.readMode === 'cached' || health.cachedResponse;

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
                    pointerEvents: showCachedBadge && onForceRefresh ? 'auto' : 'none',
                    padding: '4px 10px',
                    borderRadius: 8,
                    background: 'rgba(24,24,27,0.9)',
                    border: '1px solid rgba(255,255,255,0.1)',
                }}
            >
                <Badge size="xs" color={statusColor(health.status)} variant="dot">
                    {statusLabel(health.status)}
                </Badge>
                {showCachedBadge && (
                    <Badge size="xs" color="cyan" variant="light" data-testid="live-map-cached-badge">
                        z cache
                    </Badge>
                )}
                <Text size="xs" c="gray.4" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    sync {formatLastSyncAgo(health.lastSuccessAt)}
                    {health.lastLatencyMs != null ? ` · ${health.lastLatencyMs}ms` : ''}
                </Text>
                {showCachedBadge && onForceRefresh && (
                    <Button
                        size="compact-xs"
                        variant="subtle"
                        color="gray"
                        leftSection={<RefreshCw size={12} />}
                        onClick={onForceRefresh}
                        data-testid="live-map-force-refresh"
                    >
                        Odśwież
                    </Button>
                )}
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
                {showCachedBadge && (
                    <Badge size="xs" color="cyan" variant="light" data-testid="live-map-cached-badge">
                        z cache
                    </Badge>
                )}
                {showCachedBadge && onForceRefresh && (
                    <Button
                        size="xs"
                        variant="light"
                        leftSection={<RefreshCw size={14} />}
                        onClick={onForceRefresh}
                        data-testid="live-map-force-refresh"
                    >
                        Wymuś odświeżenie
                    </Button>
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
