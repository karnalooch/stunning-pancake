// STITCH Phase 2 — RidePausedScreen (modal overlay)
import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useUnistyles } from "../theme/unistyles";
import { stitchTheme } from "../theme/stitch";
const c = stitchTheme.colors;
const s = StyleSheet.create({ overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 16 }, modal: { backgroundColor: c.surface, borderWidth: 4, borderColor: c.onBackground, borderRadius: 12, padding: 24, width: "100%", maxWidth: 320, alignItems: "center" }, t: { fontSize: 24, fontWeight: "700", color: c.onBackground, textTransform: "uppercase", marginTop: 12, marginBottom: 24 }, btn: { width: "100%", paddingVertical: 16, borderRadius: 8, borderWidth: 4, borderColor: c.onBackground, alignItems: "center", marginTop: 8 }, btnR: { backgroundColor: c.primaryContainer }, btnS: { backgroundColor: c.error }, btnT: { fontSize: 18, fontWeight: "700", textTransform: "uppercase" } });
interface Props { onResume: () => void; onStop: () => void }
export const RidePausedScreen: React.FC<Props> = ({ onResume, onStop }) => { useUnistyles(); return (<View style={s.overlay}><View style={s.modal}><Text style={{ fontSize: 40 }}>⏸️</Text><Text style={s.t}>Session Paused</Text><Pressable style={[s.btn, s.btnR]} onPress={onResume}><Text style={[s.btnT, { color: c.onPrimaryContainer }]}>▶ RESUME</Text></Pressable><Pressable style={[s.btn, s.btnS]} onPress={onStop}><Text style={[s.btnT, { color: c.onError }]}>■ STOP RIDE</Text></Pressable></View></View>); };
