import React from 'react';
import { Box, Text, Button, Group } from '@mantine/core';
import { Zap, MapPin } from 'lucide-react';

export type LiveMapEmptyStateProps = {
    visible: boolean;
    launching: boolean;
    onQuickLaunch: () => void;
    onOpenSimulator: () => void;
};

export const LiveMapEmptyState: React.FC<LiveMapEmptyStateProps> = ({
    visible,
    launching,
    onQuickLaunch,
    onOpenSimulator,
}) => {
    if (!visible) return null;

    return (
        <Box
            data-testid="live-map-empty-state"
            style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 8,
                maxWidth: 360,
                width: 'calc(100% - 48px)',
                padding: '16px 18px',
                borderRadius: 12,
                background: 'rgba(24,24,27,0.94)',
                border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(10px)',
                pointerEvents: 'auto',
                textAlign: 'center',
            }}
        >
            <MapPin size={28} style={{ color: 'var(--mantine-color-teal-4)', opacity: 0.9 }} />
            <Text size="sm" c="white" fw={600} mt="xs">
                Brak aktywnej telemetrii
            </Text>
            <Text size="xs" c="gray.5" mt={4} lh={1.45}>
                Symulator jest wyłączony lub nie ma zawodników na mapie. Uruchom szybki batch live albo
                przejdź do pełnego symulatora.
            </Text>
            <Group justify="center" gap="xs" mt="md" wrap="wrap">
                <Button
                    size="xs"
                    color="teal"
                    leftSection={<Zap size={14} />}
                    loading={launching}
                    onClick={onQuickLaunch}
                    data-testid="live-map-empty-quick-launch"
                >
                    Szybki start
                </Button>
                <Button
                    size="xs"
                    variant="light"
                    color="gray"
                    onClick={onOpenSimulator}
                    data-testid="live-map-empty-simulator"
                >
                    Otwórz symulator
                </Button>
            </Group>
        </Box>
    );
};
