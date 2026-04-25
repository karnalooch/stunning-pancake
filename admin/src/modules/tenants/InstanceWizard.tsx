import React, { useState } from 'react';
import { Modal, TextInput, ColorInput, Button, Stack, Group, Text, Step, Stepper, Box } from '@mantine/core';
import { Building2, Palette, ShieldCheck, Rocket } from 'lucide-react';
import { motion } from 'framer-motion';

export const InstanceWizard = ({ opened, onClose }: any) => {
  const [active, setActive] = useState(0);
  const nextStep = () => setActive((current) => (current < 3 ? current + 1 : current));
  const prevStep = () => setActive((current) => (current > 0 ? current - 1 : current));

  return (
    <Modal 
      opened={opened} 
      onClose={onClose} 
      title={<Text fw={900}>Deploy New Platform Instance</Text>}
      size="lg"
      className="fluent-modal"
      radius="xl"
      overlayProps={{ blur: 10, opacity: 0.8 }}
    >
      <Stepper active={active} onStepClick={setActive} breakpoint="sm" color="blue">
        <Stepper.Step label="Identity" description="City/Company info" icon={<Building2 size={18} />}>
          <Stack mt="xl">
            <TextInput label="Organization Name" placeholder="e.g. City of Siedlce" radius="md" />
            <TextInput label="Instance Slug" placeholder="siedlce" radius="md" description="Used for URL isolation" />
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Branding" description="Visual Identity" icon={<Palette size={18} />}>
          <Stack mt="xl">
            <Group grow>
              <ColorInput label="Primary Color" defaultValue="#2563EB" radius="md" />
              <ColorInput label="Secondary Color" defaultValue="#10B981" radius="md" />
            </Group>
            <TextInput label="Custom Font Family" placeholder="Inter, Roboto..." radius="md" />
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Compliance" description="RLS & Privacy" icon={<ShieldCheck size={18} />}>
          <Box mt="xl" p="md" bg="rgba(37, 99, 235, 0.05)" style={{ borderRadius: '12px' }}>
            <Text size="sm" c="dimmed">
              Physical Data Isolation will be enforced via PostgreSQL RLS Policies. 
              GDPR-compliant telemetry storage is enabled by default.
            </Text>
          </Box>
        </Stepper.Step>

        <Stepper.Completed>
          <Stack align="center" mt="xl" py="xl">
            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity }}>
              <Rocket size={48} color="#2563EB" />
            </motion.div>
            <Text fw={700}>Ready for Deployment</Text>
            <Text size="sm" c="dimmed">The instance will be provisioned on the cluster in ~45 seconds.</Text>
          </Stack>
        </Stepper.Completed>
      </Stepper>

      <Group justify="center" mt="xl">
        {active !== 0 && (
          <Button variant="default" onClick={prevStep} radius="md">Back</Button>
        )}
        {active < 3 ? (
          <Button onClick={nextStep} radius="md">Continue</Button>
        ) : (
          <Button color="blue" radius="md" onClick={onClose}>Deploy Instance</Button>
        )}
      </Group>
    </Modal>
  );
};
