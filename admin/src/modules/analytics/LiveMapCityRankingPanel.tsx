import React from 'react';
import { Box, Text, Group, Badge, ScrollArea } from '@mantine/core';
import { buildCityRanking, type CityRankingRow } from './liveMapCityRanking';

export type LiveMapCityRankingPanelProps = {
    counts: Record<string, number>;
    bikeCounts: Record<string, number>;
    runCounts: Record<string, number>;
    trend: Record<string, number>;
    onCityClick: (slug: string) => void;
    visible: boolean;
};

function TrendBadge({ n }: { n: number }) {
    if (n === 0) return null;
    const color = n > 0 ? 'teal' : 'red';
    const label = n > 0 ? `+${n}` : String(n);
    return (
        <Badge size="xs" variant="light" color={color}>
            {label}
        </Badge>
    );
}

function Row({ row, onClick }: { row: CityRankingRow; onClick: () => void }) {
    return (
        <Box
            component="button"
            type="button"
            onClick={onClick}
            style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '6px 8px',
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
            <Group justify="space-between" gap={4} wrap="nowrap">
                <Text size="xs" c="white" fw={600} truncate>
                    {row.city.name}
                </Text>
                <Group gap={4} wrap="nowrap">
                    <TrendBadge n={row.trend} />
                    <Badge size="xs" color="violet" variant="filled">{row.total}</Badge>
                </Group>
            </Group>
            <Text size="2xs" c="gray.5">
                {row.bike} rower · {row.run} bieg
            </Text>
        </Box>
    );
}

export const LiveMapCityRankingPanel: React.FC<LiveMapCityRankingPanelProps> = ({
    counts,
    bikeCounts,
    runCounts,
    trend,
    onCityClick,
    visible,
}) => {
    if (!visible) return null;
    const rows = buildCityRanking(counts, bikeCounts, runCounts, trend);
    if (rows.length === 0) return null;

    return (
        <Box
            data-testid="live-map-city-ranking"
            style={{
                position: 'absolute',
                top: 56,
                right: 12,
                zIndex: 10,
                width: 200,
                maxHeight: 280,
                borderRadius: 10,
                background: 'rgba(24,24,27,0.92)',
                border: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(8px)',
                padding: '8px 6px',
            }}
        >
            <Text size="xs" c="gray.4" mb={6} px={4} fw={600}>
                Aktywne miasta
            </Text>
            <ScrollArea.Autosize mah={240} type="scroll">
                {rows.map((row) => (
                    <Row key={row.city.slug} row={row} onClick={() => onCityClick(row.city.slug)} />
                ))}
            </ScrollArea.Autosize>
        </Box>
    );
};
