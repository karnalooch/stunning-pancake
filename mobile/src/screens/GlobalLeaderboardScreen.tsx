// STITCH Phase 2 — GlobalLeaderboardScreen (refaktor LeaderboardScreen)
import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useStyles } from 'react-native-unistyles';
import { stitchTheme } from "../theme/stitch";
const stylesheet = StyleSheet.create(theme => {
    const c = theme.colors as any;
    const C = theme.colors as any;
    return { ct: { flex: 1, backgroundColor: c.background }, h: { padding: 16, borderBottomWidth: 4, borderBottomColor: c.onBackground, backgroundColor: c.surface }, t: { fontSize: 24, fontWeight: "700", color: c.primary, textTransform: "uppercase" }, row: { flexDirection: "row", alignItems: "center", backgroundColor: c.parchment, marginHorizontal: 16, marginTop: 8, padding: 12, borderWidth: 2, borderColor: c.onBackground, borderRadius: 8 }, rank: { fontSize: 20, fontWeight: "700", width: 32, color: c.primary }, name: { flex: 1, fontSize: 16, fontWeight: "700", color: c.onBackground, marginLeft: 8 }, pts: { fontSize: 18, fontWeight: "700", color: c.primary }, footer: { backgroundColor: c.surfaceContainerHigh, padding: 16, borderTopWidth: 4, borderTopColor: c.onBackground, marginTop: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, fl: { fontSize: 10, fontWeight: "700", color: c.secondary, textTransform: "uppercase" }, fv: { fontSize: 20, fontWeight: "700", color: c.onBackground } 
    };
});
export const GlobalLeaderboardScreen: React.FC = () => { const { styles: s, theme } = useStyles(stylesheet);
    const c = theme.colors as any;
    const C = theme.colors as any; const data = [{ r: 1, n: "London", p: "1,245k", c: "United Kingdom" }, { r: 2, n: "Paris", p: "982k", c: "France" }, { r: 3, n: "New York", p: "875k", c: "USA" }, { r: 42, n: "Berlin", p: "412k", c: "Germany" }, { r: 128, n: "Siedlce", p: "142k", c: "Poland", you: true }]; return (<SafeAreaView style={s.ct} edges={["top"]}><View style={s.h}><Text style={s.t}>Global Leaderboard</Text></View><ScrollView>{data.map((d, i) => (<View key={i} style={[s.row, d.you && { backgroundColor: c.primaryContainer }]}><Text style={s.rank}>{d.r}</Text><View style={{ flex: 1 }}><Text style={s.name}>{d.n}</Text><Text style={{ fontSize: 10, color: c.secondary }}>{d.c}</Text></View><Text style={s.pts}>{d.p}</Text></View>))}</ScrollView><View style={s.footer}><Text style={s.fl}>Your City</Text><Text style={s.fv}>Siedlce — 128th</Text></View></SafeAreaView>); };
