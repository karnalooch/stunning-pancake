import React from 'react';
import { Box, Text, Stack, Loader } from '@mantine/core';
import { motion, AnimatePresence } from 'framer-motion';

export const GlobalLoader = ({ visible }: { visible: boolean }) => {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 1, ease: [0.43, 0.13, 0.23, 0.96] }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Stack align="center" gap="xl">
            <motion.div
              animate={{ 
                rotate: [0, 360],
                scale: [1, 1.2, 1],
                borderRadius: ["20%", "50%", "20%"]
              }}
              transition={{ 
                duration: 4, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              style={{
                width: 80,
                height: 80,
                border: '2px solid #2563EB',
                boxShadow: '0 0 30px rgba(37, 99, 235, 0.4)'
              }}
            />
            
            <Stack gap={4} align="center">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: 200 }}
                transition={{ duration: 2, ease: "easeInOut" }}
                style={{ height: 2, background: '#2563EB' }}
              />
              <Text 
                fw={900} 
                size="xs" 
                style={{ 
                  letterSpacing: '4px', 
                  color: 'white', 
                  textTransform: 'uppercase',
                  opacity: 0.8
                }}
              >
                Initializing SPORT Core
              </Text>
              <Text size="10px" c="dimmed" ff="monospace">
                [ AUTH_NODE: OK ] [ GEO_SYNC: OK ] [ RLS_READY ]
              </Text>
            </Stack>
          </Stack>

          {/* Background decorative elements */}
          <Box
            style={{
              position: 'absolute',
              bottom: 40,
              right: 40,
              textAlign: 'right'
            }}
          >
             <Text size="xs" c="dimmed" ff="monospace">v2.1 STABLE // GOD_MODE_AUTHORIZED</Text>
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
