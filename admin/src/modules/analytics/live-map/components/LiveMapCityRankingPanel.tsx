import React from 'react';
import { Box, Text, Group, Badge, ScrollArea } from '@mantine/core';
import { buildCityRanking, type CityRankingRow } from '../engine/liveMapCityRanking';

export type LiveMapCityRankingPanelProps = {
    counts: Record<string, number>;
    bikeCounts: Record<string, number>;
    runCounts: Record<string, number>;
    trend: Record<string, number>;
    compareDeltas?: Record<string, number>;
    onCityClick: (slug: string) => void;
    onCityHover?: (slug: string) => void;
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

function CompareDeltaBadge({ n }: { n: number }) {
    const color = n > 0 ? 'teal' : 'red';
    const label = n > 0 ? `Δ+${n}` : `Δ${n}`;
    return (
        <Badge size="xs" variant="outline" color={color} title="vs wczoraj (replay compare)">
            {label}
        </Badge>
    );
}

function Row({
    row,
    compareDelta,
    onClick,
    onHover,
}: {
    row: CityRankingRow;
    compareDelta?: number;
    onClick: () => void;
    onHover?: () => void;
}) {
    const inactive = row.total === 0;

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
                opacity: inactive ? 0.72 : 1,
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                onHover?.();
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
            }}
        >
            <Group justify="space-between" gap={4} wrap="nowrap">
                <Text size="xs" c={inactive ? 'gray.5' : 'white'} fw={600} truncate>
                    {row.city.name}
                </Text>
                <Group gap={4} wrap="nowrap">
                    <TrendBadge n={row.trend} />
                    {compareDelta != null && compareDelta !== 0 && (
                        <CompareDeltaBadge n={compareDelta} />
                    )}
                    <Badge size="xs" color={inactive ? 'gray' : 'violet'} variant={inactive ? 'light' : 'filled'}>
                        {row.total}
                    </Badge>
                </Group>
            </Group>
            <Text size="2xs" c="gray.6">
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
    compareDeltas,
    onCityClick,
    onCityHover,
    visible,
}) => {
    if (!visible) return null;
    const rows = buildCityRanking(counts, bikeCounts, runCounts, trend, { includeInactive: true });
    const hasActive = rows.some((r) => r.total > 0);

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
            <Text size="xs" c="gray.4" mb={2} px={4} fw={600}>
                {hasActive ? 'Aktywne miasta' : 'Miasta symulacji'}
            </Text>
            <Text size="2xs" c="gray.6" mb={6} px={4}>
                Kliknij, aby zbliżyć widok
            </Text>
            <ScrollArea.Autosize mah={240} type="scroll">
                {rows.map((row) => (
                    <Row
                        key={row.city.slug}
                        row={row}
                        compareDelta={compareDeltas?.[row.city.slug]}
                        onClick={() => onCityClick(row.city.slug)}
                        onHover={onCityHover ? () => onCityHover(row.city.slug) : undefined}
                    />
                ))}
            </ScrollArea.Autosize>
        </Box>
    );
};
