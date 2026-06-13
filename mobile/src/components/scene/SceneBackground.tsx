import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { getScene, type SceneId } from '../../theme/scenes';
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

  return (
    <View style={styles.root}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: c.sceneSky }]} />
      {scene.layers.includes('hills') && (
        <ParallaxLayer color={c.sceneHill} heightPercent={28} bottom={12} opacity={0.9} />
      )}
      {scene.layers.includes('town') && (
        <ParallaxLayer color={c.primaryContainer} heightPercent={18} bottom={8} opacity={0.75} />
      )}
      {scene.layers.includes('road') && (
        <ParallaxLayer color={c.sceneRoad} heightPercent={10} bottom={0} opacity={1} />
      )}
      <AmbientLayer variant={scene.ambient} />
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
