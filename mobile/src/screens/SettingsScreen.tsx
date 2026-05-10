// STITCH Phase 3 — SettingsScreen (stack, accessed from gear icon)
import React from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useStyles } from 'react-native-unistyles';
import { stitchTheme } from "../theme/stitch";
const stylesheet = StyleSheet.create(theme => {
    const c = theme.colors as any;
    const C = theme.colors as any;
    return { ct: { flex: 1, backgroundColor: c.background }, h: { padding: 16, borderBottomWidth: 4, borderBottomColor: c.onBackground }, t: { fontSize: 24, fontWeight: "700", color: c.primary, textTransform: "uppercase" }, cd: { backgroundColor: c.parchment, margin: 12, padding: 16, borderWidth: 2, borderColor: c.onBackground, borderRadius: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, l: { fontSize: 14, fontWeight: "700", color: c.onBackground }, v: { fontSize: 14, color: c.secondary } 
    };
});
export const SettingsScreen: React.FC = () => { const { styles: s, theme } = useStyles(stylesheet);
    const c = theme.colors as any;
    const C = theme.colors as any; return (<SafeAreaView style={s.ct} edges={["top"]}><View style={s.h}><Text style={s.t}>Settings</Text></View><ScrollView>{[{ l: "TICKR FIT - 8A2B", v: "Connected", dot: true }, { l: "ASSIOMA DUO", v: "Connected", dot: true }, { l: "Wahoo Blue SC", v: "Searching..." }, { l: "Rider Weight", v: "72 KG" }, { l: "Max Heart Rate", v: "192 BPM" }, { l: "Haptic Feedback", v: "ON" }].map((r, i) => (<View key={i} style={s.cd}><Text style={s.l}>{r.l}</Text><Text style={[s.v, r.dot && { color: c.primary }]}>{r.v}{r.dot ? " ●" : ""}</Text></View>))}</ScrollView></SafeAreaView>); };
