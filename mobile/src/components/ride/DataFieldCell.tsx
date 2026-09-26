import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
  DATA_FIELD_REGISTRY,
  resolveFieldValue,
  type DataFieldId,
} from '../../ride/dataFields';
import type { FieldEmphasis, RideMetricsSnapshot } from '../../ride/types';
import { useI18n } from '../../i18n/useI18n';
import { getSemanticColors } from '../../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../../theme/typography';

interface DataFieldCellProps {
  fieldId: DataFieldId;
  metrics: RideMetricsSnapshot;
  emphasis?: FieldEmphasis;
  editMode?: boolean;
  onPressEdit?: () => void;
  /** Sun-readable HUD chrome (Active Ride focus zone). */
  hudMode?: boolean;
}

const stylesheet = StyleSheet.create((theme) => {
  const c = theme.colors as Record<string, string>;
  const semantic = getSemanticColors(theme.colors);
  return {
    cell: {
      backgroundColor: semantic.surface.default,
      borderWidth: 1,
      borderColor: semantic.border.subtle,
      borderRadius: 14,
      padding: 12,
    },
    cellHud: {
      backgroundColor: c.hudPanel,
      borderColor: c.hudOutline,
      borderWidth: 1,
      borderRadius: 14,
    },
    cellHero: {
      paddingVertical: 14,
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
      ...PRODUCT_TYPOGRAPHY.metricLabel,
      color: semantic.text.secondary,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    labelHud: {
      color: c.hudOutline,
    },
    value: {
      ...PRODUCT_TYPOGRAPHY.metric,
      color: semantic.text.primary,
      marginTop: 2,
    },
    valueHud: {
      color: c.hudOutline,
    },
    valueHero: {
      fontSize: 48,
      lineHeight: 54,
      marginTop: 4,
    },
    unit: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.text.secondary,
    },
    unitHud: {
      color: c.hudOutline,
    },
    unitHero: {
      fontSize: 16,
      lineHeight: 20,
    },
  };
});

/** Bike-computer data field with optional sun-readable HUD chrome (ADR 014 §3). */
export const HudDataFieldCell: React.FC<Omit<DataFieldCellProps, 'hudMode'>> = (props) => (
  <DataFieldCell {...props} hudMode />
);

export const DataFieldCell: React.FC<DataFieldCellProps> = ({
  fieldId,
  metrics,
  emphasis = 'normal',
  editMode = false,
  onPressEdit,
  hudMode = false,
}) => {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const s = stylesheet;
  const c = theme.colors as Record<string, string>;
  const def = DATA_FIELD_REGISTRY[fieldId];
  const raw = resolveFieldValue(fieldId, metrics);
  const display = def.format(raw);
  const isHero = emphasis === 'hero';
  const label = t.ride.fields[fieldId] ?? def.defaultLabel;
  const hrZoneColor =
    fieldId === 'hr' && typeof raw === 'number'
      ? raw < 120
        ? c.zone1
        : raw < 150
          ? c.zone2
          : raw < 170
            ? c.zone3
            : raw < 190
              ? c.zone4
              : c.zone5
      : undefined;

  const cellBody = (
    <>
      <Text style={[s.label, hudMode && s.labelHud]} allowFontScaling>{label}</Text>
      <Text
        allowFontScaling
        style={[
          s.value,
          hudMode && s.valueHud,
          isHero && s.valueHero,
          fieldId === 'hr' && !hudMode && { color: hrZoneColor ?? c.tertiary },
        ]}
      >
        {display}
        {def.unit && display !== '—' ? (
          <Text style={[s.unit, hudMode && s.unitHud, isHero && s.unitHero]}> {def.unit}</Text>
        ) : null}
      </Text>
    </>
  );

  return (
    <Pressable
      style={[
        s.cell,
        hudMode && s.cellHud,
        isHero ? s.cellHero : s.cellNormal,
        editMode && s.cellEdit,
      ]}
      disabled={!editMode}
      onPress={onPressEdit}
      accessibilityRole={editMode ? 'button' : 'text'}
      accessibilityLabel={`${label} ${display}`}
    >
      {cellBody}
    </Pressable>
  );
};
