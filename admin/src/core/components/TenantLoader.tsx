import React, { useEffect, useState } from 'react';
import { Box, Text, Stack, Title } from '@mantine/core';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../auth/useAuth';
import { BrandingApi } from '../../api/client';

export const TenantLoader = ({ visible }: { visible: boolean }) => {
  const { user } = useAuth();
  const [primaryColor, setPrimaryColor] = useState('#2563EB');
  const tenantName = user?.tenantId || 'Platform';

  useEffect(() => {
    if (user?.tenantId) {
      BrandingApi.getBranding(user.tenantId)
        .then(data => {
          if (data.primary_color) setPrimaryColor(data.primary_color);
        })
        .catch(err => console.error("Loader: Branding fetch failed", err));
    }
  }, [user?.tenantId]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            background: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Stack align="center" gap="xl">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Title order={1} style={{ color: 'white', fontWeight: 900, fontSize: '42px', letterSpacing: '-2px' }}>
                {tenantName.toUpperCase()}<Text span style={{ color: primaryColor }}>.</Text>
              </Title>
            </motion.div>
            
            <Box style={{ width: '200px', height: '2px', background: 'rgba(255,255,255,0.1)', position: 'relative', overflow: 'hidden' }}>
               <motion.div 
                 initial={{ left: '-100%' }}
                 animate={{ left: '100%' }}
                 transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                 style={{ 
                   position: 'absolute', 
                   width: '100%', 
                   height: '100%', 
                   background: `linear-gradient(90deg, transparent, ${primaryColor}, transparent)` 
                 }}
               />
            </Box>

            <Text size="xs" c="dimmed" style={{ letterSpacing: '2px', textTransform: 'uppercase' }}>
              Loading City Infrastructure
            </Text>
          </Stack>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
