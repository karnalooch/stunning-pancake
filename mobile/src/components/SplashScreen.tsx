import React, { useEffect } from 'react';
import { StyleSheet, Dimensions, View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  interpolate
} from 'react-native-reanimated';
import { Svg, Path, Rect } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  message?: string;
  subMessage?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  message = "INITIALIZING SPORT CORE...",
  subMessage = "NEO-RETRO ATHLETICISM V3.0"
}) => {
  const logoScale = useSharedValue(0.9);
  const logoOpacity = useSharedValue(0);
  const scanPos = useSharedValue(-50);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    logoScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.95, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    logoOpacity.value = withTiming(1, { duration: 800 });

    scanPos.value = withRepeat(
      withTiming(150, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );

    textOpacity.value = withDelay(500, withRepeat(
      withSequence(
        withTiming(1, { duration: 100 }),
        withTiming(0.4, { duration: 100 }),
        withTiming(1, { duration: 100 })
      ),
      -1,
      true
    ));
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanPos.value }],
    opacity: interpolate(scanPos.value, [-50, 50, 150], [0, 1, 0]),
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  return (
    <View style={styles.root}>
      {/* Cyberpunk Grid Background */}
      <View style={styles.gridOverlay}>
        <Svg width={width} height={height}>
          {Array.from({ length: 20 }).map((_, i) => (
            <Rect key={`h-${i}`} x="0" y={(height / 20) * i} width={width} height="1" fill="#1A2A3A" />
          ))}
          {Array.from({ length: 10 }).map((_, i) => (
            <Rect key={`v-${i}`} x={(width / 10) * i} y="0" width="1" height={height} fill="#1A2A3A" />
          ))}
        </Svg>
      </View>

      <Animated.View style={[styles.logoContainer, logoStyle]}>
        {/* HD-2D Shield Logo Icon */}
        <Svg width="120" height="120" viewBox="0 0 100 100">
          <Path d="M20 10H80V20H90V60H80V70H70V80H60V90H40V80H30V70H20V60H10V20H20V10Z" fill="#D4A373" stroke="#000000" strokeWidth="2" />
          <Path d="M30 20H70V30H80V50H70V60H60V70H40V60H30V50H20V30H30V20Z" fill="#FF6B35" stroke="#000000" strokeWidth="1" />
          <Rect x="45" y="35" width="10" height="10" fill="#FFFFFF" stroke="#000000" strokeWidth="1" />
        </Svg>

        {/* Scanning Line Effect */}
        <Animated.View style={[styles.scanLine, scanStyle]} />
      </Animated.View>

      <View style={styles.centerSection}>
        {/* SPRITE REMOVED TO ADAPT TO NEW THEME */}
        <View style={styles.messageBlock}>
          <Animated.View style={textStyle}>
            <Text style={styles.messageText}>
              {message}
            </Text>
          </Animated.View>
          <Text style={styles.subMessageText}>
            {subMessage}
          </Text>
        </View>
      </View>

      {/* Version & Build Tags in Corners */}
      <View style={styles.topLeftTag}>
        <Text style={styles.tagText}>SYS_STATUS: ACTIVE</Text>
      </View>
      <View style={styles.bottomRightTag}>
        <Text style={styles.tagText}>LOAD_ADDR: 0x0B0E14</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B1D33',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridOverlay: {
    position: 'absolute',
    opacity: 0.05,
  },
  logoContainer: {
    width: 150,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.2)',
    backgroundColor: 'rgba(255, 107, 53, 0.05)',
  },
  scanLine: {
    position: 'absolute',
    width: '120%',
    height: 2,
    backgroundColor: '#FF6B35',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
  },
  centerSection: {
    marginTop: 40,
    alignItems: 'center',
    gap: 16,
  },
  messageBlock: {
    alignItems: 'center',
    gap: 8,
  },
  messageText: {
    color: '#D4A373',
    letterSpacing: 4,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
    fontFamily: 'PressStart2P',
  },
  subMessageText: {
    color: '#F5E6CC',
    opacity: 0.4,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    fontFamily: 'PressStart2P',
  },
  topLeftTag: {
    position: 'absolute',
    top: 60,
    left: 30,
  },
  bottomRightTag: {
    position: 'absolute',
    bottom: 40,
    right: 30,
  },
  tagText: {
    color: '#333',
    fontSize: 10,
    fontFamily: 'monospace',
  },
});
