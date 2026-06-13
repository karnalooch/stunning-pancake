/**
 * Splash / deploy gate — ADR 014 engagement intro (Solar + pixel-art).
 * Shown while fonts load, auth resolves, or EAS Update downloads.
 */
import React, { useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useUnistyles } from 'react-native-unistyles';
import { SceneBackground } from './scene/SceneBackground';
import { CyclistSprite } from './sprites/CyclistSprite';
import { useMotionPolicy } from '../hooks/useMotionPolicy';

export type SplashMode = 'boot' | 'deploy';

interface SplashScreenProps {
  mode?: SplashMode;
  message?: string;
  subMessage?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  mode = 'boot',
  message,
  subMessage,
}) => {
  const { theme } = useUnistyles();
  const c = theme.colors as Record<string, string>;
  const { allowSpriteAnim } = useMotionPolicy();
  const pulse = useSharedValue(1);

  const title =
    message ??
    (mode === 'deploy' ? 'POBIERANIE AKTUALIZACJI…' : '4VELO · CYKLO-QUEST');
  const subtitle =
    subMessage ??
    (mode === 'deploy' ? 'EAS Update · bezpieczny deploy OTA' : 'Immersyjny komputer rowerowy');

  useEffect(() => {
    if (!allowSpriteAnim) return;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [allowSpriteAnim, pulse]);

  const heroStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <SceneBackground sceneId="ride_dashboard" scrim="soft" />
      <View style={styles.content}>
        <Animated.View style={heroStyle}>
          <CyclistSprite size={88} state={mode === 'deploy' ? 'idle' : 'cruise'} />
        </Animated.View>
        <Text style={[styles.title, { color: c.primary }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: c.secondary }]}>{subtitle}</Text>
        {mode === 'deploy' && (
          <View style={[styles.deployBadge, { borderColor: c.onBackground, backgroundColor: c.goldAmber }]}>
            <Text style={[styles.deployText, { color: c.onBackground }]}>DEPLOY IN PROGRESS</Text>
          </View>
        )}
      </View>
      <Text style={[styles.footer, { color: c.outline }]}>4VELO · v1.0 · Siedlce GP</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: 'relative',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  deployBadge: {
    marginTop: 8,
    borderWidth: 3,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  deployText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    fontSize: 10,
    fontWeight: '600',
  },
});
