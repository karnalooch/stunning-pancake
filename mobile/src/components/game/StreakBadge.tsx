import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { ChromeIcon } from '../ui/ChromeIcon';
import { useI18n } from '../../i18n/useI18n';

interface StreakBadgeProps {
  days: number;
}

export const StreakBadge: React.FC<StreakBadgeProps> = ({ days }) => {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const c = theme.colors as Record<string, string>;

  return (
    <View style={[styles.wrap, { borderColor: c.hudOutline, backgroundColor: c.goldAmber }]}>
      <ChromeIcon id="streak" size={20} />
      <View>
        <Text style={[styles.value, { color: c.onBackground }]} allowFontScaling>
          {days}
        </Text>
        <Text style={[styles.label, { color: c.onBackground }]} allowFontScaling>
          {t.profile.streakLabel}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 48,
  },
  value: { fontSize: 20, fontWeight: '800', lineHeight: 22 },
  label: { fontSize: 8, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
});
