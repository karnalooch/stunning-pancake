// STITCH Phase 1 — ActiveRideHUDScreen (refaktor TrackingScreen)
// Solar White cards over map background per docs/mockups/02-active-ride-hud.html
import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useStyles } from 'react-native-unistyles';
import { stitchTheme } from "../theme/stitch";
import * as Haptics from "expo-haptics";
const stylesheet = StyleSheet.create(theme => {
    const c = theme.colors as any;
    const C = theme.colors as any;
    const sh = { shadowColor: c.onBackground, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 8 };
    return {
        sh, ct: { flex: 1, backgroundColor: c.hudBackground }, map: { position: "absolute", inset: 0, backgroundColor: c.primaryContainer, justifyContent: "center", alignItems: "center" }, overlay: { flex: 1, padding: 16, justifyContent: "space-between" }, speedCard: { backgroundColor: c.parchment, borderWidth: 4, borderColor: c.onBackground, borderRadius: 8, padding: 16, alignItems: "center", ...sh }, sl: { fontSize: 10, fontWeight: "700", color: c.secondary, textTransform: "uppercase", letterSpacing: 1 }, sv: { fontSize: 48, fontWeight: "700", color: c.onBackground }, su: { fontSize: 18, color: c.outline }, row: { flexDirection: "row", gap: 8, marginTop: 8 }, mCard: { flex: 1, backgroundColor: c.parchment, borderWidth: 4, borderColor: c.onBackground, borderRadius: 8, padding: 12, ...sh }, ml: { fontSize: 10, fontWeight: "700", color: c.secondary, textTransform: "uppercase" }, mv: { fontSize: 22, fontWeight: "700", color: c.onBackground, marginTop: 4 }, mu: { fontSize: 12, color: c.outline }, pauseBtn: { backgroundColor: c.goldAmber, borderRadius: 8, borderWidth: 4, borderColor: c.onBackground, paddingVertical: 16, alignItems: "center", marginBottom: 8, ...sh }, pauseT: { fontSize: 20, fontWeight: "700", color: c.onBackground, textTransform: "uppercase" } 
    };
});
interface Props { user?: any; onPause?: () => void; onStop?: () => void }
export const ActiveRideHUDScreen: React.FC<Props> = ({ user, onPause, onStop }) => { const { styles: s, theme } = useStyles(stylesheet);
    const c = theme.colors as any;
    const C = theme.colors as any; return (<View style={s.ct}><View style={s.map}><Text style={{ fontSize: 14, color: c.secondary }}>MapLibre Live Map</Text></View><View style={s.overlay}><View style={{ paddingTop: 48 }}><View style={s.speedCard}><Text style={s.sl}>Current Speed</Text><Text style={s.sv}>32.8<Text style={s.su}> km/h</Text></Text></View><View style={s.row}><View style={s.mCard}><Text style={s.ml}>Distance</Text><Text style={s.mv}>18.5<Text style={s.mu}> km</Text></Text></View><View style={s.mCard}><Text style={s.ml}>HR</Text><Text style={[s.mv, { color: c.tertiary }]}>155<Text style={s.mu}> bpm</Text></Text></View><View style={s.mCard}><Text style={s.ml}>Time</Text><Text style={s.mv}>35:22</Text></View></View></View><Pressable style={({ pressed }) => [s.pauseBtn, pressed && { opacity: 0.8 }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => { }); onPause?.(); }}><Text style={s.pauseT}>⏸ PAUSE RIDE</Text></Pressable></View></View>); };
