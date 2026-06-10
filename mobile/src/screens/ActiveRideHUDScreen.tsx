// STITCH Phase 1 — ActiveRideHUDScreen (refaktor TrackingScreen)
// Solar White cards over map background per docs/mockups/02-active-ride-hud.html
import React from "react";
import { View, Text, Pressable } from "react-native";
import { GpsRecoveryBanner } from "../components/GpsRecoveryBanner";
import { RideMapView } from "../components/RideMapView";
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { stitchTheme } from "../theme/stitch";
import * as Haptics from "expo-haptics";
const stylesheet = StyleSheet.create(theme => {
    const c = theme.colors as any;
    const C = theme.colors as any;
    const sh = { shadowColor: c.onBackground, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 8 };
    return {
        sh, ct: { flex: 1, backgroundColor: c.hudBackground }, map: { position: "absolute", inset: 0, backgroundColor: c.primaryContainer, justifyContent: "center", alignItems: "center" }, overlay: { flex: 1, padding: 16, justifyContent: "space-between" }, speedCard: { backgroundColor: c.parchment, borderWidth: 4, borderColor: c.onBackground, borderRadius: 8, padding: 16, alignItems: "center", ...sh }, sl: { fontSize: 10, fontWeight: "700", color: c.secondary, textTransform: "uppercase", letterSpacing: 1 }, sv: { fontSize: 48, fontWeight: "700", color: c.onBackground }, su: { fontSize: 18, color: c.outline }, row: { flexDirection: "row", gap: 8, marginTop: 8 }, mCard: { flex: 1, backgroundColor: c.parchment, borderWidth: 4, borderColor: c.onBackground, borderRadius: 8, padding: 12, ...sh }, ml: { fontSize: 10, fontWeight: "700", color: c.secondary, textTransform: "uppercase" }, mv: { fontSize: 22, fontWeight: "700", color: c.onBackground, marginTop: 4 }, mu: { fontSize: 12, color: c.outline }, pauseBtn: { backgroundColor: c.goldAmber, borderRadius: 8, borderWidth: 4, borderColor: c.onBackground, paddingVertical: 16, alignItems: "center", marginBottom: 8, ...sh }, pauseT: { fontSize: 20, fontWeight: "700", color: c.onBackground, textTransform: "uppercase" }, stopBtn: { backgroundColor: c.errorContainer ?? c.tertiaryContainer, borderRadius: 8, borderWidth: 4, borderColor: c.onBackground, paddingVertical: 14, alignItems: "center", ...sh }, stopT: { fontSize: 16, fontWeight: "700", color: c.onError ?? c.onBackground, textTransform: "uppercase" }
    };
});
interface Props {
  user?: any;
  onPause?: () => void;
  onStop?: () => void;
  liveSpeed?: number;
  liveDistanceKm?: number;
  gpsRecoveryVisible?: boolean;
  gpsRecoveryBusy?: boolean;
  onGpsRecoveryPress?: () => void;
}
export const ActiveRideHUDScreen: React.FC<Props> = ({
  onPause,
  onStop,
  liveSpeed = 0,
  liveDistanceKm = 0,
  gpsRecoveryVisible = false,
  gpsRecoveryBusy = false,
  onGpsRecoveryPress,
}) => {
  const { theme } = useUnistyles();
  const s = stylesheet;
  const c = theme.colors as any;
  const speedKmh = (liveSpeed * 3.6).toFixed(1);
  return (
    <View style={s.ct}>
      <View style={s.map}>
        <RideMapView />
      </View>
      <View style={s.overlay}>
        <View style={{ paddingTop: 48 }}>
          <GpsRecoveryBanner
            visible={gpsRecoveryVisible}
            busy={gpsRecoveryBusy}
            onPress={() => onGpsRecoveryPress?.()}
          />
          <View style={s.speedCard}>
            <Text style={s.sl}>Current Speed</Text>
            <Text style={s.sv}>
              {speedKmh}
              <Text style={s.su}> km/h</Text>
            </Text>
          </View>
          <View style={s.row}>
            <View style={s.mCard}>
              <Text style={s.ml}>Distance</Text>
              <Text style={s.mv}>
                {liveDistanceKm.toFixed(1)}
                <Text style={s.mu}> km</Text>
              </Text>
            </View>
            <View style={s.mCard}>
              <Text style={s.ml}>HR</Text>
              <Text style={[s.mv, { color: c.tertiary }]}>—</Text>
            </View>
            <View style={s.mCard}>
              <Text style={s.ml}>Pending</Text>
              <Text style={s.mv}>{gpsRecoveryVisible ? '!' : 'OK'}</Text>
            </View>
          </View>
        </View>
        <View>
          <Pressable
            style={({ pressed }) => [s.pauseBtn, pressed && { opacity: 0.8 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
              onPause?.();
            }}
          >
            <Text style={s.pauseT}>⏸ PAUSE RIDE</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [s.stopBtn, pressed && { opacity: 0.8 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              onStop?.();
            }}
          >
            <Text style={s.stopT}>■ FINISH RIDE</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};
