import React from 'react';
import { Box, Text } from '@mantine/core';

export const ApiPlayground: React.FC = () => (
    <Box p="md">
        <Text fw={700} size="xl" mb="md">API Playground</Text>
        <Box style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', height: 'calc(100vh - 200px)' }}>
            <iframe src="/api/docs/" style={{ width: '100%', height: '100%', border: 'none' }} title="API Documentation" />
        </Box>
    </Box>
);
