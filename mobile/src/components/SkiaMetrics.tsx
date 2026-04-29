import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Canvas, Text, matchFont } from '@shopify/react-native-skia';

interface SkiaMetricsProps {
  distanceKm: string;
  pace: string;
  buffer: number;
}

export const SkiaMetrics: React.FC<SkiaMetricsProps> = ({ distanceKm, pace, buffer }) => {
  const systemFontFamily = Platform.select({ ios: 'Helvetica', android: 'Roboto', default: 'sans-serif' });
  
  const fontLarge = matchFont({
    fontFamily: systemFontFamily,
    fontSize: 38,
    fontWeight: 'bold',
  });

  const fontSmall = matchFont({
    fontFamily: systemFontFamily,
    fontSize: 12,
    fontWeight: 'normal',
  });

  return (
    <View style={styles.container}>
      <Canvas style={styles.canvas}>
        {/* Distance */}
        <Text x={10} y={40} text="DISTANCE" font={fontSmall} color="#A0A0A0" />
        <Text x={10} y={85} text={`${distanceKm} km`} font={fontLarge} color="#FFFFFF" />

        {/* Pace */}
        <Text x={150} y={40} text="PACE" font={fontSmall} color="#A0A0A0" />
        <Text x={150} y={85} text={pace} font={fontLarge} color="#FFFFFF" />

        {/* Buffer */}
        <Text x={280} y={40} text="BUFFER" font={fontSmall} color="#A0A0A0" />
        <Text x={280} y={85} text={buffer.toString()} font={fontLarge} color="#00F0FF" />
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 100,
    width: '100%',
    marginVertical: 10,
  },
  canvas: {
    flex: 1,
  },
});
