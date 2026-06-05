import React from 'react';
import { Group, Slider, Text, Badge, ActionIcon, Tooltip, SegmentedControl, Select, Button } from '@mantine/core';
import { Play, Pause, RotateCcw, CloudDownload } from 'lucide-react';
import type { ServerReplayStep } from './liveMapServerReplay';

export type LiveMapReplaySource = 'client' | 'server';

export type LiveMapReplayScrubberProps = {
    visible: boolean;
    frameCount: number;
    index: number;
    playing: boolean;
    onIndexChange: (n: number) => void;
    onTogglePlay: () => void;
    onClear: () => void;
    source?: LiveMapReplaySource;
    onSourceChange?: (source: LiveMapReplaySource) => void;
    serverAvailable?: boolean;
    step?: ServerReplayStep;
    onStepChange?: (step: ServerReplayStep) => void;
    onLoadServer?: () => void;
    serverLoading?: boolean;
};

export const LiveMapReplayScrubber: React.FC<LiveMapReplayScrubberProps> = ({
    visible,
    frameCount,
    index,
    playing,
    onIndexChange,
    onTogglePlay,
    onClear,
    source = 'client',
    onSourceChange,
    serverAvailable = false,
    step = '30s',
    onStepChange,
    onLoadServer,
    serverLoading = false,
}) => {
    if (!visible) return null;
    const canScrub = frameCount >= 2;
    return (
        <Group
            gap="sm"
            data-testid="live-map-replay"
            wrap="wrap"
            style={{
                position: 'absolute',
                bottom: 52,
                left: 12,
                right: 12,
                zIndex: 11,
                padding: '8px 12px',
                borderRadius: 10,
                background: 'rgba(24,24,27,0.9)',
                border: '1px solid rgba(255,255,255,0.1)',
            }}
        >
            <Badge size="sm" variant="light" color="cyan">Replay</Badge>
            {serverAvailable && onSourceChange && (
                <SegmentedControl
                    size="xs"
                    value={source}
                    onChange={(v) => onSourceChange(v as LiveMapReplaySource)}
                    data={[
                        { value: 'client', label: 'Bufor' },
                        { value: 'server', label: 'Serwer' },
                    ]}
                    data-testid="live-map-replay-source"
                />
            )}
            {source === 'server' && onStepChange && (
                <Select
                    size="xs"
                    w={90}
                    value={step}
                    onChange={(v) => onStepChange((v as ServerReplayStep) || '30s')}
                    data={[
                        { value: '5s', label: '5s' },
                        { value: '30s', label: '30s' },
                        { value: '60s', label: '60s' },
                    ]}
                    comboboxProps={{ withinPortal: true }}
                    aria-label="Krok replay"
                />
            )}
            {source === 'server' && onLoadServer && (
                <Button
                    size="xs"
                    variant="light"
                    leftSection={<CloudDownload size={14} />}
                    loading={serverLoading}
                    onClick={onLoadServer}
                    data-testid="live-map-replay-server-load"
                >
                    Załaduj
                </Button>
            )}
            {canScrub && (
                <>
                    <Tooltip label={playing ? 'Pauza' : 'Odtwórz'}>
                        <ActionIcon variant="light" size="sm" onClick={onTogglePlay} aria-label={playing ? 'Pauza' : 'Odtwórz'}>
                            {playing ? <Pause size={14} /> : <Play size={14} />}
                        </ActionIcon>
                    </Tooltip>
                    <Slider
                        style={{ flex: 1, minWidth: 120 }}
                        min={0}
                        max={Math.max(0, frameCount - 1)}
                        value={index}
                        onChange={onIndexChange}
                        size="sm"
                        label={(v) => `#${v + 1}`}
                        aria-label="Klatka replay"
                    />
                    <Text size="xs" c="gray.4" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {index + 1}/{frameCount}
                    </Text>
                </>
            )}
            {!canScrub && source === 'client' && (
                <Text size="xs" c="gray.5">Za mało klatek w buforze (min. 2)</Text>
            )}
            {!canScrub && source === 'server' && !serverLoading && (
                <Text size="xs" c="gray.5">Wybierz zakres i załaduj z Timescale</Text>
            )}
            <Tooltip label="Wyczyść bufor">
                <ActionIcon variant="subtle" size="sm" onClick={onClear} aria-label="Wyczyść replay">
                    <RotateCcw size={14} />
                </ActionIcon>
            </Tooltip>
        </Group>
    );
};
