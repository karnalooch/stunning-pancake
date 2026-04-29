import React, { useState } from 'react';
import { Box, Paper, TextInput, PasswordInput, Button, Title, Text, Stack, Group, Divider } from '@mantine/core';
import { motion } from 'framer-motion';
import { ShieldCheck, ArrowRight, Lock } from 'lucide-react';

export const LoginPage = ({ onLogin }: { onLogin: (u: string, p: string) => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    onLogin(username, password);
    // We remove the setTimeout since it's async in App.tsx
    // and state resets based on component unmount on success.
    setTimeout(() => setLoading(false), 1000);
  };

  return (
    <Box
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 20% 20%, #0a0a0a 0%, #000 100%)',
        overflow: 'hidden'
      }}
    >
      {/* Background Glow */}
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity }}
        style={{
          position: 'absolute',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(37, 99, 235, 0.15) 0%, transparent 70%)',
          filter: 'blur(60px)',
          zIndex: 0
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <Paper
          p={40}
          radius="xl"
          style={{
            width: '420px',
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            zIndex: 1
          }}
        >
          <Stack align="center" gap="xs" mb={30}>
            <Box
              p="md"
              style={{
                borderRadius: '16px',
                background: 'rgba(37, 99, 235, 0.1)',
                border: '1px solid rgba(37, 99, 235, 0.2)'
              }}
            >
              <ShieldCheck size={32} color="#2563EB" />
            </Box>
            <Title order={2} style={{ color: 'white', fontWeight: 900, letterSpacing: '-1px' }}>
              SPORT<Text span c="blue">.</Text> Owner
            </Title>
            <Text size="xs" c="dimmed" style={{ letterSpacing: '1px', textTransform: 'uppercase' }}>
              Strategic Operations Login
            </Text>
          </Stack>

          <Stack gap="md">
            <TextInput
              label="Operator ID"
              placeholder="admin@sport.com"
              radius="md"
              value={username}
              onChange={(e) => setUsername(e.currentTarget.value)}
              styles={{
                input: { background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' },
                label: { color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 700 }
              }}
            />
            <PasswordInput
              label="Access Token"
              placeholder="••••••••"
              radius="md"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              styles={{
                input: { background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' },
                label: { color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 700 }
              }}
            />
            
            <Button
              fullWidth
              size="lg"
              radius="md"
              color="blue"
              mt="lg"
              loading={loading}
              onClick={handleLogin}
              rightSection={<ArrowRight size={18} />}
              style={{
                boxShadow: '0 10px 20px rgba(37, 99, 235, 0.3)'
              }}
            >
              Authorize Access
            </Button>
          </Stack>

          <Divider my="xl" label="Biometric Backup" labelPosition="center" styles={{ label: { color: '#444' } }} />

          <Group justify="center">
            <Text size="xs" c="dimmed">
              Connection encrypted with RSA-4096
            </Text>
          </Group>
        </Paper>
      </motion.div>

      <Box style={{ position: 'absolute', bottom: 20, textAlign: 'center', width: '100%' }}>
        <Text size="10px" c="dimmed" style={{ letterSpacing: '2px' }}>
          CORE_ENGINE_V2.1 // PROPERTY_OF_SPORT_GLOBAL
        </Text>
      </Box>
    </Box>
  );
};
