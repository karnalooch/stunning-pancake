import React, { useMemo, memo } from 'react';
import { useTheme } from 'tamagui';
import { Canvas, Rect, Group, Text, matchFont } from '@shopify/react-native-skia';
import { Platform, View } from 'react-native';
import { observer } from '@legendapp/state/react';
import { useIsFocused } from '@react-navigation/native';

interface PixelStatsProps {
  data?: any; // Can be number[] or Legend-State observable
  height?: number;
  width?: number;
  label?: string;
}

/**
 * PixelStats: A high-performance 8-bit style bar chart for sport metrics.
 * Built with React Native Skia for stable 60 FPS rendering.
 * Optimized with React.memo and Legend-State for minimal re-renders.
 */
export const PixelStats: React.FC<PixelStatsProps> = memo(observer(({ 
  data = [45, 82, 55, 95, 70, 40, 65], 
  height = 130, 
  width = 280,
  label = "PILOT_PERFORMANCE"
}) => {
  const theme = useTheme();
  const isFocused = useIsFocused();
  
  // Resolve data if it's an observable
  const resolvedData = typeof data?.get === 'function' ? data.get() : data;
  const dataPoints = Array.isArray(resolvedData) ? resolvedData : [];

  // Colors from design_tokens.json
  const octopathGold = "#D4A373";
  const matrixCyan = "#2EC4B6";
  
  // Adaptive colors based on theme
  const primaryColor = theme.primary?.get() || octopathGold;
  const accentColor = theme.accent?.get() || matrixCyan;
  const textColor = theme.color?.get() || "#FFFFFF";
  const outlineColor = "#000000";

  const padding = 12;
  const chartHeight = height - 45;
  const chartWidth = width - 2 * padding;
  const barGap = 6;
  const barWidth = (chartWidth - (dataPoints.length - 1) * barGap) / dataPoints.length;
  const maxVal = Math.max(...dataPoints, 1);

  // Fallback to monospace for retro feel if Press Start 2P is unavailable in Skia
  const systemFontFamily = Platform.select({ 
    ios: 'Courier', 
    android: 'monospace', 
    default: 'serif' 
  });
  
  const font = useMemo(() => matchFont({
    fontFamily: systemFontFamily,
    fontSize: 10,
    fontWeight: 'bold',
  }), [systemFontFamily]);

  // Battery Optimization: Only render Canvas when screen is active
  if (!isFocused) {
    return <View style={{ height, width, marginVertical: 10 }} />;
  }

  return (
    <View style={{ height, width, marginVertical: 10 }}>
      <Canvas style={{ flex: 1 }}>
        {/* Label - Matrix Style */}
        <Text x={padding} y={15} text={label} font={font} color={accentColor} />

        {/* Bars with Pixel-UI Aesthetic */}
        <Group>
          {dataPoints.map((val, index) => {
            const barHeight = (val / maxVal) * chartHeight;
            const x = padding + index * (barWidth + barGap);
            const y = height - barHeight - 20;
            
            return (
              <Group key={index}>
                {/* Bar Fill */}
                <Rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  color={index % 2 === 0 ? primaryColor : accentColor}
                />
                {/* 1px Black Outline for each bar (HD2D requirement) */}
                <Rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  color={outlineColor}
                  style="stroke"
                  strokeWidth={1}
                />
                {/* Small "Shadow" on each bar for depth */}
                <Rect
                  x={x + barWidth - 2}
                  y={y}
                  width={2}
                  height={barHeight}
                  color={outlineColor}
                  opacity={0.15}
                />
              </Group>
            );
          })}
        </Group>
        
        {/* X-Axis Baseline (Sprite-style) */}
        <Rect 
          x={padding} 
          y={height - 20} 
          width={chartWidth} 
          height={2} 
          color={outlineColor} 
        />
        
        {/* Footer Info */}
        <Text 
          x={padding} 
          y={height - 5} 
          text={`BATT_LEVEL: 100% | STATUS: OPTIMAL`} 
          font={font} 
          color={textColor} 
          opacity={0.5}
        />
      </Canvas>
    </View>
  );
}));

