import React from 'react';
import { Box, Group, Stack, Title, Text, Button, SimpleGrid } from '@mantine/core';
import { useDesigner, EditableText } from '../../providers/DesignerProvider';
import { Settings2, Users, Radio, ShieldCheck, TrendingUp, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDisclosure } from '@mantine/hooks';
import { StatCard } from './components/StatCard';
import { GlobalHeatmap } from '../analytics/GlobalHeatmap';
import { StatCard } from './components/StatCard';
import { GlobalHeatmap } from '../analytics/GlobalHeatmap';
import { CityAnalytics } from '../analytics/CityAnalytics';
import { SystemIntelligence } from '../analytics/SystemIntelligence';
import { ModeratorWorklist } from './ModeratorWorklist';


import { InstanceWizard } from '../tenants/InstanceWizard';
import { useAuth } from '../../core/auth/useAuth';

export const Dashboard: React.FC<{ mode: 'light' | 'dark' }> = ({ mode }) => {
  const { user } = useAuth();
  const { isEditMode, toggleEditMode } = useDesigner();
  const [wizardOpened, { open, close }] = useDisclosure(false);
  
  const isGlobalOwner = user?.role === 'GLOBAL_OWNER';
  const isModerator = user?.role === 'TENANT_MODERATOR';



  return (
    <Box p="xl" style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflowY: 'auto' }}>
      <InstanceWizard opened={wizardOpened} onClose={close} />
      
      <Group justify="space-between" mb="xl">
        <Stack gap={0}>
          <Title className="text-gradient" style={{ fontSize: '36px', fontWeight: 900 }}>
            <EditableText 
              initialValue={isGlobalOwner ? "Global Command Center" : `${user?.tenantId?.toUpperCase() || 'City'} Terminal`} 
              size="xl" weight={900} 
            />
          </Title>
          <Text size="xs" c="dimmed">
            {isGlobalOwner ? 'Operational status for all platform nodes' : `Local node performance metrics`}
          </Text>
        </Stack>
        <Group>
          <Button 
            variant={isEditMode ? 'filled' : 'light'} 
            color={isEditMode ? 'green' : 'blue'}
            onClick={toggleEditMode}
            leftSection={<Settings2 size={16} />}
          >
            {isEditMode ? 'Exit Designer Mode' : 'Enter Designer Mode'}
          </Button>
          {isGlobalOwner && (
            <Button 
              size="md" 
              radius="md" 
              color="blue" 
              leftSection={<Plus size={20} />}
              onClick={open}
            >
              Deploy New Instance
            </Button>
          )}
        </Group>

      </Group>

      <SimpleGrid cols={{ base: 1, md: 4 }} spacing="xl" mb="xl">
        <StatCard icon={<Users size={20} />} label="Total Athletes" value="1,042,981" badge="+12%" color="blue" progress={72} glow="glow-blue" />
        <StatCard icon={<Radio size={20} />} label="Active Packets" value="241,082" badge="LIVE" color="lime" progress={84} glow="glow-lime" />
        <StatCard icon={<ShieldCheck size={20} />} label="Fraud Prevented" value="12,402" badge="SECURE" color="red" progress={98} />
        <StatCard icon={<TrendingUp size={20} />} label="Global Revenue" value="$428k" badge="+8.4%" color="indigo" progress={45} />
      </SimpleGrid>

      {isGlobalOwner ? (
        <>
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            style={{ marginBottom: '24px' }}
          >
            <SystemIntelligence />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
          >
            <GlobalHeatmap />
          </motion.div>
        </>
      ) : isModerator ? (
        <ModeratorWorklist />
      ) : (
        <CityAnalytics cityId={user?.tenantId || 'siedlce'} />
      )}



    </Box>
  );
};
