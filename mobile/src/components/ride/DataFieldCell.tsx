import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
  DATA_FIELD_REGISTRY,
  resolveFieldValue,
  type DataFieldId,
} from '../../ride/dataFields';
import type { FieldEmphasis, RideMetricsSnapshot } from '../../ride/types';

interface DataFieldCellProps {
  fieldId: DataFieldId;
  metrics: RideMetricsSnapshot;
  emphasis?: FieldEmphasis;
  editMode?: boolean;
  onPressEdit?: () => void;
}

const stylesheet = StyleSheet.create((theme) => {
  const c = theme.colors as Record<string, string>;
  const sh = {
    shadowColor: c.onBackground,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  };
  return {
    cell: {
      backgroundColor: c.parchment,
      borderWidth: 4,
      borderColor: c.onBackground,
      borderRadius: 8,
      padding: 12,
      ...sh,
    },
    cellHero: {
      paddingVertical: 16,
      flex: 1.6,
    },
    cellNormal: {
      flex: 1,
    },
    cellEdit: {
      borderColor: c.primary,
      borderStyle: 'dashed' as const,
    },
    label: {
      fontSize: 10,
      fontWeight: '700',
      color: c.secondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    value: {
      fontSize: 22,
      fontWeight: '700',
      color: c.onBackground,
      marginTop: 4,
    },
    valueHero: {
      fontSize: 40,
      marginTop: 6,
    },
    unit: {
      fontSize: 12,
      fontWeight: '500',
      color: c.outline,
    },
    unitHero: {
      fontSize: 16,
    },
  };
});

export const DataFieldCell: React.FC<DataFieldCellProps> = ({
  fieldId,
  metrics,
  emphasis = 'normal',
  editMode = false,
  onPressEdit,
}) => {
  const { theme } = useUnistyles();
  const s = stylesheet;
  const c = theme.colors as Record<string, string>;
  const def = DATA_FIELD_REGISTRY[fieldId];
  const raw = resolveFieldValue(fieldId, metrics);
  const display = def.format(raw);
  const isHero = emphasis === 'hero';

  return (
    <Pressable
      style={[
        s.cell,
        isHero ? s.cellHero : s.cellNormal,
        editMode && s.cellEdit,
      ]}
      disabled={!editMode}
      onPress={onPressEdit}
      accessibilityRole={editMode ? 'button' : 'text'}
      accessibilityLabel={`${def.defaultLabel} ${display}`}
    >
      <Text style={s.label}>{def.defaultLabel}</Text>
      <Text style={[s.value, isHero && s.valueHero, fieldId === 'hr' && { color: c.tertiary }]}>
        {display}
        {def.unit && display !== '—' ? (
          <Text style={[s.unit, isHero && s.unitHero]}> {def.unit}</Text>
        ) : null}
      </Text>
    </Pressable>
  );
};
