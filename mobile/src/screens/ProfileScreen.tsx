import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import { User, Shield, MapPin, LogOut, Trash2, Plus } from 'lucide-react-native';
import { AuthService, PrivacyService } from '../services/api';

export const ProfileScreen = ({ onLogout }: any) => {
  const [user, setUser] = useState<any>(null);
  const [zones, setZones] = useState<any[]>([]);
  const [isIncognito, setIsIncognito] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const profile = await AuthService.getProfile();
        setUser(profile);
        const zoneData = await PrivacyService.getZones();
        setZones(zoneData);
      } catch (e) {
        console.error(e);
      }
    };
    fetchData();
  }, []);

  const handleDeleteZone = async (id: string) => {
    Alert.alert("Delete Zone", "Are you sure you want to remove this privacy zone?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await PrivacyService.deleteZone(id);
        setZones(zones.filter(z => z.id !== id));
      }}
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.profileHeader}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarTextLarge}>{user?.username?.[0]?.toUpperCase() || 'U'}</Text>
        </View>
        <Text style={styles.username}>{user?.username || 'Loading...'}</Text>
        <Text style={styles.email}>{user?.email || 'athlete@sport.com'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PRIVACY SETTINGS</Text>
          <View style={styles.settingRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Shield size={20} color="#2563EB" />
              <View>
                <Text style={styles.settingName}>Global Incognito</Text>
                <Text style={styles.settingDesc}>Mask all tracks by default</Text>
              </View>
            </View>
            <Switch 
              value={isIncognito} 
              onValueChange={setIsIncognito}
              trackColor={{ false: '#333', true: '#2563EB' }}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>PRIVACY ZONES</Text>
            <TouchableOpacity style={styles.addButton}>
              <Plus size={16} color="white" />
            </TouchableOpacity>
          </View>
          
          {zones.length === 0 ? (
            <Text style={styles.emptyText}>No zones defined. Add your home or office to mask your starts and finishes.</Text>
          ) : (
            zones.map((zone) => (
              <View key={zone.id} style={styles.zoneCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <MapPin size={18} color="#666" />
                  <View>
                    <Text style={styles.zoneName}>{zone.name || 'Unnamed Zone'}</Text>
                    <Text style={styles.zoneRadius}>{zone.radius || 200}m Radius</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleDeleteZone(zone.id)}>
                  <Trash2 size={18} color="#DC2626" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <LogOut size={20} color="#DC2626" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 60 },
  title: { color: 'white', fontSize: 28, fontWeight: '900', paddingHorizontal: 20, marginBottom: 24 },
  profileHeader: { alignItems: 'center', marginBottom: 40 },
  avatarLarge: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#111', borderWidth: 1, borderColor: '#333', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  avatarTextLarge: { color: 'white', fontSize: 42, fontWeight: '900' },
  username: { color: 'white', fontSize: 22, fontWeight: '900' },
  email: { color: '#666', fontSize: 14, marginTop: 4 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  section: { marginBottom: 32 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { color: '#444', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  addButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0a0a0a', padding: 12, borderRadius: 12 },
  settingName: { color: 'white', fontWeight: '700', fontSize: 14 },
  settingDesc: { color: '#666', fontSize: 11, marginTop: 2 },
  zoneCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111', padding: 16, borderRadius: 16, marginBottom: 10 },
  zoneName: { color: 'white', fontWeight: '700', fontSize: 14 },
  zoneRadius: { color: '#666', fontSize: 11, marginTop: 2 },
  emptyText: { color: '#444', fontSize: 12, textAlign: 'center', paddingVertical: 20, fontStyle: 'italic' },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20, borderTopWidth: 1, borderTopColor: '#111', marginTop: 20 },
  logoutText: { color: '#DC2626', fontWeight: '900', fontSize: 14, letterSpacing: 1 }
});
