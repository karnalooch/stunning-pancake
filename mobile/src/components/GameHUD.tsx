import React, { useEffect, useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { YStack, XStack, Text as TamaText } from 'tamagui';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { observer } from '@legendapp/state/react';

interface GameHUDProps {
  visible: boolean;
  onTap: () => void;
  distanceKm: number;
  paceFormatted: string;
  speedKmh: number;
  heartRate: number;
  isTracking: boolean;
  elapsedSec: number;
}

const formatTime = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const ScrollingDigit = ({ value }: { value: string }) => {
  const offset = useSharedValue(0);
  const prevValue = useSharedValue(value);

  useEffect(() => {
    if (value !== prevValue.value) {
      offset.value = withSequence(
        withTiming(-8, { duration: 50 }),
        withTiming(4, { duration: 50 }),
        withTiming(0, { duration: 100 }),
      );
      prevValue.value = value;
    }
  }, [value]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <TamaText fontFamily="$pixel" fontSize={20} color="#D4A373" fontWeight="900">
        {value}
      </TamaText>
    </Animated.View>
  );
};

export const GameHUD = observer(
  ({
    visible,
    onTap,
    distanceKm,
    paceFormatted,
    speedKmh,
    heartRate,
    isTracking,
    elapsedSec,
  }: GameHUDProps) => {
    const opacity = useSharedValue(1);
    const scale = useSharedValue(1);

    useEffect(() => {
      if (visible) {
        opacity.value = withSpring(1, { damping: 14, stiffness: 100 });
        scale.value = withSpring(1, { damping: 14, stiffness: 100 });
      } else {
        opacity.value = withTiming(0.3, { duration: 400 });
        scale.value = withTiming(0.95, { duration: 300 });
      }
    }, [visible]);

    const hudStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
    }));

    const distanceString = distanceKm.toFixed(1);
    const digits = distanceString.split('');

    return (
      <Pressable onPress={onTap} style={styles.tapArea}>
        <Animated.View style={[styles.hudContainer, hudStyle]}>
          <XStack
            backgroundColor="rgba(0,0,0,0.75)"
            borderWidth={2}
            borderColor="#D4A373"
            padding="$3"
            gap="$4"
            alignItems="center"
            style={styles.hudBox}
          >
            <YStack alignItems="center" minWidth={70}>
              <XStack gap={0}>{digits.map((d, i) => (d === '.' ? <TamaText key={i} fontFamily="$pixel" fontSize={16} color="#D4A373">.</TamaText> : <ScrollingDigit key={i} value={d} />))}</XStack>
              <TamaText fontFamily="$pixel" fontSize={7} color="#D4A373" opacity={0.7}>KM</TamaText>
            </YStack>

            <YStack borderLeftWidth={1} borderColor="#D4A373" paddingLeft="$3">
              <TamaText fontFamily="$pixel" fontSize={10} color="#7BA05B">{paceFormatted}</TamaText>
              <TamaText fontFamily="$pixel" fontSize={7} color="#7BA05B" opacity={0.7}>PACE /KM</TamaText>
              <XStack gap="$3" marginTop="$2">
                <YStack>
                  <TamaText fontFamily="$pixel" fontSize={10} color="#FFFFFF">{speedKmh.toFixed(1)}</TamaText>
                  <TamaText fontFamily="$pixel" fontSize={6} color="#FFFFFF" opacity={0.5}>KM/H</TamaText>
                </YStack>
                <YStack>
                  <TamaText fontFamily="$pixel" fontSize={10} color="#EF4444">{heartRate}</TamaText>
                  <TamaText fontFamily="$pixel" fontSize={6} color="#EF4444" opacity={0.5}>BPM</TamaText>
                </YStack>
              </XStack>
            </YStack>

            <YStack borderLeftWidth={1} borderColor="#D4A373" paddingLeft="$3">
              <TamaText fontFamily="$pixel" fontSize={12} color="#FFFFFF">{formatTime(elapsedSec)}</TamaText>
              <TamaText fontFamily="$pixel" fontSize={6} color="#FFFFFF" opacity={0.5}>ELAPSED</TamaText>
            </YStack>
          </XStack>
        </Animated.View>
      </Pressable>
    );
  },
);

const styles = StyleSheet.create({
  tapArea: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    zIndex: 100,
  },
  hudContainer: {},
  hudBox: {
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
});
