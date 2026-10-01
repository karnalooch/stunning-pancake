import React from 'react';
import { Pressable, ScrollView, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { getSemanticColors } from '../../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../../theme/typography';

/** Shared geometry, not a theme-specific screen tree. Theme changes never replace children. */
export function RoadbookPage({ title, subtitle, children, footer, embedded = false, testID, sampleLabel }: {
  title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode;
  embedded?: boolean; testID?: string; sampleLabel?: string;
}) {
  return <SafeAreaView style={styles.page} edges={embedded ? ['bottom'] : ['top', 'bottom']} testID={testID}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.eyebrow}>{title}</Text>
        {subtitle ? <Text style={styles.editorial}>{subtitle}</Text> : null}
        {sampleLabel ? <Text style={styles.caption} testID="roadbook-sample-data">{sampleLabel}</Text> : null}
      </View>
      {children}
    </ScrollView>
    {footer ? <View style={styles.footer}>{footer}</View> : null}
  </SafeAreaView>;
}

export function RoadbookSection({ title, children, testID, style }: {
  title?: string; children: React.ReactNode; testID?: string; style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.section, style]} testID={testID}>
    {title ? <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text> : null}
    {children}
  </View>;
}

export function RoadbookRow({ label, detail, onPress, testID, destructive = false, disabled = false }: {
  label: string; detail?: string; onPress?: () => void; testID?: string; destructive?: boolean; disabled?: boolean;
}) {
  const content = <>
    <View style={styles.rowCopy}><Text style={[styles.rowLabel, destructive && styles.error]}>{label}</Text>
      {detail ? <Text style={styles.caption}>{detail}</Text> : null}</View>
    {onPress ? <Text accessible={false} style={styles.arrow}>›</Text> : null}
  </>;
  return onPress ? <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.row, pressed && styles.pressed]}>{content}</Pressable>
    : <View style={styles.row} testID={testID}>{content}</View>;
}

export function RoadbookNotice({ title, message, testID, error = false, action }: {
  title: string; message?: string; testID?: string; error?: boolean; action?: React.ReactNode;
}) {
  return <View testID={testID} style={styles.notice} accessibilityLiveRegion="polite">
    <Text style={[styles.rowLabel, error && styles.error]}>{title}</Text>
    {message ? <Text style={styles.body}>{message}</Text> : null}{action}
  </View>;
}

export const roadbookStyles = StyleSheet.create((theme) => {
  const c = getSemanticColors(theme.colors);
  return {
    hero: { gap: 18, paddingVertical: 16 },
    display: { ...PRODUCT_TYPOGRAPHY.displayEditorial, fontSize: 40, lineHeight: 46, color: c.text.primary },
    body: { ...PRODUCT_TYPOGRAPHY.body, lineHeight: 25, color: c.text.secondary },
    caption: { ...PRODUCT_TYPOGRAPHY.metricLabel, color: c.text.secondary },
    metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
    metric: { flexGrow: 1, flexBasis: 110, gap: 4 },
    value: { ...PRODUCT_TYPOGRAPHY.title, fontSize: 28, lineHeight: 36, color: c.text.primary, fontVariant: ['tabular-nums'] },
    stack: { gap: 16 },
  };
});
const styles = StyleSheet.create((theme) => {
  const c = getSemanticColors(theme.colors);
  return {
    page: { flex: 1, backgroundColor: c.canvas.background }, scroll: { flex: 1 },
    pageContent: { padding: 24, paddingBottom: 32, gap: 28 },
    heading: { gap: 8, paddingTop: 8 },
    eyebrow: { ...PRODUCT_TYPOGRAPHY.bodyMedium, color: c.text.secondary },
    editorial: { ...PRODUCT_TYPOGRAPHY.displayEditorial, fontSize: 34, lineHeight: 42, color: c.text.primary },
    section: { borderTopWidth: 1, borderColor: c.border.subtle, paddingTop: 20, gap: 16 },
    sectionTitle: { ...PRODUCT_TYPOGRAPHY.title, fontSize: 20, lineHeight: 28, color: c.text.primary },
    row: { minHeight: 64, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 16,
      borderBottomWidth: 1, borderColor: c.border.subtle },
    rowCopy: { flex: 1, gap: 4 }, rowLabel: { ...PRODUCT_TYPOGRAPHY.bodyMedium, color: c.text.primary },
    arrow: { ...PRODUCT_TYPOGRAPHY.title, color: c.text.secondary },
    caption: { ...PRODUCT_TYPOGRAPHY.metricLabel, color: c.text.secondary },
    body: { ...PRODUCT_TYPOGRAPHY.body, color: c.text.secondary },
    pressed: { backgroundColor: c.surface.raised }, error: { color: c.status.error },
    notice: { padding: 16, gap: 10, borderLeftWidth: 3, borderColor: c.border.strong, backgroundColor: c.surface.raised },
    footer: { padding: 20, gap: 12, borderTopWidth: 1, borderColor: c.border.subtle, backgroundColor: c.surface.default },
  };
});
