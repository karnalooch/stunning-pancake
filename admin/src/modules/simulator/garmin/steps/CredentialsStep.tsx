import React from 'react';
import { Alert, Button, Group, NumberInput, ScrollArea, Stack, Table, Text, TextInput, PasswordInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ArrowRight, Key, Users } from 'lucide-react';
import type { UseFormReturnType } from '@mantine/form';
import { SimulatorApi, formatApiError } from '../../../../api/client';
import type { GarminFormValues } from '../garminForm';
import { generatePolishNames } from '../polishNames';

interface CredentialsStepProps {
    form: UseFormReturnType<GarminFormValues>;
    onNext: () => void;
    resizeForUserCount: (count: number) => void;
}

export const CredentialsStep: React.FC<CredentialsStepProps> = ({ form, onNext, resizeForUserCount }) => {
    const { userCount, credentials, names } = form.values;

    const fillTestCredentials = () => {
        const next = Array.from({ length: userCount }, (_, i) => ({
            email: `testsim${i + 1}@gmail.com`,
            password: `testpass${i + 1}`,
        }));
        form.setFieldValue('credentials', next);
    };

    return (
        <Stack gap="lg" mt="xl" style={{ maxWidth: 700 }}>
            <Alert color="indigo" icon={<Key size={18} />} title="Garmin Connect Credentials">
                <Text size="sm">
                    Enter login and password for each Garmin Connect account.
                    Credentials are encrypted at rest (Fernet) and used only for uploading activities.
                </Text>
            </Alert>

            <NumberInput
                label="Number of Users"
                description="1–50 athletes"
                value={userCount}
                onChange={(v) => resizeForUserCount(Number(v) || 1)}
                min={1}
                max={50}
                leftSection={<Users size={16} />}
                size="md"
                error={form.errors.userCount}
            />

            <Group gap="xs">
                <Button variant="light" size="xs" onClick={fillTestCredentials}>
                    Fill test credentials
                </Button>
                <Button
                    variant="light"
                    size="xs"
                    onClick={() => form.setFieldValue('names', generatePolishNames(userCount))}
                >
                    Regenerate names
                </Button>
                <Button
                    variant="light"
                    size="xs"
                    color="teal"
                    onClick={async () => {
                        try {
                            const res = await SimulatorApi.generateGarminEmails({
                                count: userCount,
                                names: names.slice(0, userCount),
                            });
                            form.setFieldValue(
                                'credentials',
                                res.emails.map((e) => ({ email: e.email, password: e.password })),
                            );
                            notifications.show({
                                title: 'Emails generated',
                                message: `${userCount} email accounts created`,
                                color: 'teal',
                            });
                        } catch (err: unknown) {
                            notifications.show({
                                title: 'Generation failed',
                                message: formatApiError(err, 'Could not generate emails'),
                                color: 'red',
                            });
                        }
                    }}
                >
                    Generate emails
                </Button>
            </Group>

            <ScrollArea h={320}>
                <Table striped highlightOnHover fontSize="xs">
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>#</Table.Th>
                            <Table.Th>Name</Table.Th>
                            <Table.Th>Garmin Email</Table.Th>
                            <Table.Th>Password</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {Array.from({ length: userCount }, (_, i) => (
                            <Table.Tr key={i}>
                                <Table.Td>{i + 1}</Table.Td>
                                <Table.Td>
                                    <Text size="xs" fw={500}>{names[i]?.display || `User ${i + 1}`}</Text>
                                </Table.Td>
                                <Table.Td>
                                    <TextInput
                                        size="xs"
                                        placeholder={`sim${i + 1}@gmail.com`}
                                        value={credentials[i]?.email || ''}
                                        error={form.errors[`credentials.${i}.email`]}
                                        onChange={(e) =>
                                            form.setFieldValue(`credentials.${i}.email`, e.target.value)
                                        }
                                    />
                                </Table.Td>
                                <Table.Td>
                                    <PasswordInput
                                        size="xs"
                                        placeholder="password"
                                        value={credentials[i]?.password || ''}
                                        error={form.errors[`credentials.${i}.password`]}
                                        onChange={(e) =>
                                            form.setFieldValue(`credentials.${i}.password`, e.target.value)
                                        }
                                    />
                                </Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            </ScrollArea>

            <Group justify="flex-end" mt="xl">
                <Button size="md" color="violet" rightSection={<ArrowRight size={16} />} onClick={onNext}>
                    Next: Schedule
                </Button>
            </Group>
        </Stack>
    );
};
