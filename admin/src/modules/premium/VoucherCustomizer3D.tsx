import React, { useState, useRef } from 'react';
import { Box, Card, Text, ColorInput, TextInput, Group, Badge } from '@mantine/core';
import { PageHeader } from '../../core/components/PageHeader';

export const VoucherCustomizer3D: React.FC = () => {
  const [bg, setBg] = useState('#6366F1');
  const [title, setTitle] = useState('Partner Reward');
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const onMove = (e: React.MouseEvent) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: y * -20, y: x * 20 });
  };

  return (
    <Box>
      <PageHeader title="Voucher 3D Designer" subtitle="Brand B2B reward cards (ROADMAP_V3 §7.2)">
        <Badge variant="light" color="pink">Premium · Phase 2</Badge>
      </PageHeader>
      <Group align="flex-start" grow preventGrowOverflow={false}>
        <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, flex: 1 }}>
          <ColorInput label="Background" value={bg} onChange={setBg} mb="md" />
          <TextInput label="Card title" value={title} onChange={(e) => setTitle(e.target.value)} mb="md" />
          <Text size="xs" c="dimmed">Full canvas editor + barcode templates ship in a later sprint.</Text>
        </Card>
        <Card
          style={{ background: 'var(--surface-secondary)', border: '1px solid var(--border)', borderRadius: 14, padding: 40, flex: 1, perspective: 1000 }}
          onMouseMove={onMove}
          onMouseLeave={() => setTilt({ x: 0, y: 0 })}
        >
          <Box
            ref={cardRef}
            style={{
              width: 280,
              height: 160,
              margin: '0 auto',
              borderRadius: 16,
              background: `linear-gradient(135deg, ${bg}, ${bg}cc)`,
              transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
              transition: 'transform 120ms ease-out',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box
              style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(${135 + tilt.y}deg, transparent 40%, rgba(255,255,255,0.35))`,
                pointerEvents: 'none',
              }}
            />
            <Text fw={800} c="white" size="lg">{title}</Text>
          </Box>
        </Card>
      </Group>
    </Box>
  );
};
