// STITCH Phase 3 — ExploreMapScreen
import React from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUnistyles } from 'react-native-unistyles';
import { stitchTheme } from "../theme/stitch";
export const ExploreMapScreen: React.FC = () => { const { theme } = useUnistyles();
    const c = theme.colors as any;
    const C = theme.colors as any; return (<SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={["top"]}><View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><Text style={{ fontSize: 24, fontWeight: "700", color: c.primary }}>Explore Map</Text><Text style={{ fontSize: 14, color: c.secondary, marginTop: 8 }}>MapLibre Placeholder</Text></View></SafeAreaView>); };
