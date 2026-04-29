import React, { useEffect } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import { YStack, Text, H1, View } from 'tamagui';
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
    <YStack flex={1} backgroundColor="#050505" justifyContent="center" alignItems="center">
      {/* Cyberpunk Grid Background Background (Optional/Subtle) */}
      <View position="absolute" opacity={0.05}>
        <Svg width={width} height={height}>
          {Array.from({ length: 20 }).map((_, i) => (
            <Rect key={`h-${i}`} x="0" y={(height / 20) * i} width={width} height="1" fill="#00F0FF" />
          ))}
          {Array.from({ length: 10 }).map((_, i) => (
            <Rect key={`v-${i}`} x={(width / 10) * i} y="0" width="1" height={height} fill="#00F0FF" />
          ))}
        </Svg>
      </View>

      <Animated.View style={[styles.logoContainer, logoStyle]}>
        {/* Logo Icon Mockup using SVG */}
        <Svg width="120" height="120" viewBox="0 0 48 46" fill="none">
          <Path 
            fill="#00F0FF" 
            d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z" 
          />
        </Svg>
        
        {/* Scanning Line Effect */}
        <Animated.View style={[styles.scanLine, scanStyle]} />
      </Animated.View>

      <YStack marginTop="$8" alignItems="center" gap="$2">
        <Animated.View style={textStyle}>
          <Text color="#00F0FF" letterSpacing={4} fontSize={12} fontWeight="900" textAlign="center">
            {message}
          </Text>
        </Animated.View>
        <Text color="#444" fontSize={10} fontWeight="800" letterSpacing={2}>
          {subMessage}
        </Text>
      </YStack>

      {/* Version & Build Tags in Corners */}
      <View position="absolute" top={60} left={30}>
        <Text color="#333" fontSize={10} ff="monospace">SYS_STATUS: ACTIVE</Text>
      </View>
      <View position="absolute" bottom={40} right={30}>
        <Text color="#333" fontSize={10} ff="monospace">LOAD_ADDR: 0x0B0E14</Text>
      </View>
    </YStack>
  );
};

const styles = StyleSheet.create({
  logoContainer: {
    width: 150,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.2)',
    backgroundColor: 'rgba(0, 240, 255, 0.05)',
  },
  scanLine: {
    position: 'absolute',
    width: '120%',
    height: 2,
    backgroundColor: '#00F0FF',
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
  }
});
