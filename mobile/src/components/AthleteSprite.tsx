import React, { useEffect, useMemo } from 'react';
import { View } from 'tamagui';
import Svg, { G, Rect, Path } from 'react-native-svg';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSequence,
  Easing
} from 'react-native-reanimated';

export type SpriteClass = 'runner' | 'cyclist' | 'ghost' | 'elite';
export type SpriteState = 'idle' | 'action';

interface AthleteSpriteProps {
  type: SpriteClass;
  state: SpriteState;
  size?: number;
  color?: string;
}

const AnimatedG = Animated.createAnimatedComponent(G);

export const AthleteSprite: React.FC<AthleteSpriteProps> = ({ 
  type, 
  state, 
  size = 60,
  color = '#D4A373' 
}) => {
  const bounce = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (state === 'idle') {
      bounce.value = withRepeat(
        withTiming(-2, { duration: 600, easing: Easing.inOut(Easing.quad) }),
        -1,
        true
      );
      scale.value = withTiming(1, { duration: 300 });
    } else {
      bounce.value = withRepeat(
        withSequence(
          withTiming(-4, { duration: 150 }),
          withTiming(0, { duration: 150 })
        ),
        -1,
        false
      );
      scale.value = withRepeat(
        withTiming(1.05, { duration: 200 }),
        -1,
        true
      );
    }
  }, [state]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bounce.value },
      { scale: scale.value }
    ]
  }));

  const renderSprite = () => {
    switch (type) {
      case 'runner':
        return (
          <G transform={state === 'action' ? "skewX(-10)" : ""}>
            <Rect x="15" y="10" width="20" height="20" fill="#F4F1DE" stroke="#000000" strokeWidth="2"/>
            <Rect x="10" y="30" width="30" height="35" fill={color} stroke="#000000" strokeWidth="2"/>
            {/* Legs */}
            <Rect x="15" y="65" width="8" height="15" fill="#000000" />
            <Rect x="27" y="65" width="8" height={state === 'action' ? 10 : 15} fill="#000000" />
          </G>
        );
      case 'cyclist':
        return (
          <G>
            <Circle cx="20" cy="65" r="15" fill="#FF6B35" stroke="#000000" strokeWidth="2"/>
            <Circle cx="60" cy="65" r="15" fill="#FF6B35" stroke="#000000" strokeWidth="2"/>
            <Path d="M20 65L40 40L60 65" stroke="#000000" strokeWidth="3"/>
            <Rect x="35" y="20" width="15" height="15" fill="#F4F1DE" stroke="#000000" strokeWidth="2"/>
          </G>
        );
      case 'ghost':
        return (
          <G opacity={0.5}>
            <Rect x="15" y="10" width="20" height="20" fill="#2EC4B6" stroke="#000000" strokeWidth="1"/>
            <Rect x="10" y="30" width="30" height="35" fill="#2EC4B6" stroke="#000000" strokeWidth="1"/>
            <Path d="M5 45L0 60M45 45L50 60" stroke="#2EC4B6" strokeWidth="2" strokeDasharray="4 4"/>
          </G>
        );
      case 'elite':
        return (
          <G>
            <Rect x="15" y="10" width="20" height="20" fill="#FFD166" stroke="#000000" strokeWidth="2"/>
            <Rect x="10" y="30" width="30" height="35" fill="#FFD166" stroke="#000000" strokeWidth="2"/>
            <Path d="M25 0L30 8H20L25 0Z" fill="#FFD166" stroke="#000000" strokeWidth="1"/>
          </G>
        );
    }
  };

  return (
    <View width={size} height={size}>
      <Svg width="100%" height="100%" viewBox="0 0 80 80">
        <AnimatedG style={animatedStyle}>
          {renderSprite()}
        </AnimatedG>
      </Svg>
    </View>
  );
};

// Helper for Circle since we didn't import it
const Circle = ({ cx, cy, r, ...props }: any) => (
  <Path 
    d={`M ${cx-r}, ${cy} a ${r},${r} 0 1,0 ${r*2},0 a ${r},${r} 0 1,0 ${-r*2},0`} 
    {...props} 
  />
);
