import React from 'react';
import { ParticleSystem } from './ParticleSystem';

interface PixelBurstProps {
  trigger: boolean;
  color?: string;
  count?: number;
}

/** @deprecated Use ParticleSystem directly — kept for RideSummaryScreen import. */
export const PixelBurst: React.FC<PixelBurstProps> = ({ trigger, count = 10 }) => (
  <ParticleSystem trigger={trigger} count={count} />
);
