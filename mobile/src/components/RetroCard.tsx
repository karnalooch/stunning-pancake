import React from 'react';
import { YStack, YStackProps, styled } from 'tamagui';

/**
 * RetroCard: A themed container component with HD-2D aesthetic.
 * Features 1px black outline and hard shadow.
 */
export const RetroCard = styled(YStack, {
  name: 'RetroCard',
  
  // 1px black outline
  borderWidth: 1,
  borderColor: '$hd2d.outlineColor',
  
  // Background colors based on theme (automatically handled by $background)
  // Dark: Deep Sea (#0B1D33)
  // Solar: White (#FFFFFF)
  backgroundColor: '$background',
  
  // Radius 0 for pixel look
  borderRadius: 0,
  
  padding: '$4',
  
  // Hard shadow effect (4px offset, no blur)
  shadowColor: '#000000',
  shadowOffset: { width: 4, height: 4 },
  shadowOpacity: 1,
  shadowRadius: 0,
  
  // Elevation for Android to support the hard shadow look
  elevation: 4,
  
  // Default spacing for children
  gap: '$3',
});

export type RetroCardProps = YStackProps;
