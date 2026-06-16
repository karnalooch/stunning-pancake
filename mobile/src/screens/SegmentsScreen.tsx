import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useI18n } from '../i18n/useI18n';
import { OrnateFrame } from '../components/ui/OrnateFrame';
import { PixelText } from '../components/PixelText';

const stylesheet = StyleSheet.create((theme) => {
  const c = theme.colors as Record<string, string>;
  return {
    ct: { flex: 1, backgroundColor: c.background },
    h: { padding: 16, borderBottomWidth: 4, borderBottomColor: c.onBackground },
    t: { fontSize: 18, color: c.primary, textTransform: 'uppercase' },
    cardWrap: { margin: 12, marginBottom: 0 },
    l: { fontSize: 10, color: c.secondary, textTransform: 'uppercase' },
    n: { fontSize: 14, color: c.onBackground, marginTop: 4 },
    m: { fontSize: 14, fontFamily: 'VT323', color: c.primary, marginTop: 4 },
  };
});

export const SegmentsScreen: React.FC = () => {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const s = stylesheet;
  const rows = [
    { l: 'Sprint', n: 'Riverside Dash', d: '1.2 km', g: '0%', kom: 'ShadowRider', time: '01:42' },
    { l: 'Climb', n: 'Lookout Peak', d: '4.5 km', g: '8.5%', kom: 'AeroQueen', time: '14:28' },
    { l: 'Rolling', n: 'Valley Loop', d: '12.0 km', g: '2%', kom: 'Unclaimed', time: '--:--' },
  ];
  return (
    <SafeAreaView style={s.ct} edges={['top']}>
      <View style={s.h}>
        <PixelText style={s.t}>{t.segments.title}</PixelText>
      </View>
      <ScrollView>
        {rows.map((r, i) => (
          <View key={i} style={s.cardWrap}>
            <OrnateFrame padding={12}>
              <PixelText style={s.l}>{r.l}</PixelText>
              <PixelText style={s.n}>{r.n}</PixelText>
              <Text style={s.m}>{r.d} | {r.g} | KOM: {r.kom} {r.time}</Text>
            </OrnateFrame>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};
