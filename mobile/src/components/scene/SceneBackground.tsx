import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { getScene, type SceneId } from '../../theme/scenes';
import { useMotionPolicy } from '../../hooks/useMotionPolicy';
import { useMotionDegradeMonitor } from '../../hooks/useMotionDegrade';
import { AmbientLayer, ParallaxLayer, Scrim } from './SceneLayers';

interface SceneBackgroundProps {
  sceneId: SceneId;
  scrim?: 'none' | 'soft' | 'strong';
  children?: React.ReactNode;
}

export const SceneBackground: React.FC<SceneBackgroundProps> = ({
  sceneId,
  scrim = 'soft',
  children,
}) => {
  const { theme } = useUnistyles();
  const c = theme.colors as Record<string, string>;
  const scene = getScene(sceneId);
  const { allowParallax } = useMotionPolicy();
  const degraded = useMotionDegradeMonitor(false);
  const showParallax = allowParallax && !degraded;

  return (
    <View style={styles.root}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: c.sceneSky }]} />
      {showParallax && scene.layers.includes('hills') && (
        <ParallaxLayer color={c.sceneHill} heightPercent={28} bottom={12} opacity={0.9} />
      )}
      {showParallax && scene.layers.includes('town') && (
        <ParallaxLayer color={c.primaryContainer} heightPercent={18} bottom={8} opacity={0.75} />
      )}
      {showParallax && scene.layers.includes('road') && (
        <ParallaxLayer color={c.sceneRoad} heightPercent={10} bottom={0} opacity={1} />
      )}
      <AmbientLayer variant={showParallax ? scene.ambient : 'day'} />
      {scrim !== 'none' && <Scrim strength={scrim} />}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});
