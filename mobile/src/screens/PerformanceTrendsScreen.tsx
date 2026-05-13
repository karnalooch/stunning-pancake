// STITCH Phase 2 — PerformanceTrendsScreen
import React from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { stitchTheme } from "../theme/stitch";
const stylesheet = StyleSheet.create(theme => {
    const c = theme.colors as any;
    const C = theme.colors as any;
    return { container: { flex: 1, backgroundColor: c.background }, header: { padding: 16, borderBottomWidth: 4, borderBottomColor: c.onBackground }, title: { fontSize: 24, fontWeight: "700", color: c.primary, textTransform: "uppercase" }, card: { backgroundColor: c.parchment, margin: 16, padding: 16, borderWidth: 4, borderColor: c.onBackground, borderRadius: 8, shadowColor: c.onBackground, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 8 }, label: { fontSize: 10, fontWeight: "700", color: c.secondary, textTransform: "uppercase" }, val: { fontSize: 36, fontWeight: "700", color: c.onBackground, marginTop: 4 }, sub: { fontSize: 14, color: c.secondary, marginTop: 2 } 
    };
});
export const PerformanceTrendsScreen: React.FC = () => { const { theme } = useUnistyles(); const s = stylesheet;
    const c = theme.colors as any;
    const C = theme.colors as any; return (<SafeAreaView style={s.container} edges={["top"]}><View style={s.header}><Text style={s.title}>Performance Trends</Text></View><ScrollView>{[{ l: "Fitness (CTL)", v: "82", sub: "+3 this week" }, { l: "Fatigue (ATL)", v: "95", sub: "High Load", mc: c.tertiary }, { l: "Form (TSB)", v: "-13", sub: "Optimal Training" }].map((m, i) => (<View key={i} style={s.card}><Text style={s.label}>{m.l}</Text><Text style={[s.val, m.mc && { color: m.mc }]}>{m.v}</Text><Text style={s.sub}>{m.sub}</Text></View>))}</ScrollView></SafeAreaView>); };
