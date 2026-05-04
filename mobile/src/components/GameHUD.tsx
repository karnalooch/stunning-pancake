import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { observer } from '@legendapp/state/react';
import { PixelText } from './PixelText';

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

export const formatTime = (sec: number) => {
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
      <PixelText size="xl" color="primary" shadow style={{ fontSize: 20, color: '#D4A373' }}>
        {value}
      </PixelText>
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
          <View
            style={[
              styles.hudRow,
              styles.hudBox,
              { backgroundColor: 'rgba(11, 29, 51, 0.9)', borderColor: '#D4A373' },
            ]}
          >
            <View style={[styles.hudColumn, { minWidth: 70, alignItems: 'center' }]}>
              <View style={styles.hudRow}>{digits.map((d, i) => (d === '.' ? <PixelText key={i} size="lg" color="primary" style={{ fontSize: 16, color: '#D4A373' }}>.</PixelText> : <ScrollingDigit key={i} value={d} />))}</View>
              <PixelText size="xs" color="primary" style={{ fontSize: 7, color: '#D4A373', opacity: 0.7, marginTop: 4 }}>KM</PixelText>
            </View>

            <View style={[styles.hudColumn, { borderLeftWidth: 2, borderColor: '#D4A373', paddingLeft: 12 }]}>
              <PixelText size="sm" color="success" style={{ fontSize: 10 }}>{paceFormatted}</PixelText>
              <PixelText size="xs" color="success" style={{ fontSize: 7, opacity: 0.7, marginTop: 2 }}>PACE /KM</PixelText>
              <View style={[styles.hudRow, { marginTop: 8, gap: 12 }]}>
                <View>
                  <PixelText size="sm" color="text" shadow style={{ fontSize: 10, color: '#FFFFFF' }}>{speedKmh.toFixed(1)}</PixelText>
                  <PixelText size="xs" color="text" style={{ fontSize: 6, color: '#FFFFFF', opacity: 0.5, marginTop: 2 }}>KM/H</PixelText>
                </View>
                <View>
                  <PixelText size="sm" color="error" shadow style={{ fontSize: 10 }}>{heartRate}</PixelText>
                  <PixelText size="xs" color="error" style={{ fontSize: 6, opacity: 0.5, marginTop: 2 }}>BPM</PixelText>
                </View>
              </View>
            </View>

            <View style={[styles.hudColumn, { borderLeftWidth: 2, borderColor: '#D4A373', paddingLeft: 12 }]}>
              <PixelText size="md" color="text" shadow style={{ fontSize: 12, color: '#FFFFFF' }}>{formatTime(elapsedSec)}</PixelText>
              <PixelText size="xs" color="text" style={{ fontSize: 6, color: '#FFFFFF', opacity: 0.5, marginTop: 4 }}>ELAPSED</PixelText>
            </View>
          </View>
        </Animated.View>
      </Pressable>
    );
  },
);

const styles = StyleSheet.create({
  tapArea: {
    position: 'absolute',
    bottom: 90, // Above the Start Mission button
    left: 20,
    right: 20,
    zIndex: 100,
  },
  hudContainer: {},
  hudRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hudColumn: {
    flexDirection: 'column',
  },
  hudBox: {
    borderWidth: 3,
    padding: 12,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
});
