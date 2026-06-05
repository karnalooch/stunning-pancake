import React from 'react';
import { Alert, Text } from '@mantine/core';
import { AlertTriangle } from 'lucide-react';
import { formatCapHonestyMessage } from './liveMapDiagnostics';

export const LiveMapCapBanner: React.FC<{ meta: Record<string, unknown> | null | undefined }> = ({ meta }) => {
    const message = formatCapHonestyMessage(meta);
    if (!message) return null;
    return (
        <Alert
            color="yellow"
            variant="light"
            icon={<AlertTriangle size={16} />}
            data-testid="live-map-cap-banner"
            style={{
                position: 'absolute',
                top: 56,
                left: 12,
                right: 12,
                zIndex: 11,
                maxWidth: 520,
                pointerEvents: 'none',
            }}
        >
            <Text size="xs">{message}</Text>
        </Alert>
    );
};
