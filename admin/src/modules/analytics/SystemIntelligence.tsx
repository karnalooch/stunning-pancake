import React from 'react';
import { Card, Text, Group, Stack, Badge, Box, SimpleGrid } from '@mantine/core';
import { BrainCircuit, AlertTriangle, Lightbulb, TrendingUp, Cpu } from 'lucide-react';
import { motion } from 'framer-motion';

export const SystemIntelligence = () => {
  return (
    <Card radius="xl" p="xl" className="fluent-acrylic" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
      <Group mb="xl">
        <Box p="xs" bg="rgba(37, 99, 235, 0.1)" style={{ borderRadius: '12px' }}>
          <BrainCircuit size={24} color="#2563EB" />
        </Box>
        <Box>
          <Text fw={900} size="lg" color="white">System Intelligence (AI)</Text>
          <Text size="xs" c="dimmed">GPT-4o analyzed platform-wide heuristics</Text>
        </Box>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
        <Stack gap="md">
          <Box p="md" style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
             <Group mb="xs">
               <AlertTriangle size={18} color="#EF4444" />
               <Text fw={700} size="sm" color="red">Integrity Alert</Text>
             </Group>
             <Text size="xs" c="dimmed" lh={1.6}>
               Detected 12 coordinated anomaly patterns in <Text span c="white" fw={700}>Warsaw Instance</Text>. 
               Probability of GPS spoofing cluster: <Text span c="red">89%</Text>. 
               Recommendation: Deploy mandatory adaptive verification.
             </Text>
          </Box>

          <Box p="md" style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
             <Group mb="xs">
               <TrendingUp size={18} color="#10B981" />
               <Text fw={700} size="sm" color="green">Growth Insight</Text>
             </Group>
             <Text size="xs" c="dimmed" lh={1.6}>
               Athlete engagement in <Text span c="white" fw={700}>Siedlce</Text> spiked by 40% after "Eco Coffee" POI activation. 
               Scaling this pattern to other instances could increase global retention by <Text span c="green">12%</Text>.
             </Text>
          </Box>
        </Stack>

        <Stack gap="md">
          <Box p="md" style={{ background: 'rgba(37, 99, 235, 0.05)', borderRadius: '16px', border: '1px solid rgba(37, 99, 235, 0.2)', height: '100%' }}>
             <Group mb="xs">
               <Lightbulb size={18} color="#FBBF24" />
               <Text fw={700} size="sm" color="yellow">Global Strategy</Text>
             </Group>
             <Text size="xs" c="white" fw={500} lh={1.8}>
               "Platform is currently operating at <Text span c="blue">94% efficiency</Text>. 
               The current multi-tenant RLS structure is handling the load perfectly. 
               Consider introducing 'Global Events' to create cross-city competition and boost voucher redemption rates by the next quarter."
             </Text>
             <Group mt="xl">
               <Badge variant="outline" color="blue">Optimized</Badge>
               <Badge variant="outline" color="gray" leftSection={<Cpu size={12}/>}>Latency: 14ms</Badge>
             </Group>
          </Box>
        </Stack>
      </SimpleGrid>
    </Card>
  );
};
