import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

interface SpeechBubbleProps {
  text: string;
  visible?: boolean;
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({ text, visible = true }) => {
  const { theme } = useUnistyles();
  const c = theme.colors as Record<string, string>;
  if (!visible || !text) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={[styles.bubble, { backgroundColor: c.parchment, borderColor: c.onBackground }]}>
        <Text style={[styles.text, { color: c.onBackground }]}>{text}</Text>
      </View>
      <View style={[styles.tail, { borderTopColor: c.parchment }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    marginBottom: 8,
    maxWidth: '90%',
  },
  bubble: {
    borderWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  tail: {
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
