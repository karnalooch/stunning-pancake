import React, { useState } from 'react';
import { TextInput, Button, Text, Stack, Card, Group, Badge, PasswordInput } from '@mantine/core';
import { motion } from 'framer-motion';

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<void>;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onLogin(email, password);
    } catch (err: any) {
      setError(err?.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack align="center" justify="center" h="100vh" bg="var(--surface-secondary)">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card withBorder w={400} shadow="sm">
          <Stack gap="lg">
            <Stack gap={4} align="center">
              <Text fw={800} size="xl">4VELO Platform</Text>
              <Text size="sm" c="dimmed">Admin Panel</Text>
            </Stack>

            <form onSubmit={handleSubmit}>
              <Stack gap="md">
                <TextInput
                  label="Email or Username"
                  placeholder="admin@4velo.app"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <PasswordInput
                  label="Password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                {error && <Text size="sm" c="red">{error}</Text>}
                <Button type="submit" fullWidth loading={loading}>
                  Sign In
                </Button>
              </Stack>
            </form>
          </Stack>
        </Card>
      </motion.div>
    </Stack>
  );
};
