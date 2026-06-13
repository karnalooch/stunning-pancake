import React from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { DataFieldId } from '../../ride/dataFields';
import type { RideMetricsSnapshot } from '../../ride/types';
import { DataFieldCell } from './DataFieldCell';

interface DraggableFieldCellProps {
  slotKey: string;
  fieldId: DataFieldId;
  metrics: RideMetricsSnapshot;
  emphasis?: 'normal' | 'hero';
  editMode: boolean;
  onPressEdit: () => void;
  onSwapNeighbor: (direction: 'left' | 'right') => void;
}

const SWAP_THRESHOLD = 48;

export const DraggableFieldCell: React.FC<DraggableFieldCellProps> = ({
  slotKey,
  fieldId,
  metrics,
  emphasis,
  editMode,
  onPressEdit,
  onSwapNeighbor,
}) => {
  const translateX = useSharedValue(0);

  const pan = Gesture.Pan()
    .enabled(editMode)
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      if (e.translationX > SWAP_THRESHOLD) {
        runOnJS(onSwapNeighbor)('right');
      } else if (e.translationX < -SWAP_THRESHOLD) {
        runOnJS(onSwapNeighbor)('left');
      }
      translateX.value = withSpring(0);
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    zIndex: editMode ? 1 : 0,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.cell, style]} key={slotKey}>
        <DataFieldCell
          fieldId={fieldId}
          metrics={metrics}
          emphasis={emphasis}
          editMode={editMode}
          onPressEdit={onPressEdit}
        />
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  cell: { flex: 1 },
});
