// STITCH Phase 2 — MarketplaceScreen (refaktor RewardsScreen)
import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useStyles } from 'react-native-unistyles';
import { stitchTheme } from "../theme/stitch";
const stylesheet = StyleSheet.create(theme => {
    const c = theme.colors as any;
    const C = theme.colors as any;
    return { ct: { flex: 1, backgroundColor: c.background }, h: { padding: 16, borderBottomWidth: 4, borderBottomColor: c.onBackground }, t: { fontSize: 24, fontWeight: "700", color: c.primary, textTransform: "uppercase" }, bal: { flexDirection: "row", padding: 16, gap: 12 }, balCd: { flex: 1, backgroundColor: c.parchment, padding: 12, borderWidth: 2, borderColor: c.onBackground, borderRadius: 8 }, bl: { fontSize: 10, fontWeight: "700", color: c.secondary, textTransform: "uppercase" }, bv: { fontSize: 18, fontWeight: "700", color: c.onBackground, marginTop: 4 }, grid: { flexDirection: "row", flexWrap: "wrap", padding: 16, gap: 8 }, item: { width: "47%", backgroundColor: c.parchment, padding: 12, borderWidth: 2, borderColor: c.onBackground, borderRadius: 8 }, il: { fontSize: 18, fontWeight: "700", color: c.onBackground }, ip: { fontSize: 12, color: c.secondary }, ib: { backgroundColor: c.primaryContainer, padding: 8, borderRadius: 4, borderWidth: 2, borderColor: c.onBackground, alignItems: "center", marginTop: 8 }, ibT: { fontSize: 12, fontWeight: "700", color: c.onPrimaryContainer } 
    };
});
export const MarketplaceScreen: React.FC = () => { const { styles: s, theme } = useStyles(stylesheet);
    const c = theme.colors as any;
    const C = theme.colors as any; return (<SafeAreaView style={s.ct} edges={["top"]}><View style={s.h}><Text style={s.t}>Marketplace</Text></View><ScrollView><View style={s.bal}><View style={s.balCd}><Text style={s.bl}>GOLD</Text><Text style={s.bv}>1,250</Text></View><View style={s.balCd}><Text style={s.bl}>XP</Text><Text style={s.bv}>45,000</Text></View></View><View style={s.grid}>{[{ n: "Aero Helmet Lvl 1", p: "+2 Spd", c: "500 G" }, { n: "Crimson Jersey", p: "+5 End", c: "10k XP" }, { n: "Sprint Boost", p: "+3 Spd", c: "100 G" }, { n: "Draft Shield", p: "+2 End", c: "150 G" }].map((m, i) => (<View key={i} style={s.item}><Text style={s.il}>{m.n}</Text><Text style={s.ip}>{m.p}</Text><View style={s.ib}><Text style={s.ibT}>{m.c}</Text></View></View>))}</View></ScrollView></SafeAreaView>); };
