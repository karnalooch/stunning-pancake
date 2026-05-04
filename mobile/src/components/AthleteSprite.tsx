import React, { useEffect } from 'react';
import { Image, View } from 'react-native';
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
}

const spriteMaps = {
  runner: require('../../assets/generated/runner_sprite.png'),
  cyclist: require('../../assets/generated/cyclist_sprite.png'),
  ghost: require('../../assets/generated/ghost_sprite.png'),
  elite: require('../../assets/generated/runner_sprite.png'), // Fallback to runner for now
};

export const AthleteSprite: React.FC<AthleteSpriteProps> = ({
  type,
  state,
  size = 60
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

  return (
    <Animated.View style={[{ width: size, height: size }, animatedStyle]}>
      <Image
        source={spriteMaps[type]}
        style={{ width: '100%', height: '100%' }}
        resizeMode="contain"
      />
    </Animated.View>
  );
};
