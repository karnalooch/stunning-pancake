import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export type PlatformNotice = {
  id: number;
  severity: 'info' | 'warning' | 'critical';
  title_pl: string;
  title_en: string;
  body_pl: string;
  body_en: string;
  dismissible: boolean;
};

interface PlatformNoticeBannerProps {
  notice: PlatformNotice | null;
  locale?: 'pl' | 'en';
  onDismiss?: (id: number) => void;
}

const stylesheet = StyleSheet.create((theme) => {
  const C = theme.colors as Record<string, string>;
  return {
    banner: {
      backgroundColor: C.tertiaryContainer ?? C.primaryContainer,
      borderWidth: 3,
      borderColor: C.onBackground,
      borderRadius: 6,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 12,
    },
    title: {
      fontSize: 14,
      fontWeight: '800',
      color: C.onBackground,
      marginBottom: 4,
    },
    body: {
      fontSize: 12,
      fontWeight: '600',
      color: C.onBackground,
      lineHeight: 18,
    },
    dismiss: {
      marginTop: 8,
      alignSelf: 'flex-end',
    },
    dismissText: {
      fontSize: 11,
      fontWeight: '700',
      color: C.primary,
      textTransform: 'uppercase',
    },
  };
});

export const PlatformNoticeBanner: React.FC<PlatformNoticeBannerProps> = ({
  notice,
  locale = 'pl',
  onDismiss,
}) => {
  const s = stylesheet;
  if (!notice) return null;

  const title = locale === 'pl' ? notice.title_pl : notice.title_en;
  const body = locale === 'pl' ? notice.body_pl : notice.body_en;

  return (
    <View style={s.banner} accessibilityRole="alert">
      <Text style={s.title}>{title}</Text>
      <Text style={s.body}>{body}</Text>
      {notice.dismissible && onDismiss ? (
        <Pressable style={s.dismiss} onPress={() => onDismiss(notice.id)}>
          <Text style={s.dismissText}>{locale === 'pl' ? 'Zamknij' : 'Dismiss'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};
