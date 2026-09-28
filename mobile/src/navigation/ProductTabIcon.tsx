import React from 'react';
import Svg, { Circle, Line, Path } from 'react-native-svg';

export type ProductTabName = 'Today' | 'Discover' | 'StartRide' | 'Club' | 'You';

type ProductTabIconProps = {
  routeName: ProductTabName;
  color: string;
  size?: number;
};

export function ProductTabIcon({
  routeName,
  color,
  size = 22,
}: ProductTabIconProps) {
  const common = {
    stroke: color,
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      {routeName === 'Today' ? (
        <>
          <Circle cx="12" cy="12" r="7" {...common} />
          <Line x1="12" y1="8" x2="12" y2="12" {...common} />
          <Line x1="12" y1="12" x2="15" y2="14" {...common} />
        </>
      ) : routeName === 'Discover' ? (
        <>
          <Circle cx="12" cy="12" r="8" {...common} />
          <Path d="M15.5 8.5l-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2z" {...common} />
        </>
      ) : routeName === 'StartRide' ? (
        <>
          <Circle cx="12" cy="12" r="8" {...common} />
          <Path d="M10 8.8l5 3.2-5 3.2V8.8z" stroke="none" fill={color} />
        </>
      ) : routeName === 'Club' ? (
        <>
          <Circle cx="9" cy="9" r="2.5" {...common} />
          <Circle cx="16.5" cy="10" r="2" {...common} />
          <Path d="M4.5 18c.5-3 2.1-4.5 4.5-4.5s4 1.5 4.5 4.5" {...common} />
          <Path d="M14 14.3c2.8-.5 4.6.8 5.2 3.2" {...common} />
        </>
      ) : (
        <>
          <Circle cx="12" cy="8.5" r="3" {...common} />
          <Path d="M6.5 19c.6-3.6 2.5-5.4 5.5-5.4s4.9 1.8 5.5 5.4" {...common} />
        </>
      )}
    </Svg>
  );
}
