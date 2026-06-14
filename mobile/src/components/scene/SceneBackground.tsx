import React from 'react';
import { View, StyleSheet } from 'react-native';
import { getScene, LAYER_LAYOUT, type SceneId } from '../../theme/scenes';
import { useMotionPolicy } from '../../hooks/useMotionPolicy';
import { useMotionDegradeMonitor } from '../../hooks/useMotionDegrade';
import { AmbientLayer, ImageParallaxLayer, Scrim } from './SceneLayers';

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
  const scene = getScene(sceneId);
  const { allowParallax } = useMotionPolicy();
  const degraded = useMotionDegradeMonitor(false);
  const showParallax = allowParallax && !degraded;

  return (
    <View style={styles.root}>
      {scene.layers.map((layerId) => {
        const layout = LAYER_LAYOUT[layerId];
        return (
          <ImageParallaxLayer
            key={layerId}
            layerId={layerId}
            heightPercent={layout.heightPercent}
            bottom={layout.bottom}
            parallaxSpeed={layout.parallaxSpeed}
            enabled={showParallax}
          />
        );
      })}
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
