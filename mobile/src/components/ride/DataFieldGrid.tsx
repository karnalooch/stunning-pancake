import React, { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useDataFieldLayout } from '../../hooks/useDataFieldLayout';
import { DATA_FIELD_IDS, DATA_FIELD_REGISTRY, fieldHasValue, type DataFieldId } from '../../ride/dataFields';
import { splitLayoutRows } from '../../ride/layouts';
import type { DataFieldLayout, RideMetricsSnapshot, RideProfileId } from '../../ride/types';
import { DataFieldCell } from './DataFieldCell';
import { DraggableFieldCell } from './DraggableFieldCell';
import { trackEngagement } from '../../services/EngagementAnalytics';

interface DataFieldGridProps {
  metrics: RideMetricsSnapshot;
  layout?: DataFieldLayout;
  hudMode?: boolean;
}

const PROFILE_LABELS: Record<RideProfileId, string> = {
  road: 'Road',
  training: 'Training',
  race: 'Race',
};

const stylesheet = StyleSheet.create((theme) => {
  const c = theme.colors as Record<string, string>;
  return {
    wrap: { gap: 8 },
    editBanner: {
      backgroundColor: c.primaryContainer,
      borderWidth: 2,
      borderColor: c.onBackground,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    editBannerText: {
      fontSize: 11,
      fontWeight: '700',
      color: c.onPrimaryContainer,
      textTransform: 'uppercase',
    },
    profileRow: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 6,
    },
    profileChip: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 2,
      borderColor: c.onBackground,
      borderRadius: 4,
      backgroundColor: c.surface,
    },
    profileChipActive: {
      backgroundColor: c.primary,
    },
    profileChipText: {
      fontSize: 10,
      fontWeight: '700',
      color: c.onBackground,
      textTransform: 'uppercase',
    },
    profileChipTextActive: {
      color: c.onPrimary,
    },
    row: {
      flexDirection: 'row',
      gap: 8,
    },
    hint: {
      fontSize: 10,
      color: c.secondary,
      marginTop: 4,
    },
  };
});

export const DataFieldGrid: React.FC<DataFieldGridProps> = ({ metrics, layout: layoutProp, hudMode = false }) => {
  const { theme } = useUnistyles();
  const s = stylesheet;
  const c = theme.colors as Record<string, string>;
  const {
    layout: storedLayout,
    activeProfile,
    setActiveProfile,
    updateSlotField,
    swapSlots,
    resetProfileLayout,
  } = useDataFieldLayout();
  const layout = layoutProp ?? storedLayout;
  const [editMode, setEditMode] = useState(false);

  const { row1, row2 } = splitLayoutRows(layout.slots);

  const pickFieldForSlot = useCallback(
    (slotKey: string, currentFieldId: DataFieldId) => {
      const options = DATA_FIELD_IDS.filter((id) => id !== currentFieldId);
      Alert.alert(
        'Change field',
        DATA_FIELD_REGISTRY[currentFieldId].defaultLabel,
        [
          ...options.slice(0, 8).map((fieldId) => ({
            text: DATA_FIELD_REGISTRY[fieldId].defaultLabel,
            onPress: () => updateSlotField(slotKey, fieldId),
          })),
          { text: 'Cancel', style: 'cancel' },
        ],
        { cancelable: true },
      );
    },
    [updateSlotField],
  );

  const toggleEdit = useCallback(() => {
    setEditMode((v) => {
      if (!v) trackEngagement('layout_edit', { profile: activeProfile });
      return !v;
    });
  }, [activeProfile]);

  const renderRow = (slots: typeof row1) => {
    const visible = hudMode ? slots.filter((slot) => fieldHasValue(slot.fieldId, metrics)) : slots;
    if (visible.length === 0) return null;
    return (
    <View style={s.row}>
      {visible.map((slot, index) => {
        const swapNeighbor = (direction: 'left' | 'right') => {
          const targetIndex = direction === 'left' ? index - 1 : index + 1;
          if (targetIndex < 0 || targetIndex >= visible.length) return;
          const neighbor = visible[targetIndex];
          if (!neighbor) return;
          swapSlots(slot.slotKey, neighbor.slotKey);
        };
        if (editMode) {
          return (
            <DraggableFieldCell
              key={slot.slotKey}
              slotKey={slot.slotKey}
              fieldId={slot.fieldId}
              metrics={metrics}
              emphasis={slot.emphasis}
              editMode={editMode}
              onPressEdit={() => pickFieldForSlot(slot.slotKey, slot.fieldId)}
              onSwapNeighbor={swapNeighbor}
            />
          );
        }
        return (
          <DataFieldCell
            key={slot.slotKey}
            fieldId={slot.fieldId}
            metrics={metrics}
            emphasis={slot.emphasis}
            editMode={false}
            hudMode={hudMode}
            onPressEdit={() => pickFieldForSlot(slot.slotKey, slot.fieldId)}
          />
        );
      })}
    </View>
    );
  };

  return (
    <Pressable
      style={s.wrap}
      onLongPress={toggleEdit}
      delayLongPress={450}
      accessibilityHint="Long press to customize data fields"
    >
      {editMode && (
        <View style={s.editBanner}>
          <Text style={s.editBannerText}>Edit — drag ↔ reorder, tap to swap metric</Text>
          <View style={s.profileRow}>
            {(Object.keys(PROFILE_LABELS) as RideProfileId[]).map((profileId) => {
              const active = activeProfile === profileId;
              return (
                <Pressable
                  key={profileId}
                  style={[s.profileChip, active && s.profileChipActive]}
                  onPress={() => setActiveProfile(profileId)}
                >
                  <Text style={[s.profileChipText, active && s.profileChipTextActive]}>
                    {PROFILE_LABELS[profileId]}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              style={[s.profileChip, { marginLeft: 'auto' }]}
              onPress={() => {
                resetProfileLayout(activeProfile);
                Alert.alert('Reset', `${PROFILE_LABELS[activeProfile as RideProfileId]} layout restored.`);
              }}
            >
              <Text style={s.profileChipText}>Reset</Text>
            </Pressable>
            <Pressable style={s.profileChip} onPress={() => setEditMode(false)}>
              <Text style={[s.profileChipText, { color: c.primary }]}>Done</Text>
            </Pressable>
          </View>
        </View>
      )}
      {renderRow(row1)}
      {renderRow(row2)}
      {!editMode && !hudMode && (
        <Text style={s.hint}>Long-press grid to customize fields</Text>
      )}
    </Pressable>
  );
};
