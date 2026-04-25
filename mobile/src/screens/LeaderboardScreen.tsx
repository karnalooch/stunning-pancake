import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Trophy, Medal, Crown, TrendingUp } from 'lucide-react-native';
import { ActivityService } from '../services/api';

export const LeaderboardScreen = () => {
  const [category, setCategory] = useState<'CITY' | 'GLOBAL'>('CITY');
  const [ranking, setRanking] = useState<any[]>([]);
  const [myRank, setMyRank] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await ActivityService.getLeaderboard('siedlce'); // Hardcoded city for demo
        setRanking(data.leaderboard || []);
        
        const rankData = await ActivityService.getMyRank('siedlce');
        setMyRank(rankData);
      } catch (e) {
        console.error("Failed to fetch ranking", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [category]);


  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Rankings</Text>
        <Trophy size={28} color="#FBBF24" />
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, category === 'CITY' && styles.activeTab]}
          onPress={() => setCategory('CITY')}
        >
          <Text style={[styles.tabText, category === 'CITY' && styles.activeTabText]}>Siedlce</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, category === 'GLOBAL' && styles.activeTab]}
          onPress={() => setCategory('GLOBAL')}
        >
          <Text style={[styles.tabText, category === 'GLOBAL' && styles.activeTabText]}>Global</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.topThree}>
        <View style={styles.topUser}>
           <Text style={styles.rankNum}>2</Text>
           <View style={[styles.avatar, { borderColor: '#94A3B8' }]}><Text style={styles.avatarText}>{ranking[1]?.username?.[0] || '?'}</Text></View>
           <Text style={styles.topName}>{ranking[1]?.username || '...'}</Text>
           <Text style={styles.topPoints}>{ranking[1]?.score_km || 0} km</Text>
        </View>
        <View style={[styles.topUser, { marginTop: -20 }]}>
           <Crown size={24} color="#FBBF24" style={{ marginBottom: 4 }} />
           <View style={[styles.avatar, { borderColor: '#FBBF24', width: 80, height: 80, borderRadius: 40 }]}>
             <Text style={[styles.avatarText, { fontSize: 32 }]}>{ranking[0]?.username?.[0] || '?'}</Text>
           </View>
           <Text style={[styles.topName, { fontWeight: '900' }]}>{ranking[0]?.username || '...'}</Text>
           <Text style={[styles.topPoints, { color: '#FBBF24' }]}>{ranking[0]?.score_km || 0} km</Text>
        </View>
        <View style={styles.topUser}>
           <Text style={styles.rankNum}>3</Text>
           <View style={[styles.avatar, { borderColor: '#B45309' }]}><Text style={styles.avatarText}>{ranking[2]?.username?.[0] || '?'}</Text></View>
           <Text style={styles.topName}>{ranking[2]?.username || '...'}</Text>
           <Text style={styles.topPoints}>{ranking[2]?.score_km || 0} km</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {ranking.slice(3).map((item: any, i: number) => (
          <View key={item.user_id} style={styles.rankRow}>
            <Text style={styles.rowRank}>#{i + 4}</Text>
            <View style={styles.rowAvatar}><Text style={styles.rowAvatarText}>{item.username?.[0]}</Text></View>
            <Text style={styles.rowName}>{item.username}</Text>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
               <Text style={styles.rowPoints}>{item.score_km} km</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.myRank}>
         <Text style={styles.rowRank}>#{myRank?.rank || '?'}</Text>
         <View style={[styles.rowAvatar, { backgroundColor: '#2563EB' }]}><Text style={styles.rowAvatarText}>ME</Text></View>
         <Text style={styles.rowName}>You (Current Stats)</Text>
         <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={styles.rowPoints}>{myRank?.score_km || 0} km</Text>
         </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, alignItems: 'center', marginBottom: 20 },
  title: { color: 'white', fontSize: 28, fontWeight: '900' },
  tabContainer: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 30 },
  tab: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, backgroundColor: '#111' },
  activeTab: { backgroundColor: '#2563EB' },
  tabText: { color: '#666', fontWeight: '800', fontSize: 13 },
  activeTabText: { color: 'white' },
  topThree: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 20, marginBottom: 40 },
  topUser: { alignItems: 'center' },
  avatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  avatarText: { color: 'white', fontSize: 24, fontWeight: '900' },
  rankNum: { color: '#666', fontWeight: '900', marginBottom: 4 },
  topName: { color: 'white', marginTop: 10, fontSize: 13, fontWeight: '700' },
  topPoints: { color: '#666', fontSize: 11, fontWeight: '800', marginTop: 2 },
  list: { paddingHorizontal: 20, paddingBottom: 120 },
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#111' },
  rowRank: { color: '#444', width: 40, fontWeight: '900', fontSize: 12 },
  rowAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rowAvatarText: { color: 'white', fontSize: 10, fontWeight: '800' },
  rowName: { color: 'white', fontWeight: '600', fontSize: 14 },
  rowPoints: { color: 'white', fontWeight: '800', fontSize: 12 },
  myRank: { 
    position: 'absolute', bottom: 0, left: 0, right: 0, 
    backgroundColor: '#111', padding: 20, borderTopWidth: 1, borderTopColor: '#222',
    flexDirection: 'row', alignItems: 'center'
  }
});
