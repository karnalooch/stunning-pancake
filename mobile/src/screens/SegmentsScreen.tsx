// STITCH Phase 3 — SegmentsScreen
import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useStyles } from 'react-native-unistyles';
import { stitchTheme } from "../theme/stitch";
const stylesheet = StyleSheet.create(theme => {
    const c = theme.colors as any;
    const C = theme.colors as any;
    return { ct: { flex: 1, backgroundColor: c.background }, h: { padding: 16, borderBottomWidth: 4, borderBottomColor: c.onBackground }, t: { fontSize: 24, fontWeight: "700", color: c.primary, textTransform: "uppercase" }, cd: { backgroundColor: c.parchment, margin: 12, padding: 12, borderWidth: 2, borderColor: c.onBackground, borderRadius: 8 }, l: { fontSize: 10, fontWeight: "700", color: c.secondary, textTransform: "uppercase" }, n: { fontSize: 16, fontWeight: "700", color: c.onBackground }, m: { fontSize: 18, fontWeight: "700", color: c.primary, marginTop: 4 } 
    };
});
export const SegmentsScreen: React.FC = () => { const { styles: s, theme } = useStyles(stylesheet);
    const c = theme.colors as any;
    const C = theme.colors as any; return (<SafeAreaView style={s.ct} edges={["top"]}><View style={s.h}><Text style={s.t}>Segments</Text></View><ScrollView>{[{ l: "Sprint", n: "Riverside Dash", d: "1.2 km", g: "0%", kom: "ShadowRider", t: "01:42" }, { l: "Climb", n: "Lookout Peak", d: "4.5 km", g: "8.5%", kom: "AeroQueen", t: "14:28" }, { l: "Rolling", n: "Valley Loop", d: "12.0 km", g: "2%", kom: "Unclaimed", t: "--:--" }].map((r, i) => (<View key={i} style={s.cd}><Text style={s.l}>{r.l}</Text><Text style={s.n}>{r.n}</Text><Text style={s.m}>{r.d} | {r.g} | KOM: {r.kom} {r.t}</Text></View>))}</ScrollView></SafeAreaView>); };
