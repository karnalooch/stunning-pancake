import React from 'react';
import { Button, Card, Group, ScrollArea, Table, Text } from '@mantine/core';
import type { GarminSummaryUser } from '../api/types';

interface GarminSummaryTableProps {
    summary: GarminSummaryUser[];
    onClear: () => void;
    loading?: boolean;
}

export const GarminSummaryTable: React.FC<GarminSummaryTableProps> = ({
    summary,
    onClear,
    loading,
}) => {
    if (!summary.length) return null;

    return (
        <Card withBorder padding="md" bg="var(--surface-secondary)">
            <Group justify="space-between" mb="xs">
                <Text size="sm" fw={600}>Registered Users</Text>
                <Button variant="subtle" size="xs" color="red" onClick={onClear} loading={loading}>
                    Clear Summary
                </Button>
            </Group>
            <ScrollArea h={180}>
                <Table fontSize="xs" striped highlightOnHover>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>#</Table.Th>
                            <Table.Th>Name</Table.Th>
                            <Table.Th>Email</Table.Th>
                            <Table.Th>User ID</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {summary.map((u) => (
                            <Table.Tr key={u.index}>
                                <Table.Td>{u.index}</Table.Td>
                                <Table.Td><Text fw={500}>{u.display_name}</Text></Table.Td>
                                <Table.Td><Text ff="monospace">{u.email}</Text></Table.Td>
                                <Table.Td>{u.user_id}</Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            </ScrollArea>
        </Card>
    );
};
