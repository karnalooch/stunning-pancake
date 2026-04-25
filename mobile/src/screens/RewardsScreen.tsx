import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Gift, MapPin, Tag } from 'lucide-react-native';

const MOCK_REWARDS = [
  { id: 1, shop: 'Eco Coffee', offer: '-20% on any Latte', cost: '500 XP' },
  { id: 2, shop: 'FitStore', offer: 'Free Energy Bar', cost: '1200 XP' },
  { id: 3, shop: 'CycleWorld', offer: '-15% Service', cost: '2500 XP' },
];

export const RewardsScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rewards</Text>
      
      <View style={styles.pointsCard}>
        <View>
          <Text style={styles.pointsLabel}>AVAILABLE BALANCE</Text>
          <Text style={styles.pointsValue}>1,842 XP</Text>
        </View>
        <Gift size={32} color="white" opacity={0.5} />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {MOCK_REWARDS.map((reward) => (
          <TouchableOpacity key={reward.id} style={styles.card}>
            <View style={styles.rewardIcon}>
              <Tag size={20} color="white" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.shopName}>{reward.shop}</Text>
              <Text style={styles.offer}>{reward.offer}</Text>
              <View style={styles.locationRow}>
                <MapPin size={12} color="#666" />
                <Text style={styles.locationText}>Siedlce, Center</Text>
              </View>
            </View>
            <View style={styles.costBadge}>
              <Text style={styles.costText}>{reward.cost}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 60, paddingHorizontal: 20 },
  title: { color: 'white', fontSize: 28, fontWeight: '900', marginBottom: 24 },
  pointsCard: { 
    backgroundColor: '#2563EB', padding: 24, borderRadius: 20, 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 30
  },
  pointsLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  pointsValue: { color: 'white', fontSize: 32, fontWeight: '900', marginTop: 4 },
  list: { gap: 16 },
  card: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', 
    padding: 16, borderRadius: 16, gap: 16, borderLeftWidth: 4, borderLeftColor: '#2563EB'
  },
  rewardIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center' },
  shopName: { color: '#666', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  offer: { color: 'white', fontWeight: '800', fontSize: 16, marginVertical: 2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { color: '#444', fontSize: 11 },
  costBadge: { backgroundColor: '#222', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  costText: { color: 'white', fontSize: 11, fontWeight: '900' }
});
