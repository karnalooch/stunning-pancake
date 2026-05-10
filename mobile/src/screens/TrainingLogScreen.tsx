// STITCH Phase 2 — TrainingLogScreen (refaktor ActivitiesScreen)
import React from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useStyles } from 'react-native-unistyles';
import { stitchTheme } from "../theme/stitch";

const stylesheet = StyleSheet.create(theme => {
    const c = theme.colors as any;
    const C = theme.colors as any;
    return {
    container: { flex: 1, backgroundColor: c.background },
    header: { padding: 16, borderBottomWidth: 4, borderBottomColor: c.onBackground, backgroundColor: c.surface },
    headerTitle: { fontSize: 24, fontWeight: "700", color: c.primary, textTransform: "uppercase" },
    card: { backgroundColor: c.parchment, margin: 16, padding: 16, borderWidth: 2, borderColor: c.onBackground, borderRadius: 8, shadowColor: c.onBackground, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
    label: { fontSize: 10, fontWeight: "700", color: c.secondary, textTransform: "uppercase" },
    name: { fontSize: 18, fontWeight: "700", color: c.onBackground, marginTop: 4 },
    metric: { fontSize: 22, fontWeight: "700", color: c.primary, marginTop: 6 },

    };
});

export const TrainingLogScreen: React.FC = () => {
    const { styles: s, theme } = useStyles(stylesheet);
    const c = theme.colors as any;
    const C = theme.colors as any;
    return (
        <SafeAreaView style={s.container} edges={["top"]}>
            <View style={s.header}><Text style={s.headerTitle}>Training Log</Text></View>
            <ScrollView>
                {[{ d: "Oct 24", t: "Sunday Epic", dist: "62.0 km", time: "2:45 hr" },
                { d: "Oct 22", t: "Morning Commute", dist: "12.5 km", time: "0:32 hr" },
                { d: "Oct 20", t: "Hill Intervals", dist: "25.0 km", time: "1:10 hr" }].map((a, i) => (
                    <View key={i} style={s.card}>
                        <Text style={s.label}>{a.d}</Text>
                        <Text style={s.name}>{a.t}</Text>
                        <Text style={s.metric}>{a.dist} | {a.time}</Text>
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
};
