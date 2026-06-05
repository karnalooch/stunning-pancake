import React from 'react';
import { Group, Slider, Text, Badge, ActionIcon, Tooltip } from '@mantine/core';
import { Play, Pause, RotateCcw } from 'lucide-react';

export type LiveMapReplayScrubberProps = {
    visible: boolean;
    frameCount: number;
    index: number;
    playing: boolean;
    onIndexChange: (n: number) => void;
    onTogglePlay: () => void;
    onClear: () => void;
};

export const LiveMapReplayScrubber: React.FC<LiveMapReplayScrubberProps> = ({
    visible,
    frameCount,
    index,
    playing,
    onIndexChange,
    onTogglePlay,
    onClear,
}) => {
    if (!visible || frameCount < 2) return null;
    return (
        <Group
            gap="sm"
            data-testid="live-map-replay"
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
            <Tooltip label={playing ? 'Pauza' : 'Odtwórz'}>
                <ActionIcon variant="light" size="sm" onClick={onTogglePlay} aria-label={playing ? 'Pauza' : 'Odtwórz'}>
                    {playing ? <Pause size={14} /> : <Play size={14} />}
                </ActionIcon>
            </Tooltip>
            <Slider
                style={{ flex: 1 }}
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
            <Tooltip label="Wyczyść bufor">
                <ActionIcon variant="subtle" size="sm" onClick={onClear} aria-label="Wyczyść replay">
                    <RotateCcw size={14} />
                </ActionIcon>
            </Tooltip>
        </Group>
    );
};
